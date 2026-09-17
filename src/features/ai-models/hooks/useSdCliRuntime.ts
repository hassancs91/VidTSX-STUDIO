import { useCallback, useEffect, useRef, useState } from 'react';
import type { DownloadProgressEvent } from '@shared/ipc/types';
import type { ModelDownloadStatus } from './useImageLibrary';

const ENGINE_DOWNLOAD_TYPE = 'sdcli-binary';
const FINISHED = new Set(['completed', 'failed', 'cancelled']);

function mapDownloadStatus(status: string): ModelDownloadStatus['status'] {
  return (['downloading', 'paused', 'extracting', 'queued'] as const).find((s) => s === status) ?? 'queued';
}

export interface SdCliRuntimeState {
  /** True until the first status read answers. */
  loading: boolean;
  installed: boolean;
  /** In-flight engine download, or null when idle. */
  install: ModelDownloadStatus | null;
  error: string | null;
  /** One-click install of the pinned stable-diffusion.cpp release (~36 MB, official upstream). */
  installCli: () => Promise<void>;
  clearError: () => void;
}

/**
 * sd-cli (stable-diffusion.cpp) runtime state for the Image and Video status
 * strips: installed?, plus the one-click install with its progress from the
 * global download broadcast (metadata.type 'sdcli-binary'). One hook for both
 * pages — the engine is shared, and an install started on one page keeps
 * filling the bar on the other.
 */
export function useSdCliRuntime(): SdCliRuntimeState {
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [install, setInstall] = useState<ModelDownloadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const installRef = useRef<ModelDownloadStatus | null>(null);
  installRef.current = install;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [status, all] = await Promise.all([window.api.sdImageStatus(), window.api.downloadGetAll()]);
        if (cancelled) return;
        setInstalled(status.sdCliInstalled);
        // An in-flight engine install survives a remount → restore its bar.
        const active = all.downloads.find(
          (d) => d.metadata?.type === ENGINE_DOWNLOAD_TYPE && !FINISHED.has(d.status),
        );
        if (active) {
          setInstall({
            progress: active.percent,
            speedBps: active.speedBps,
            etaSeconds: active.etaSeconds,
            status: mapDownloadStatus(active.status),
            error: null,
            taskId: active.id,
          });
        }
      } catch {
        // leave the defaults — the strip shows "Not installed"
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const unsubscribe = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      if (event.metadata?.type !== ENGINE_DOWNLOAD_TYPE) return;
      if (event.status === 'completed') {
        setInstall(null);
        setInstalled(true);
        return;
      }
      if (event.status === 'failed' || event.status === 'cancelled') {
        if (event.status === 'failed') setError(event.error || 'Engine download failed');
        setInstall(null);
        return;
      }
      setInstall((prev) => ({
        progress: event.percent >= 0 ? event.percent : (prev?.progress ?? 0),
        speedBps: event.speedBps,
        etaSeconds: event.etaSeconds,
        status: mapDownloadStatus(event.status),
        error: null,
        taskId: event.id,
      }));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const installCli = useCallback(async () => {
    if (installRef.current) return;
    setInstall({ progress: 0, speedBps: 0, etaSeconds: -1, status: 'queued', error: null });
    setError(null);
    try {
      const result = await window.api.sdImageCliInstall();
      if (!result.success) {
        setInstall(null);
        setError(result.error || 'Engine install failed');
        return;
      }
      // The invoke resolves after download + extract, so this also covers a
      // missed 'completed' broadcast (e.g. remount mid-install).
      setInstall(null);
      setInstalled(true);
    } catch (err) {
      setInstall(null);
      setError(err instanceof Error ? err.message : 'Engine install failed');
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { loading, installed, install, error, installCli, clearError };
}
