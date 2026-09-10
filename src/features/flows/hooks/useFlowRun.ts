// A run as the canvas sees it (flows plan §1.3, W8 Stage 1): started,
// cancelled and resumed over IPC, its node statuses streamed on
// FLOWS_RUN_EVENT, its artifacts and preview urls fetched when it settles
// or when a past run is picked from the history. The runner lives in main;
// nothing here executes a node.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AgentArtifact } from '@shared/types/agents';
import type { FlowNodeRunState, FlowRunDocStatus, FlowRunEvent } from '@shared/types/flows';

export type RunStatus = FlowRunDocStatus | 'idle';

export interface RunState {
  runId: string | null;
  status: RunStatus;
  nodes: Record<string, FlowNodeRunState>;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  /** Not running and at least one node is not done — Resume is offered. */
  resumable: boolean;
  artifacts: AgentArtifact[];
  /** Artifact id → servable urls, for the node previews. */
  assetUrls: Record<string, string[]>;
}

const INITIAL_RUN_STATE: RunState = {
  runId: null,
  status: 'idle',
  nodes: {},
  startedAt: null,
  finishedAt: null,
  error: null,
  resumable: false,
  artifacts: [],
  assetUrls: {},
};

const TERMINAL: ReadonlySet<RunStatus> = new Set(['success', 'error', 'cancelled']);

export function isRunActive(status: RunStatus): boolean {
  return status === 'queued' || status === 'running' || status === 'paused';
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

  /** The full record from main: statuses, artifacts, urls, resumability. */
  const hydrate = useCallback(async (runId: string) => {
    const res = await window.api.flowsRunGet({ runId });
    if (!res.success || !res.run) {
      setRunState((prev) => ({ ...prev, error: res.error ?? 'Failed to load the run' }));
      return;
    }
    runIdRef.current = runId;
    setRunState({
      runId,
      status: res.run.status,
      nodes: res.run.nodes,
      startedAt: res.run.startedAt,
      finishedAt: res.run.finishedAt,
      error: res.run.error,
      resumable: res.resumable ?? false,
      artifacts: res.artifacts ?? [],
      assetUrls: res.assetUrls ?? {},
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
      if (event.kind === 'run-status') {
        setRunState((prev) => ({
          ...prev,
          status: event.status,
          error: event.error ?? (event.status === 'error' ? prev.error : null),
          finishedAt: TERMINAL.has(event.status) ? Date.now() : prev.finishedAt,
        }));
        if (TERMINAL.has(event.status)) {
          void hydrate(event.runId).finally(() => onRunSettledRef.current?.());
        }
      }
    });
    return off;
  }, [hydrate]);

  const run = useCallback(async () => {
    setRunState({ ...INITIAL_RUN_STATE, status: 'queued', startedAt: Date.now() });
    const res = await window.api.flowsRunStart({ flowId, mode: 'unattended', params: {} });
    if (!res.success || !res.runId) {
      runIdRef.current = null;
      setRunState({ ...INITIAL_RUN_STATE, status: 'error', error: res.error ?? 'The run could not start' });
      onRunSettledRef.current?.();
      return;
    }
    runIdRef.current = res.runId;
    setRunState((prev) => ({ ...prev, runId: res.runId ?? null }));
    onRunSettledRef.current?.();
  }, [flowId]);

  const cancel = useCallback(() => {
    const runId = runIdRef.current;
    if (!runId) return;
    void window.api.flowsRunCancel({ runId }).catch(() => {});
  }, []);

  const resume = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;
    setRunState((prev) => ({ ...prev, status: 'queued', error: null, resumable: false }));
    const res = await window.api.flowsRunResume({ runId });
    if (!res.success) {
      setRunState((prev) => ({ ...prev, status: 'error', error: res.error ?? 'Resume failed', resumable: true }));
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current = null;
    setRunState(INITIAL_RUN_STATE);
  }, []);

  return { runState, run, cancel, resume, reset, hydrate };
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
