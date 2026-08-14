// Chat state for the Assistant tab. Sends turns to the main-process editing
// agent over IPC, folds the push stream (text deltas, tool activity, the cut
// proposal) into the message list, and hands proposals up to the caller — the
// caller dispatches `proposal-add`, so agent cuts land in the exact same
// review flow as Auto Cut.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, StudioAgentAssetInfo } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioProposal } from '../types';

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

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Tool activity shown as chips above the reply. */
  toolCalls?: AgentToolCall[];
  /** Set when this turn produced a cut proposal. */
  proposalNote?: string;
  error?: boolean;
  pending?: boolean;
}

export interface UseStudioAgentOptions {
  projectId: string;
  projectName: string;
  assets: StudioMediaAsset[];
  /** A cut proposal is open in the review panel. */
  reviewOpen: boolean;
  providerId?: string | undefined;
  model?: string | undefined;
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

  // The event stream and send() need the latest options without resubscribing.
  const optionsRef = useRef(options);
  optionsRef.current = options;

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

      const history: ChatMessage[] = messages
        .filter((m) => !m.error && m.text.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.text }));

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
          reviewOpen: opts.reviewOpen,
          ...(opts.providerId ? { providerId: opts.providerId } : {}),
          ...(opts.model ? { model: opts.model } : {}),
        });
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

  const clear = useCallback(() => {
    if (!busy) setMessages([]);
  }, [busy]);

  // Every turn is a fresh run: the agent re-reads ready transcripts via tools
  // and carries the chat text as history — so those two are what grow the
  // context. chars/4 is the usual rough token heuristic.
  const contextUsage: AgentContextUsage = useMemo(() => {
    const historyChars = messages.reduce((n, m) => n + m.text.length, 0);
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

  return { messages, busy, send, cancel, clear, contextUsage };
}

export type UseStudioAgentResult = ReturnType<typeof useStudioAgent>;
