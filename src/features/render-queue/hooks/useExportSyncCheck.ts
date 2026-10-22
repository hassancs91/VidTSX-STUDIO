import { useCallback, useEffect, useRef, useState } from 'react';
import type { RenderQueueJob } from '@shared/ipc/types';
import type { SyncCheckState } from '../types';
import { syncCheckStateFromResponse } from '../services/sync-check';

/**
 * "Check A/V" for one finished Studio export row (T8, END_TO_END_PLAN A6).
 * Main runs the check (one at a time) against the row's entry sidecar — the
 * exported, range-trimmed document — and writes `<name>.sync.json` beside the
 * file; progress arrives per probe, filtered to this row's file.
 */
export function useExportSyncCheck(job: RenderQueueJob) {
  const [state, setState] = useState<SyncCheckState>({ status: 'idle' });
  const exportPath = job.outputPath;
  const entryPath = job.filePath;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const running = state.status === 'running';
  useEffect(() => {
    if (!running) return undefined;
    return window.api.onStudioExportSyncCheckProgress((event) => {
      if (event.exportPath !== exportPath) return;
      setState((prev) => (prev.status === 'running' ? { status: 'running', done: event.done, total: event.total } : prev));
    });
  }, [running, exportPath]);

  const start = useCallback(async () => {
    setState({ status: 'running', done: 0, total: 0 });
    try {
      const res = await window.api.studioExportSyncCheck({
        exportPath,
        source: { kind: 'entry', entryPath },
      });
      if (mounted.current) setState(syncCheckStateFromResponse(res));
    } catch (err) {
      if (mounted.current) {
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
  }, [exportPath, entryPath]);

  const cancel = useCallback(async () => {
    try {
      await window.api.studioExportSyncCheckCancel({ exportPath });
    } catch {
      // The check's own answer (cancelled) settles the state.
    }
  }, [exportPath]);

  const dismiss = useCallback(() => setState({ status: 'idle' }), []);

  return { state, start, cancel, dismiss };
}
