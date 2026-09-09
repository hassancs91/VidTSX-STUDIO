// Chat state for the Assistant tab. Sends turns to the main-process editing
// agent over IPC, folds the push stream (text deltas, tool activity, the cut
// proposal) into the message list, and hands proposals up to the caller — the
// caller dispatches `proposal-add`, so agent cuts land in the exact same
// review flow as Auto Cut.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, StudioAgentAssetInfo, StudioAgentChatMessage } from '@shared/ipc/types';
import type { ThinkingLevel } from '@shared/tsx-engine/types';
import type { StudioMediaAsset, StudioProposal, StudioShot } from '../types';

/**
 * Context budget for the estimate meter. The engine doesn't report real token
 * usage across providers, so this is a deliberate conservative floor (cloud
 * models are 128k+; local models vary). The estimate exists to warn, not bill.
 */
const CONTEXT_BUDGET_TOKENS = 128_000;
/** System prompt + skill + tool definitions, roughly. */
const BASE_OVERHEAD_TOKENS = 2_000;
/** Takes-view tokens per transcript word (word + timing markup). */
const TOKENS_PER_TRANSCRIPT_WORD = 2;

/**
 * Replay cap (SHOT_QUALITY_DESIGN.md Q1d, N=30): the UI keeps the whole
 * persisted transcript, but a turn replays only the most recent 30 exchanges
 * (user + assistant pairs). Append-only history keeps the prompt cache warm;
 * a rolling summary would invalidate the prefix every turn.
 */
const REPLAY_TURN_CAP = 30;
const REPLAY_MESSAGE_CAP = REPLAY_TURN_CAP * 2;

/** The replayed window: newest messages, capped, errors and blanks dropped. */
function replayWindow(messages: AgentChatMessage[]): AgentChatMessage[] {
  return messages
    .filter((m) => !m.error && m.text.trim().length > 0)
    .slice(-REPLAY_MESSAGE_CAP);
}

export interface AgentContextUsage {
  /** Estimated tokens the NEXT turn will carry (transcripts + chat + base). */
  estTokens: number;
  /** estTokens over the assumed budget, uncapped (can exceed 1). */
  ratio: number;
}

export interface AgentToolCall {
  tool: string;
  detail?: string;
}

/** Display row = the persisted shape (Q1d) plus the live-stream flag. */
export interface AgentChatMessage extends StudioAgentChatMessage {
  pending?: boolean;
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
  providerId?: string | undefined;
  model?: string | undefined;
  shotModel?: string | undefined;
  thinking?: ThinkingLevel | undefined;
  onProposal: (proposal: StudioProposal) => void;
}

function assetName(asset: StudioMediaAsset): string {
  return asset.path.split(/[\\/]/).pop() ?? asset.id;
}

function toAgentAsset(asset: StudioMediaAsset): StudioAgentAssetInfo {
  const ready = asset.transcript?.status === 'ready';
  return {
    id: asset.id,
    name: assetName(asset),
    kind: asset.kind,
    path: asset.path,
    ...(asset.description ? { description: asset.description } : {}),
    durationSeconds: asset.probe.duration,
    ...(ready && asset.transcript
      ? {
          transcript: {
            engine: asset.transcript.engine,
            ...(asset.transcript.wordCount !== undefined
              ? { wordCount: asset.transcript.wordCount }
              : {}),
            ...(asset.transcript.features?.verbatimDisfluencies !== undefined
              ? { verbatim: asset.transcript.features.verbatimDisfluencies }
              : {}),
          },
        }
      : {}),
  };
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
      } else if (event.kind === 'proposal') {
        optionsRef.current.onProposal(event.proposal);
        const n = event.proposal.items.length;
        patchPending((msg) => ({
          ...msg,
          proposalNote: `Proposed ${n} cut${n === 1 ? '' : 's'} — review on the timeline or in the Inspector`,
        }));
      }
    });
  }, [patchPending]);

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busy) return;
      const opts = optionsRef.current;

      // Only the replay window rides the request (Q1d cap) — the full
      // transcript stays visible in the panel and on disk.
      const history: ChatMessage[] = replayWindow(messages).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      setMessages((prev) => [
        ...prev,
        { id: msgId(), role: 'user', text: trimmed },
        { id: msgId(), role: 'assistant', text: '', pending: true },
      ]);
      setBusy(true);
      try {
        const response = await window.api.studioAgentSend({
          projectId: opts.projectId,
          projectName: opts.projectName,
          prompt: trimmed,
          history,
          assets: opts.assets.map(toAgentAsset),
          shots: opts.shots,
          reviewOpen: opts.reviewOpen,
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
      }
    },
    [busy, messages, patchPending],
  );

  const cancel = useCallback(() => {
    void window.api.studioAgentCancel({ projectId: optionsRef.current.projectId });
  }, []);

  /** "New conversation" (Q1d): rotate the transcript aside on disk (newest 3
   *  rotations kept), then clear the panel. Restart is no longer a reset, so
   *  reset must be a choice. */
  const clear = useCallback(() => {
    if (busy) return;
    void window.api
      .studioAgentChatReset({ projectId: optionsRef.current.projectId })
      .then(() => setMessages([]));
  }, [busy]);

  // Every turn is a fresh run: the agent re-reads ready transcripts via tools
  // and carries the chat text as history — so those two are what grow the
  // context. chars/4 is the usual rough token heuristic. Only the REPLAYED
  // window counts (Q1d): a long persisted transcript beyond the cap is never
  // sent, so it must not inflate the warning.
  const contextUsage: AgentContextUsage = useMemo(() => {
    const historyChars = replayWindow(messages).reduce((n, m) => n + m.text.length, 0);
    const transcriptWords = options.assets.reduce(
      (n, a) => n + (a.transcript?.status === 'ready' ? (a.transcript.wordCount ?? 0) : 0),
      0,
    );
    const estTokens =
      BASE_OVERHEAD_TOKENS +
      Math.ceil(historyChars / 4) +
      transcriptWords * TOKENS_PER_TRANSCRIPT_WORD;
    return { estTokens, ratio: estTokens / CONTEXT_BUDGET_TOKENS };
  }, [messages, options.assets]);

  return { messages, busy, send, cancel, clear, contextUsage, toolsAvailable };
}

export type UseStudioAgentResult = ReturnType<typeof useStudioAgent>;
