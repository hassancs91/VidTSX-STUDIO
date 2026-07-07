import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  StudioAutoCutProgress,
  StudioAutoCutStage,
  StudioCutPlan,
} from '@shared/ipc/types';

export type AutoCutStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface AutoCutProgressState {
  stage: StudioAutoCutStage;
  percent: number;
  message: string;
}

export interface UseAutoCutResult {
  status: AutoCutStatus;
  progress: AutoCutProgressState | null;
  error: string | null;
  result: {
    cutPlan: StudioCutPlan;
    workspaceDir?: string;
  } | null;
  run: (args: { projectId: string; brand?: string }) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useAutoCut(): UseAutoCutResult {
  const [status, setStatus] = useState<AutoCutStatus>('idle');
  const [progress, setProgress] = useState<AutoCutProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UseAutoCutResult['result']>(null);
  const activeProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = window.api.onStudioAutoCutProgress((p: StudioAutoCutProgress) => {
      if (p.projectId !== activeProjectIdRef.current) return;
      setProgress({ stage: p.stage, percent: p.percent, message: p.message });
    });
    return unsub;
  }, []);

  const run = useCallback<UseAutoCutResult['run']>(async ({ projectId, brand }) => {
    if (status === 'running') return;
    activeProjectIdRef.current = projectId;
    setStatus('running');
    setProgress({ stage: 'plan', percent: 0, message: 'Starting…' });
    setError(null);
    setResult(null);

    try {
      const response = await window.api.studioAutoCutRun({ projectId, brand });
      if (response.cancelled) {
        setStatus('cancelled');
        return;
      }
      if (!response.success || !response.cutPlan) {
        setStatus('error');
        setError(response.error ?? 'Auto-cut failed');
        return;
      }
      setResult({ cutPlan: response.cutPlan, workspaceDir: response.workspaceDir });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Auto-cut failed');
    } finally {
      activeProjectIdRef.current = null;
    }
  }, [status]);

  const cancel = useCallback(() => {
    const projectId = activeProjectIdRef.current;
    if (!projectId) return;
    window.api.studioAutoCutCancel({ projectId }).catch(() => {
      /* best effort */
    });
  }, []);

  const reset = useCallback(() => {
    if (status === 'running') return;
    setStatus('idle');
    setProgress(null);
    setError(null);
    setResult(null);
  }, [status]);

  return { status, progress, error, result, run, cancel, reset };
}
