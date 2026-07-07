import { useCallback, useEffect, useState } from 'react';
import type { FlowRunRecord, FlowRunSummary } from '@shared/ipc/types';

interface UseFlowRunsResult {
  runs: FlowRunSummary[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  refresh: () => Promise<void>;
  loadRun: (id: string) => Promise<FlowRunRecord | null>;
}

export function useFlowRuns(flowId: string | null): UseFlowRunsResult {
  const [runs, setRuns] = useState<FlowRunSummary[]>([]);
  const [status, setStatus] = useState<UseFlowRunsResult['status']>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!flowId) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await window.api.flowsRunList({ flowId });
      if (!res.success) {
        setError(res.error ?? 'Failed to load runs');
        setStatus('error');
        return;
      }
      setRuns(res.runs ?? []);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
      setStatus('error');
    }
  }, [flowId]);

  const loadRun = useCallback(async (id: string): Promise<FlowRunRecord | null> => {
    try {
      const res = await window.api.flowsRunLoad({ id });
      if (!res.success || !res.run) return null;
      return res.run;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (flowId) void refresh();
    else {
      setRuns([]);
      setStatus('idle');
    }
  }, [flowId, refresh]);

  return { runs, status, error, refresh, loadRun };
}
