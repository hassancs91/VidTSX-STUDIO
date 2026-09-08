// One open session: its chat, its artifacts, and the run stream that changes
// both (agents plan §1.2, §1.5, §6).
//
// The chat list here is a VIEW. Main owns `chat.json` and appends to it after
// each turn, so this hook never writes the transcript — it replays what main
// gives it on open and folds the live stream on top. That is the difference
// from `useStudioAgent`, where the renderer owns persistence.

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentArtifact,
  AgentJobRequest,
  AgentSession,
  InteractionReply,
  InteractionRequest,
} from '@shared/types/agents';
import type { AgentChatRow } from '../types';
import {
  appendDelta,
  appendToolCall,
  chatRowId,
  finishTurn,
  mergeArtifact,
  noteOnPending,
  preferredArtifactId,
  startTurn,
} from '../services/event-folding';

export interface UseAgentRunOptions {
  agentId: string;
  sessionId: string | null;
  providerId?: string;
  /** Told about a submitted render so the queue can pick it up (§1.5 step 2). */
  onJobRequest?: (request: AgentJobRequest) => void;
}

export function useAgentRun({ agentId, sessionId, providerId, onJobRequest }: UseAgentRunOptions) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<AgentChatRow[]>([]);
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingInteraction, setPendingInteraction] = useState<InteractionRequest | null>(null);
  /** The pending question came off disk, not off this run's stream (§1.5). */
  const [interactionRestored, setInteractionRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toolsAvailable, setToolsAvailable] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  // The event listener must see the current session without resubscribing on
  // every keystroke; a ref is the cheap way to keep one subscription alive.
  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;
  const jobRequestRef = useRef(onJobRequest);
  jobRequestRef.current = onJobRequest;
  /** True while the user is looking at the newest artifact — see `select`. */
  const followLatest = useRef(true);

  // ─── Open (§1.5: replay the chat, show the latest artifact) ───
  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setMessages([]);
      setArtifacts([]);
      setSelectedId(null);
      setPendingInteraction(null);
      setInteractionRestored(false);
      return;
    }
    let disposed = false;
    setLoading(true);
    followLatest.current = true;
    // A run belongs to the session that started it. Without this, switching
    // sessions — or starting a new one — while a turn is in flight carries the
    // old session's `busy` across, and the new session's composer is locked
    // behind a Stop button for a run it has nothing to do with. Found by
    // driving the app in Stage 5.
    setBusy(false);
    setToolsAvailable(undefined);
    void window.api.agentSessionLoad({ agentId, sessionId }).then((result) => {
      if (disposed) return;
      if (result.success && result.session) {
        setSession(result.session);
        setPendingInteraction(result.session.pendingInteraction ?? null);
        setInteractionRestored(result.session.pendingInteraction !== undefined);
        setMessages(
          (result.messages ?? []).map((m) => ({ id: m.id, role: m.role, text: m.text })),
        );
        const loaded = result.artifacts ?? [];
        setArtifacts(loaded);
        setSelectedId(preferredArtifactId(loaded));
      }
      setLoading(false);
    });
    return () => {
      disposed = true;
    };
  }, [agentId, sessionId]);

  // ─── The run stream ───
  useEffect(() => {
    return window.api.onAgentRunEvent((event) => {
      if (event.sessionId !== sessionIdRef.current) return;
      switch (event.kind) {
        case 'delta':
          setMessages((rows) => appendDelta(rows, event.text));
          break;
        case 'tool':
          setMessages((rows) => appendToolCall(rows, event.tool, event.detail));
          break;
        case 'progress':
          setMessages((rows) => appendToolCall(rows, event.tool, event.detail));
          break;
        case 'artifact':
        case 'artifact-updated':
          setArtifacts((prev) => {
            const next = mergeArtifact(prev, event.artifact);
            if (followLatest.current) setSelectedId(preferredArtifactId(next));
            return next;
          });
          break;
        case 'interaction':
          setPendingInteraction(event.request);
          setInteractionRestored(false);
          setMessages((rows) => noteOnPending(rows, 'Waiting for your answer.'));
          break;
        case 'interaction-cleared':
          setPendingInteraction((current) =>
            current && current.id === event.requestId ? null : current,
          );
          break;
        case 'job-request':
          jobRequestRef.current?.(event.request);
          setMessages((rows) => noteOnPending(rows, 'Queued for rendering.'));
          break;
        case 'done':
          break;
      }
    });
  }, []);

  const send = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      const id = sessionIdRef.current;
      if (!trimmed || !id || busy) return;
      setBusy(true);
      setMessages((rows) => startTurn(rows, trimmed));
      try {
        const response = await window.api.agentRunSend({
          agentId,
          sessionId: id,
          prompt: trimmed,
          ...(providerId ? { providerId } : {}),
        });
        if (response.toolsAvailable !== undefined) setToolsAvailable(response.toolsAvailable);
        setMessages((rows) =>
          finishTurn(
            rows,
            response.success
              ? { ...(response.text !== undefined ? { text: response.text } : {}) }
              : { error: response.error ?? 'The agent failed to reply.' },
          ),
        );
      } catch (err) {
        setMessages((rows) =>
          finishTurn(rows, {
            error: err instanceof Error ? err.message : 'The agent failed to reply.',
          }),
        );
      } finally {
        setBusy(false);
      }
    },
    [agentId, providerId, busy],
  );

  const cancel = useCallback(() => {
    const id = sessionIdRef.current;
    if (!id) return;
    void window.api.agentRunCancel({ agentId, sessionId: id });
  }, [agentId]);

  /** Answering IS sending under the non-blocking form (§1.5). */
  const answer = useCallback(
    async (reply: InteractionReply) => {
      const id = sessionIdRef.current;
      if (!id) return;
      setPendingInteraction(null);
      setInteractionRestored(false);
      setBusy(true);
      setMessages((rows) => [
        ...rows,
        { id: chatRowId(), role: 'assistant', text: '', pending: true },
      ]);
      try {
        await window.api.agentInteractionReply({ agentId, sessionId: id, reply });
      } finally {
        setBusy(false);
        setMessages((rows) => finishTurn(rows, {}));
      }
    },
    [agentId],
  );

  /**
   * Selecting an older artifact stops the stage from jumping to each new one;
   * selecting the newest opts back in. Without that, reading a document while
   * the agent works becomes impossible.
   */
  const select = useCallback(
    (artifactId: string) => {
      setSelectedId(artifactId);
      followLatest.current = artifactId === preferredArtifactId(artifacts);
    },
    [artifacts],
  );

  const selected = artifacts.find((a) => a.id === selectedId) ?? null;

  return {
    session,
    messages,
    artifacts,
    selected,
    select,
    pendingInteraction,
    interactionRestored,
    busy,
    loading,
    toolsAvailable,
    send,
    cancel,
    answer,
  };
}

export type UseAgentRunResult = ReturnType<typeof useAgentRun>;
