// Chat state for the Assistant tab. Sends turns to the main-process editing
// agent over IPC, folds the push stream (text deltas, tool activity, the cut
// proposal) into the message list, and hands proposals up to the caller — the
// caller dispatches `proposal-add`, so agent cuts land in the exact same
// review flow as Auto Cut. W3 adds the other direction: main may ASK the
// renderer to apply a proposal, queue an export or set captions (the action
// bridge), and a multi-step run continues by itself when the user answers a
// review card (see `notifyReviewResolved`).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChatMessage,
  StudioAgentAction,
  StudioAgentChatMessage,
  StudioAgentOpenProposal,
} from '@shared/ipc/types';
import type { ThinkingLevel } from '@shared/tsx-engine/types';
import type { StudioMediaAsset, StudioProposal, StudioShot } from '../types';
import {
  estimateContextUsage,
  hasNextStepMarker,
  proposalNoteFor,
  replayWindow,
  reviewOutcomeMessage,
  toAgentAsset,
  type AgentChatMessage,
  type AgentContextUsage,
} from '../services/agent-chat-format';

export type { AgentChatMessage, AgentContextUsage } from '../services/agent-chat-format';

export interface AgentToolCall {
  tool: string;
  detail?: string;
}

export interface AgentActionOutcome {
  success: boolean;
  message?: string;
  error?: string;
}

export interface UseStudioAgentOptions {
  projectId: string;
  projectName: string;
  assets: StudioMediaAsset[];
  /** The shot-pool registry — snapshotted per turn so the agent can list and
   *  re-propose shots from earlier sessions, not only this pass's. */
  shots: StudioShot[];
  /** A cut proposal is open in the review panel. */
  reviewOpen: boolean;
  /** The open proposal's identity (W3 `accept_proposal`). */
  openProposal?: StudioAgentOpenProposal | undefined;
  /** The project's transcription model — `transcribe_asset`'s default. */
  sttModelId?: string | undefined;
  captions?: { templateId: string; enabled: boolean } | undefined;
  timelineDurationSeconds?: number | undefined;
  providerId?: string | undefined;
  model?: string | undefined;
  shotModel?: string | undefined;
  thinking?: ThinkingLevel | undefined;
  onProposal: (proposal: StudioProposal) => void;
  /** W3: main asks the renderer to act (apply / export / captions). */
  onAction: (action: StudioAgentAction) => Promise<AgentActionOutcome>;
  /** W3: library assets a tool imported into the project on use. */
  onImportedAssets: (assets: StudioMediaAsset[]) => void;
}

let nextId = 0;
const msgId = () => `msg_${++nextId}_${Date.now().toString(36)}`;

export function useStudioAgent(options: UseStudioAgentOptions) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  /** Whether the resolved provider drives typed tools (undefined until the
   *  first turn answers). false = chat-only provider — memory proposals and
   *  cut/shot tools are unavailable, and the UI should say so. */
  const [toolsAvailable, setToolsAvailable] = useState<boolean | undefined>(undefined);

  // The event stream and send() need the latest options without resubscribing.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // ----- Persistence (Q1d): load on open, write-behind after each turn -----
  // The renderer owns the live list; agent-chat.json beside project.json is
  // the durable copy. `loaded` gates the write-behind so the initial empty
  // state never clobbers an existing transcript.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let disposed = false;
    setLoaded(false);
    setMessages([]);
    void window.api.studioAgentChatLoad({ projectId: options.projectId }).then((res) => {
      if (disposed) return;
      if (res.success && res.messages) {
        setMessages(res.messages);
      }
      setLoaded(true);
    });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.projectId]);

  useEffect(() => {
    if (!loaded || busy) return;
    // Strip the live-stream flag; a pending row must never persist.
    const persistable: StudioAgentChatMessage[] = messages
      .filter((m) => !m.pending)
      .map(({ pending: _pending, ...rest }) => rest);
    void window.api.studioAgentChatSave({
      projectId: optionsRef.current.projectId,
      messages: persistable,
    });
  }, [messages, busy, loaded]);

  const patchPending = useCallback((patch: (msg: AgentChatMessage) => AgentChatMessage) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || !last.pending) return prev;
      return [...prev.slice(0, -1), patch(last)];
    });
  }, []);

  useEffect(() => {
    return window.api.onStudioAgentEvent((event) => {
      if (event.projectId !== optionsRef.current.projectId) return;
      if (event.kind === 'delta') {
        patchPending((msg) => ({ ...msg, text: msg.text + event.text }));
      } else if (event.kind === 'tool') {
        patchPending((msg) => ({
          ...msg,
          // A new model turn follows the tool result — restart the streamed
          // text so deltas from the next turn don't append to the old one.
          text: '',
          toolCalls: [
            ...(msg.toolCalls ?? []),
            { tool: event.tool, ...(event.detail ? { detail: event.detail } : {}) },
          ],
        }));
      } else if (event.kind === 'progress') {
        // Long tools update their chip in place: "Transcribing — 42% Uploading…".
        patchPending((msg) => {
          const calls = msg.toolCalls ?? [];
          const index = calls.map((c) => c.tool).lastIndexOf(event.tool);
          if (index < 0) return msg;
          const detail = `${event.percent !== undefined ? `${Math.round(event.percent)}% ` : ''}${event.message}`;
          return { ...msg, toolCalls: calls.map((c, i) => (i === index ? { ...c, detail } : c)) };
        });
      } else if (event.kind === 'proposal') {
        optionsRef.current.onProposal(event.proposal);
        const proposalNote = proposalNoteFor(event.proposal);
        patchPending((msg) => ({ ...msg, proposalNote }));
      } else if (event.kind === 'assets-imported') {
        optionsRef.current.onImportedAssets(event.assets);
      } else if (event.kind === 'action') {
        const { requestId, action } = event;
        void optionsRef.current
          .onAction(action)
          .catch((err: unknown): AgentActionOutcome => ({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }))
          .then((outcome) =>
            window.api.studioAgentActionResult({
              projectId: optionsRef.current.projectId,
              requestId,
              success: outcome.success,
              ...(outcome.message ? { message: outcome.message } : {}),
              ...(outcome.error ? { error: outcome.error } : {}),
            }),
          );
      }
    });
  }, [patchPending]);

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busyRef.current) return;
      const opts = optionsRef.current;

      // Only the replay window rides the request (Q1d cap) — the full
      // transcript stays visible in the panel and on disk.
      const history: ChatMessage[] = replayWindow(messagesRef.current).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      setMessages((prev) => [
        ...prev,
        { id: msgId(), role: 'user', text: trimmed },
        { id: msgId(), role: 'assistant', text: '', pending: true },
      ]);
      setBusy(true);
      busyRef.current = true;
      try {
        const response = await window.api.studioAgentSend({
          projectId: opts.projectId,
          projectName: opts.projectName,
          prompt: trimmed,
          history,
          assets: opts.assets.map(toAgentAsset),
          shots: opts.shots,
          reviewOpen: opts.reviewOpen,
          ...(opts.openProposal ? { openProposal: opts.openProposal } : {}),
          ...(opts.sttModelId ? { sttModelId: opts.sttModelId } : {}),
          ...(opts.captions ? { captions: opts.captions } : {}),
          ...(opts.timelineDurationSeconds !== undefined
            ? { timelineDurationSeconds: opts.timelineDurationSeconds }
            : {}),
          ...(opts.providerId ? { providerId: opts.providerId } : {}),
          ...(opts.model ? { model: opts.model } : {}),
          ...(opts.shotModel ? { shotModel: opts.shotModel } : {}),
          ...(opts.thinking ? { thinking: opts.thinking } : {}),
        });
        if (response.toolsAvailable !== undefined) setToolsAvailable(response.toolsAvailable);
        patchPending((msg) => ({
          ...msg,
          pending: false,
          ...(response.success
            ? { text: response.text ?? msg.text }
            : { text: response.error ?? 'The assistant failed to reply.', error: true }),
        }));
      } catch (err) {
        patchPending((msg) => ({
          ...msg,
          pending: false,
          error: true,
          text: err instanceof Error ? err.message : 'The assistant failed to reply.',
        }));
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    },
    [patchPending],
  );

  /**
   * W3: a review card was answered. When the assistant's last message ended
   * with the `[next: …]` marker (a multi-step run waiting on the card), the
   * outcome re-enters the chat as a turn so the run continues without the
   * user typing. Any other resolution is silent — no spent turn.
   */
  const notifyReviewResolved = useCallback(
    (proposal: StudioProposal) => {
      if (busyRef.current) return;
      const outcome = reviewOutcomeMessage(proposal);
      if (!outcome) return;
      const last = [...messagesRef.current].reverse().find((m) => m.role === 'assistant' && !m.pending);
      if (!last || !hasNextStepMarker(last.text)) return;
      void send(outcome);
    },
    [send],
  );

  const cancel = useCallback(() => {
    void window.api.studioAgentCancel({ projectId: optionsRef.current.projectId });
  }, []);

  /** "New conversation" (Q1d): rotate the transcript aside on disk (newest 3
   *  rotations kept), then clear the panel. Restart is no longer a reset, so
   *  reset must be a choice. */
  const clear = useCallback(() => {
    if (busyRef.current) return;
    void window.api
      .studioAgentChatReset({ projectId: optionsRef.current.projectId })
      .then(() => setMessages([]));
  }, []);

  const contextUsage: AgentContextUsage = useMemo(
    () => estimateContextUsage(messages, options.assets),
    [messages, options.assets],
  );

  return { messages, busy, send, cancel, clear, contextUsage, toolsAvailable, notifyReviewResolved };
}

export type UseStudioAgentResult = ReturnType<typeof useStudioAgent>;
