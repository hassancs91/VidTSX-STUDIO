import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiRuntimeStatus, AiRuntimeVariant, DownloadProgressEvent } from '../../../shared/ipc/types';
import type { ModelDownloadStatus } from './useImageLibrary';

const RUNTIME_DOWNLOAD_TYPE = 'ai-runtime';
const ACTIVE = new Set(['queued', 'downloading', 'paused', 'verifying', 'extracting']);

function toDownloadStatus(p: DownloadProgressEvent): ModelDownloadStatus {
  const status: ModelDownloadStatus['status'] =
    p.status === 'paused' ? 'paused'
      : p.status === 'extracting' || p.status === 'verifying' ? 'extracting'
        : p.status === 'downloading' ? 'downloading'
          : 'queued';
  return {
    progress: p.percent < 0 ? 0 : p.percent,
    speedBps: p.speedBps,
    etaSeconds: p.etaSeconds,
    status,
    error: p.error ?? null,
    label: p.status === 'verifying' ? 'Checking' : p.status === 'extracting' ? 'Extracting' : undefined,
    taskId: p.id,
  };
}

/**
 * System tab "AI Runtime" row state: the main-process status snapshot (pushed on
 * every phase change) plus the live download-engine progress for the runtime zip.
 */
export function useAiRuntime() {
  const [status, setStatus] = useState<AiRuntimeStatus | null>(null);
  const [download, setDownload] = useState<ModelDownloadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [res, all] = await Promise.all([window.api.aiRuntimeStatus(), window.api.downloadGetAll()]);
      if (!mounted.current) return;
      if (res.success && res.status) {
        setStatus(res.status);
        setError(null);
      } else {
        setError(res.error ?? 'Failed to read the AI runtime status');
      }
      const active = all.downloads.find((d) => d.metadata?.type === RUNTIME_DOWNLOAD_TYPE && ACTIVE.has(d.status));
      setDownload(active ? toDownloadStatus(active) : null);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Failed to read the AI runtime status');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsubStatus = window.api.onAiRuntimeStatusChanged((next) => {
      setStatus(next);
      if (!next.install) setDownload(null);
    });
    const unsubProgress = window.api.onDownloadProgress((p) => {
      if (p.metadata?.type !== RUNTIME_DOWNLOAD_TYPE) return;
      if (ACTIVE.has(p.status)) setDownload(toDownloadStatus(p));
      else setDownload(null);
    });
    return () => {
      mounted.current = false;
      unsubStatus();
      unsubProgress();
    };
  }, [refresh]);

  const install = useCallback(async (variant?: AiRuntimeVariant) => {
    const res = await window.api.aiRuntimeInstall(variant ? { variant } : {});
    if (!res.success) setError(res.error ?? 'Failed to start the install');
    await refresh();
  }, [refresh]);

  const repair = useCallback(async () => {
    const res = await window.api.aiRuntimeRepair();
    if (!res.success) setError(res.error ?? 'Failed to start the repair');
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (includeModels = false) => {
    const res = await window.api.aiRuntimeRemove({ includeModels });
    if (!res.success) setError(res.error ?? 'Failed to remove the runtime');
    await refresh();
  }, [refresh]);

  const pause = useCallback(async () => {
    const id = download?.taskId ?? status?.install?.downloadId;
    if (id) await window.api.downloadPause({ id }).catch(() => {});
  }, [download, status]);

  const resume = useCallback(async () => {
    const id = download?.taskId ?? status?.install?.downloadId;
    if (id) await window.api.downloadResume({ id }).catch(() => {});
  }, [download, status]);

  const cancel = useCallback(async () => {
    const id = download?.taskId ?? status?.install?.downloadId;
    if (id) await window.api.downloadCancel({ id }).catch(() => {});
    setDownload(null);
    await refresh();
  }, [download, status, refresh]);

  return { status, download, error, loading, refresh, install, repair, remove, pause, resume, cancel };
}
