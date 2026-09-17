import { useCallback, useEffect, useRef, useState } from 'react';
import type { DownloadProgressEvent, SystemRuntimeId, SystemRuntimeIpc, WhisperProgressEvent } from '@shared/ipc/types';

/** Download metadata.type per runtime on the global broadcast (whisper reports on its own channel). */
const DOWNLOAD_TYPE_BY_ID: Partial<Record<SystemRuntimeId, string>> = {
  'sd-cli': 'sdcli-binary',
  'ffmpeg-full': 'ffmpeg-full',
};

export interface RuntimeInstallProgress {
  /** 0–100; null while queued or extracting. */
  percent: number | null;
  label: string;
}

export interface SystemRuntimesState {
  runtimes: SystemRuntimeIpc[] | null;
  loading: boolean;
  error: string | null;
  /** In-flight installs, keyed by runtime id. */
  installs: Partial<Record<SystemRuntimeId, RuntimeInstallProgress>>;
  install: (id: SystemRuntimeId) => Promise<void>;
  remove: (id: SystemRuntimeId) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

function runtimeIdForDownload(type: string | undefined): SystemRuntimeId | null {
  for (const [id, downloadType] of Object.entries(DOWNLOAD_TYPE_BY_ID)) {
    if (downloadType === type) return id as SystemRuntimeId;
  }
  return null;
}

/**
 * State for the Overview's Runtimes table (docs/ai-models-redesign.md §3.1):
 * the three single-binary runtimes from main, one-click Install through each
 * runtime's own install IPC, progress from the global download broadcast
 * (sd-cli, ffmpeg) or whisper's own progress channel, and Remove. The AI
 * runtime keeps `useAiRuntime`.
 */
export function useSystemRuntimes(): SystemRuntimesState {
  const [runtimes, setRuntimes] = useState<SystemRuntimeIpc[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installs, setInstalls] = useState<Partial<Record<SystemRuntimeId, RuntimeInstallProgress>>>({});
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.systemRuntimesGet();
      if (!mounted.current) return;
      if (res.success) setRuntimes(res.runtimes);
      else setError(res.error ?? 'Failed to read runtimes');
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Failed to read runtimes');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const setProgress = useCallback((id: SystemRuntimeId, progress: RuntimeInstallProgress | null) => {
    setInstalls((prev) => {
      const next = { ...prev };
      if (progress) next[id] = progress;
      else delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsubDownload = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      const id = runtimeIdForDownload(event.metadata?.type);
      if (!id) return;
      if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
        if (event.status === 'failed') setError(event.error || 'Download failed');
        setProgress(id, null);
        void refresh();
        return;
      }
      const label =
        event.status === 'extracting' ? 'Extracting…' : event.status === 'paused' ? 'Paused' : event.status === 'queued' ? 'Starting…' : `Downloading… ${Math.round(event.percent)}%`;
      setProgress(id, { percent: event.status === 'downloading' && event.percent >= 0 ? event.percent : null, label });
    });
    const unsubWhisper = window.api.onWhisperProgress((event: WhisperProgressEvent) => {
      if (event.type !== 'binary') return;
      setProgress('whisper-cpp', { percent: event.percent, label: `Downloading… ${Math.round(event.percent)}%` });
    });
    return () => {
      mounted.current = false;
      unsubDownload();
      unsubWhisper();
    };
  }, [refresh, setProgress]);

  const install = useCallback(
    async (id: SystemRuntimeId) => {
      setError(null);
      setProgress(id, { percent: null, label: 'Starting…' });
      try {
        const res =
          id === 'whisper-cpp'
            ? await window.api.whisperBinaryInstall()
            : id === 'sd-cli'
              ? await window.api.sdImageCliInstall()
              : await window.api.studioProxyEncoderInstall();
        if (!res.success) setError(res.error || 'Install failed');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Install failed');
      } finally {
        setProgress(id, null);
        await refresh();
      }
    },
    [refresh, setProgress],
  );

  const remove = useCallback(
    async (id: SystemRuntimeId) => {
      setError(null);
      const res = await window.api.systemRuntimeRemove({ id });
      if (!res.success) setError(res.error ?? 'Failed to remove the runtime');
      await refresh();
    },
    [refresh],
  );

  return { runtimes, loading, error, installs, install, remove, refresh, clearError: () => setError(null) };
}
