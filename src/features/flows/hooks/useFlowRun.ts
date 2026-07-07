import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ulid } from 'ulid';
import { runFlow, type NodeRunState, type RunStatus } from '../services/run-flow';
import type { GraphJson } from '../types';
import type { FlowRunStatus } from '@shared/ipc/types';

export interface RunState {
  runId: string | null;
  status: RunStatus;
  nodes: Record<string, NodeRunState>;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

const INITIAL_RUN_STATE: RunState = {
  runId: null,
  status: 'idle',
  nodes: {},
  startedAt: null,
  finishedAt: null,
  error: null,
};

interface UseFlowRunOpts {
  flowId: string;
  graph: GraphJson;
  flowName: string;
  flowFolderId: string | null;
  onRunPersisted?: (status: FlowRunStatus) => void;
}

// Maps the runner's RunStatus to the persisted FlowRunStatus.
// 'idle' is unreachable at completion time (run() always sets 'running' first).
function toPersistStatus(status: RunStatus): FlowRunStatus | null {
  if (status === 'success' || status === 'error' || status === 'cancelled' || status === 'running') {
    return status;
  }
  return null;
}

// Strip large fields from node outputs before persistence. Image base64 strings
// can be multiple MBs per node — at cap=20 runs/flow that's enough to bloat
// the SQLite row past 100 MB. We persist the gallery `imageRef` instead and
// lazy-fetch via imageStudioRead when a past run is hydrated for display.
function stripLargeFields(nodes: Record<string, NodeRunState>): Record<string, NodeRunState> {
  const out: Record<string, NodeRunState> = {};
  for (const [id, state] of Object.entries(nodes)) {
    if (state.output && typeof state.output === 'object') {
      const { image: _image, ...rest } = state.output as Record<string, unknown>;
      out[id] = { ...state, output: rest };
    } else {
      out[id] = state;
    }
  }
  return out;
}

export function useFlowRun({ flowId, graph, flowName, flowFolderId, onRunPersisted }: UseFlowRunOpts) {
  const [runState, setRunState] = useState<RunState>(INITIAL_RUN_STATE);
  const abortRef = useRef<AbortController | null>(null);
  // Active runId — used to send imageGenerateCancel to main when the user
  // cancels mid-fetch. Null between runs.
  const activeRunIdRef = useRef<string | null>(null);
  const graphRef = useRef(graph);
  const flowIdRef = useRef(flowId);
  const flowNameRef = useRef(flowName);
  const flowFolderIdRef = useRef(flowFolderId);
  const onRunPersistedRef = useRef(onRunPersisted);

  // Keep refs current so the run() closure always sees latest values
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);
  useEffect(() => {
    flowIdRef.current = flowId;
  }, [flowId]);
  useEffect(() => {
    flowNameRef.current = flowName;
  }, [flowName]);
  useEffect(() => {
    flowFolderIdRef.current = flowFolderId;
  }, [flowFolderId]);
  useEffect(() => {
    onRunPersistedRef.current = onRunPersisted;
  }, [onRunPersisted]);

  // Abort any in-flight run on unmount (also kills the active API fetch).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      const runId = activeRunIdRef.current;
      if (runId) {
        void window.api.imageGenerateCancel({ callId: runId }).catch(() => {});
      }
    };
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const runId = ulid();
    const startedAt = Date.now();
    const flowIdSnapshot = flowIdRef.current;
    activeRunIdRef.current = runId;

    setRunState({
      runId,
      status: 'running',
      nodes: {},
      startedAt,
      finishedAt: null,
      error: null,
    });

    // Track the latest state locally so we can persist it after the run resolves
    // without racing setState. setRunState batches asynchronously.
    let latestStatus: RunStatus = 'running';
    let latestError: string | null = null;
    const latestNodes: Record<string, NodeRunState> = {};

    await runFlow({
      graph: graphRef.current,
      ctx: {
        signal: controller.signal,
        runId,
        flowName: flowNameRef.current,
        flowFolderId: flowFolderIdRef.current,
      },
      onUpdate: (update) => {
        if (update.type === 'node-status') {
          latestNodes[update.nodeId] = update.state;
        } else {
          latestStatus = update.status;
          if (update.error) latestError = update.error;
        }

        setRunState((prev) => {
          if (update.type === 'node-status') {
            return {
              ...prev,
              nodes: { ...prev.nodes, [update.nodeId]: update.state },
            };
          }
          // run-status
          const finishedAt =
            update.status === 'running' ? null : Date.now();
          return {
            ...prev,
            status: update.status,
            finishedAt,
            error: update.error ?? prev.error,
          };
        });
      },
    });

    const persistStatus = toPersistStatus(latestStatus);
    if (persistStatus && persistStatus !== 'running') {
      try {
        const res = await window.api.flowsRunPersist({
          id: runId,
          flowId: flowIdSnapshot,
          status: persistStatus,
          startedAt,
          finishedAt: Date.now(),
          error: latestError,
          nodeResults: JSON.stringify(stripLargeFields(latestNodes)),
        });
        if (res.success) {
          onRunPersistedRef.current?.(persistStatus);
        }
      } catch {
        // Best-effort — surface in console; don't disturb run UI.
      }
    }
    if (activeRunIdRef.current === runId) {
      activeRunIdRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    // Tell main to abort the in-flight imageGenerate fetch (paired by runId).
    // Without this, the current node's API call would finish before the runner
    // notices the abort signal at the top of its next iteration.
    const runId = activeRunIdRef.current;
    if (runId) {
      void window.api.imageGenerateCancel({ callId: runId }).catch(() => {});
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    const runId = activeRunIdRef.current;
    if (runId) {
      void window.api.imageGenerateCancel({ callId: runId }).catch(() => {});
    }
    setRunState(INITIAL_RUN_STATE);
  }, []);

  // Hydrate state from a persisted past run (selected from history).
  const hydrate = useCallback((state: RunState) => {
    abortRef.current?.abort();
    setRunState(state);
  }, []);

  return { runState, run, cancel, reset, hydrate };
}

// ---------------------------------------------------------------------------
// Per-node consumption via context (CustomNode subscribes to its slice).
// ---------------------------------------------------------------------------

const RunStateContext = createContext<RunState>(INITIAL_RUN_STATE);

export const RunStateProvider = RunStateContext.Provider;

export function useNodeRunState(nodeId: string): NodeRunState {
  const runState = useContext(RunStateContext);
  return runState.nodes[nodeId] ?? { status: 'idle' };
}
