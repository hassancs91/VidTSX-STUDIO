import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  StudioAnalysisJson,
  StudioAnalyzeProgress,
  StudioAnalyzeStage,
} from '@shared/ipc/types';

export type AnalyzeStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface AnalyzeProgressState {
  stage: StudioAnalyzeStage;
  percent: number;
  message: string;
}

export interface UseAnalyzeResult {
  status: AnalyzeStatus;
  progress: AnalyzeProgressState | null;
  error: string | null;
  result: {
    analysis: StudioAnalysisJson;
    workspaceDir?: string;
  } | null;
  run: (args: { projectId: string; clipId: string; sttModelId?: string }) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useAnalyze(): UseAnalyzeResult {
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [progress, setProgress] = useState<AnalyzeProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UseAnalyzeResult['result']>(null);
  const activeProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = window.api.onStudioAnalyzeProgress((p: StudioAnalyzeProgress) => {
      if (p.projectId !== activeProjectIdRef.current) return;
      setProgress({ stage: p.stage, percent: p.percent, message: p.message });
    });
    return unsub;
  }, []);

  const run = useCallback<UseAnalyzeResult['run']>(async ({ projectId, clipId, sttModelId }) => {
    if (status === 'running') return;
    activeProjectIdRef.current = projectId;
    setStatus('running');
    setProgress({ stage: 'extract-audio', percent: 0, message: 'Starting…' });
    setError(null);
    setResult(null);

    try {
      const response = await window.api.studioAnalyzeRun({ projectId, clipId, sttModelId });
      if (response.cancelled) {
        setStatus('cancelled');
        return;
      }
      if (!response.success || !response.analysis) {
        setStatus('error');
        setError(response.error ?? 'Analyze failed');
        return;
      }
      setResult({ analysis: response.analysis, workspaceDir: response.workspaceDir });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Analyze failed');
    } finally {
      activeProjectIdRef.current = null;
    }
  }, [status]);

  const cancel = useCallback(() => {
    const projectId = activeProjectIdRef.current;
    if (!projectId) return;
    window.api.studioAnalyzeCancel({ projectId }).catch(() => {
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
