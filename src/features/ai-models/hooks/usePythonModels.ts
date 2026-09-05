import { useCallback, useEffect, useRef, useState } from 'react';
import type { DownloadProgressEvent, PythonModelCategoryIpc, PythonModelStatusIpc } from '@shared/ipc/types';
import type { ModelDownloadStatus } from './useImageLibrary';

const DOWNLOAD_TYPE = 'python-model';

function mapDownloadStatus(status: string): ModelDownloadStatus['status'] {
  return (['downloading', 'paused', 'extracting', 'queued'] as const).find((s) => s === status) ?? 'queued';
}

function fileLabelOf(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata?.fileLabel) return undefined;
  return metadata.fileStep ? `${metadata.fileLabel} (${metadata.fileStep})` : metadata.fileLabel;
}

function isLastFile(metadata: Record<string, string> | undefined): boolean {
  const step = metadata?.fileStep;
  if (!step) return true;
  const [current, total] = step.split('/');
  return current === total;
}

/**
 * Catalogue state for runtime-backed models (the Image tab's "Image tools" section, the
 * 3D tab): status rows from main, per-model download progress from the download engine
 * (metadata.type 'python-model'), and a refresh whenever the runtime status changes so
 * the "needs AI runtime" badge follows the System row.
 */
export function usePythonModels(category?: PythonModelCategoryIpc) {
  const [models, setModels] = useState<PythonModelStatusIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloads, setDownloads] = useState<Record<string, ModelDownloadStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.pythonModelStatus(category ? { category } : {});
      if (!mounted.current) return;
      if (res.success) setModels(res.models);
      else setError(res.error ?? 'Failed to read the model catalogue');
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Failed to read the model catalogue');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      await refresh();
      const all = await window.api.downloadGetAll();
      if (!mounted.current) return;
      const restored: Record<string, ModelDownloadStatus> = {};
      for (const d of all.downloads) {
        if (d.metadata?.type !== DOWNLOAD_TYPE || !d.metadata.modelId) continue;
        if (['completed', 'failed', 'cancelled'].includes(d.status)) continue;
        restored[d.metadata.modelId] = {
          progress: d.percent, speedBps: d.speedBps, etaSeconds: d.etaSeconds,
          status: mapDownloadStatus(d.status), error: null, label: fileLabelOf(d.metadata), taskId: d.id,
        };
      }
      if (Object.keys(restored).length > 0) setDownloads(restored);
    })();
    const unsubRuntime = window.api.onAiRuntimeStatusChanged(() => void refresh());
    const unsubProgress = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      if (event.metadata?.type !== DOWNLOAD_TYPE) return;
      const modelId = event.metadata.modelId;
      if (!modelId) return;
      if (event.status === 'completed') {
        if (isLastFile(event.metadata)) {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
        }
        void refresh();
        return;
      }
      if (event.status === 'failed' || event.status === 'cancelled') {
        if (event.status === 'failed') setError(event.error || 'Download failed');
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
        void refresh();
        return;
      }
      setDownloads((prev) => ({
        ...prev,
        [modelId]: {
          progress: event.percent >= 0 ? event.percent : prev[modelId]?.progress ?? 0,
          speedBps: event.speedBps, etaSeconds: event.etaSeconds,
          status: mapDownloadStatus(event.status), error: null, label: fileLabelOf(event.metadata), taskId: event.id,
        },
      }));
    });
    return () => {
      mounted.current = false;
      unsubRuntime();
      unsubProgress();
    };
  }, [refresh]);

  const download = useCallback(async (modelId: string) => {
    if (downloads[modelId]) return;
    setDownloads((prev) => ({ ...prev, [modelId]: { progress: 0, speedBps: 0, etaSeconds: -1, status: 'queued', error: null } }));
    setError(null);
    const res = await window.api.pythonModelDownload({ modelId });
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
    if (!res.success) setError(res.error ?? 'Download failed');
    await refresh();
  }, [downloads, refresh]);

  /** Runtime install (if needed) + model download in one go — the "needs AI runtime" button. */
  const installAll = useCallback(async (modelId: string, variant?: 'cu126' | 'cpu') => {
    setError(null);
    const res = await window.api.pythonModelInstall({ modelId, variant });
    if (!res.success) setError(res.error ?? 'Install failed');
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (modelId: string) => {
    const res = await window.api.pythonModelRemove({ modelId });
    if (!res.success) setError(res.error ?? 'Remove failed');
    await refresh();
  }, [refresh]);

  const taskIdOf = useCallback((modelId: string) => downloads[modelId]?.taskId, [downloads]);
  const pauseDownload = useCallback(async (modelId: string) => {
    const id = taskIdOf(modelId);
    if (id) await window.api.downloadPause({ id });
  }, [taskIdOf]);
  const resumeDownload = useCallback(async (modelId: string) => {
    const id = taskIdOf(modelId);
    if (id) await window.api.downloadResume({ id });
  }, [taskIdOf]);
  const cancelDownload = useCallback(async (modelId: string) => {
    await window.api.pythonModelCancelDownload({ modelId });
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
    await refresh();
  }, [refresh]);

  const openExternal = useCallback((url: string) => window.api.appOpenExternal({ url }), []);

  return { models, loading, downloads, error, refresh, download, installAll, remove, pauseDownload, resumeDownload, cancelDownload, openExternal, clearError: () => setError(null) };
}
