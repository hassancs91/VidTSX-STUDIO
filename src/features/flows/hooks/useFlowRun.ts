// A run as the renderer sees it (flows plan §1.3–§1.4, W8 Stages 1–2):
// started with params, a mode and a brand, cancelled, resumed and answered
// over IPC, its node statuses streamed on FLOWS_RUN_EVENT, its artifacts and
// preview urls fetched when it settles, pauses, or when a past run is picked
// from the history. The runner lives in main; nothing here executes a node.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AgentArtifact, InteractionReply, InteractionRequest } from '@shared/types/agents';
import type { FlowNodeRunState, FlowRunDocStatus, FlowRunEvent, FlowRunMode } from '@shared/types/flows';

export type RunStatus = FlowRunDocStatus | 'idle';

/** The checkpoint card the run is waiting on (Stage 2). */
export interface PendingCheckpoint {
  nodeId: string;
  request: InteractionRequest;
  /** Read back from `run.json` rather than seen arriving — asked before a reload. */
  restored: boolean;
}

export interface RunState {
  runId: string | null;
  status: RunStatus;
  mode: FlowRunMode;
  nodes: Record<string, FlowNodeRunState>;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  /** Not running and at least one node is not done — Resume is offered. */
  resumable: boolean;
  artifacts: AgentArtifact[];
  /** Artifact id → servable urls, for the node previews and the pick card. */
  assetUrls: Record<string, string[]>;
  pending: PendingCheckpoint | null;
  /** A reply is in flight — the card locks rather than double-sends. */
  replying: boolean;
}

const INITIAL_RUN_STATE: RunState = {
  runId: null,
  status: 'idle',
  mode: 'unattended',
  nodes: {},
  startedAt: null,
  finishedAt: null,
  error: null,
  resumable: false,
  artifacts: [],
  assetUrls: {},
  pending: null,
  replying: false,
};

const TERMINAL: ReadonlySet<RunStatus> = new Set(['success', 'error', 'cancelled']);

export function isRunActive(status: RunStatus): boolean {
  return status === 'queued' || status === 'running' || status === 'paused';
}

export interface RunOptions {
  mode?: FlowRunMode;
  params?: Record<string, unknown>;
  /** Absent = library default, null = no brand (§0.1 item 9). */
  brandId?: string | null;
}

interface UseFlowRunOpts {
  flowId: string;
  /** Called when a run settles, so the history dropdown can refresh. */
  onRunSettled?: () => void;
}

export function useFlowRun({ flowId, onRunSettled }: UseFlowRunOpts) {
  const [runState, setRunState] = useState<RunState>(INITIAL_RUN_STATE);
  const runIdRef = useRef<string | null>(null);
  const onRunSettledRef = useRef(onRunSettled);
  useEffect(() => {
    onRunSettledRef.current = onRunSettled;
  }, [onRunSettled]);

  /** The full record from main: statuses, artifacts, urls, resumability, the pending card. */
  const hydrate = useCallback(async (runId: string) => {
    const res = await window.api.flowsRunGet({ runId });
    if (!res.success || !res.run) {
      setRunState((prev) => ({ ...prev, error: res.error ?? 'Failed to load the run' }));
      return;
    }
    runIdRef.current = runId;
    const pending = res.run.pending;
    setRunState({
      runId,
      status: res.run.status,
      mode: res.run.mode,
      nodes: res.run.nodes,
      startedAt: res.run.startedAt,
      finishedAt: res.run.finishedAt,
      error: res.run.error,
      resumable: res.resumable ?? false,
      artifacts: res.artifacts ?? [],
      assetUrls: res.assetUrls ?? {},
      pending:
        pending?.request && !pending.expired && res.run.status === 'paused'
          ? { nodeId: pending.nodeId, request: pending.request, restored: true }
          : null,
      replying: false,
    });
  }, []);

  // The event stream: only this run's events are folded in.
  useEffect(() => {
    const off = window.api.onFlowsRunEvent((event: FlowRunEvent) => {
      if (event.runId !== runIdRef.current) return;
      if (event.kind === 'node-status') {
        setRunState((prev) => ({ ...prev, nodes: { ...prev.nodes, [event.nodeId]: event.state } }));
        return;
      }
      if (event.kind === 'pause-request') {
        setRunState((prev) => ({
          ...prev,
          status: 'paused',
          pending: { nodeId: event.nodeId, request: event.request, restored: false },
          replying: false,
        }));
        // The card's candidates were filed just now — fetch their preview urls.
        void window.api.flowsRunGet({ runId: event.runId }).then((res) => {
          if (!res.success) return;
          setRunState((prev) =>
            prev.runId === event.runId
              ? { ...prev, artifacts: res.artifacts ?? prev.artifacts, assetUrls: res.assetUrls ?? prev.assetUrls }
              : prev,
          );
        });
        return;
      }
      if (event.kind === 'pause-cleared') {
        setRunState((prev) =>
          prev.pending?.request.id === event.requestId ? { ...prev, pending: null, replying: false } : prev,
        );
        return;
      }
      if (event.kind === 'run-status') {
        setRunState((prev) => ({
          ...prev,
          status: event.status,
          error: event.error ?? (event.status === 'error' ? prev.error : null),
          finishedAt: TERMINAL.has(event.status) ? Date.now() : prev.finishedAt,
          pending: event.status === 'paused' ? prev.pending : null,
        }));
        if (TERMINAL.has(event.status)) {
          void hydrate(event.runId).finally(() => onRunSettledRef.current?.());
        }
      }
    });
    return off;
  }, [hydrate]);

  const run = useCallback(
    async (options: RunOptions = {}) => {
      const mode = options.mode ?? 'unattended';
      setRunState({ ...INITIAL_RUN_STATE, status: 'queued', mode, startedAt: Date.now() });
      const res = await window.api.flowsRunStart({
        flowId,
        mode,
        params: options.params ?? {},
        ...(options.brandId !== undefined ? { brandId: options.brandId } : {}),
      });
      if (!res.success || !res.runId) {
        runIdRef.current = null;
        setRunState({ ...INITIAL_RUN_STATE, status: 'error', error: res.error ?? 'The run could not start' });
        onRunSettledRef.current?.();
        return;
      }
      runIdRef.current = res.runId;
      setRunState((prev) => ({ ...prev, runId: res.runId ?? null }));
      onRunSettledRef.current?.();
    },
    [flowId],
  );

  const cancel = useCallback(() => {
    const runId = runIdRef.current;
    if (!runId) return;
    void window.api.flowsRunCancel({ runId }).catch(() => {});
  }, []);

  const resume = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    setRunState((prev) => ({ ...prev, status: 'queued', error: null, resumable: false, pending: null }));
    const res = await window.api.flowsRunResume({ runId });
    if (!res.success) {
      setRunState((prev) => ({ ...prev, status: 'error', error: res.error ?? 'Resume failed', resumable: true }));
    }
  }, []);

  /** Answer the pending card. The card clears on the `pause-cleared` event. */
  const reply = useCallback(async (reply: InteractionReply): Promise<string | null> => {
    const runId = runIdRef.current;
    if (!runId) return 'No run is open.';
    setRunState((prev) => ({ ...prev, replying: true }));
    const res = await window.api.flowsRunReply({ runId, reply });
    if (!res.success) {
      setRunState((prev) => ({ ...prev, replying: false }));
      return res.error ?? 'The answer did not reach the run.';
    }
    return null;
  }, []);

  const reset = useCallback(() => {
    runIdRef.current = null;
    setRunState(INITIAL_RUN_STATE);
  }, []);

  return { runState, run, cancel, resume, reply, reset, hydrate };
}

// ---------------------------------------------------------------------------
// Per-node consumption via context (CustomNode subscribes to its slice).
// ---------------------------------------------------------------------------

const RunStateContext = createContext<RunState>(INITIAL_RUN_STATE);

export const RunStateProvider = RunStateContext.Provider;

const IDLE_NODE: FlowNodeRunState = { status: 'idle', attempts: 0 };

export function useNodeRunState(nodeId: string): FlowNodeRunState {
  return useContext(RunStateContext).nodes[nodeId] ?? IDLE_NODE;
}

export function useRunArtifacts(): Pick<RunState, 'artifacts' | 'assetUrls'> {
  const { artifacts, assetUrls } = useContext(RunStateContext);
  return { artifacts, assetUrls };
}
