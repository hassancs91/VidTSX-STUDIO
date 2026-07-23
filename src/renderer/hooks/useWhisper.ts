import { useState, useEffect, useCallback, useRef } from 'react';
import type { WhisperModel, WhisperProgressEvent, DownloadProgressEvent } from '../../shared/ipc/types';
import { createRendererLogger } from '../utils/logger';

const log = createRendererLogger('Whisper');

interface BinaryStatus {
  installed: boolean;
  path: string;
  installing: boolean;
  progress: number;
  error: string | null;
}

export interface WhisperDownloadStatus {
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: 'downloading' | 'paused' | 'extracting' | 'queued';
  error: string | null;
}

export function useWhisper() {
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus>({
    installed: false,
    path: '',
    installing: false,
    progress: 0,
    error: null,
  });

  const [models, setModels] = useState<WhisperModel[]>([]);
  const [loading, setLoading] = useState(true);
  /** Per-model download status, keyed by modelId */
  const [downloads, setDownloads] = useState<Record<string, WhisperDownloadStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const unsubBinaryRef = useRef<(() => void) | null>(null);
  const unsubDownloadRef = useRef<(() => void) | null>(null);

  // Load initial status
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [statusResult, modelsResult, downloadsResult] = await Promise.all([
        window.api.whisperBinaryStatus(),
        window.api.whisperModelsList(),
        window.api.downloadGetAll(),
      ]);

      setBinaryStatus((prev) => ({
        ...prev,
        installed: statusResult.installed,
        path: statusResult.path,
      }));

      setModels(modelsResult.models);

      // Restore download status for any active whisper model downloads
      const restored: Record<string, WhisperDownloadStatus> = {};
      for (const d of downloadsResult.downloads) {
        if (d.metadata?.type !== 'whisper-model') continue;
        if (d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled') continue;

        const modelId = d.metadata.modelId;
        if (!modelId) continue;

        const mappedStatus = (['downloading', 'paused', 'extracting', 'queued'] as const)
          .find((s) => s === d.status) ?? 'queued';

        restored[modelId] = {
          progress: d.percent,
          speedBps: d.speedBps,
          etaSeconds: d.etaSeconds,
          status: mappedStatus,
          error: null,
        };
      }
      if (Object.keys(restored).length > 0) {
        setDownloads(restored);
      }
    } catch (err) {
      log.error('Failed to load whisper status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to binary install progress (still uses old whisper progress channel)
  useEffect(() => {
    unsubBinaryRef.current = window.api.onWhisperProgress((event: WhisperProgressEvent) => {
      if (event.type === 'binary') {
        setBinaryStatus((prev) => ({
          ...prev,
          progress: event.percent,
        }));
      }
    });

    return () => {
      unsubBinaryRef.current?.();
    };
  }, []);

  // Subscribe to download manager progress for whisper models
  useEffect(() => {
    unsubDownloadRef.current = window.api.onDownloadProgress(
      (event: DownloadProgressEvent) => {
        if (event.metadata?.type !== 'whisper-model') return;

        const modelId = event.metadata.modelId;
        if (!modelId) return;
        const status = event.status;

        if (status === 'completed') {
          setModels((prev) =>
            prev.map((m) => (m.id === modelId ? { ...m, downloaded: true } : m)),
          );
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          return;
        }

        if (status === 'failed' || status === 'cancelled') {
          if (status === 'failed') {
            setError(event.error || 'Download failed');
          }
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          return;
        }

        const mappedStatus = (['downloading', 'paused', 'extracting', 'queued'] as const)
          .find((s) => s === status) ?? 'queued';

        setDownloads((prev) => ({
          ...prev,
          [modelId]: {
            progress: event.percent >= 0 ? event.percent : (prev[modelId]?.progress ?? 0),
            speedBps: event.speedBps,
            etaSeconds: event.etaSeconds,
            status: mappedStatus,
            error: null,
          },
        }));
      },
    );
    return () => {
      unsubDownloadRef.current?.();
    };
  }, []);

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const installBinary = useCallback(async () => {
    setBinaryStatus((prev) => ({
      ...prev,
      installing: true,
      progress: 0,
      error: null,
    }));

    try {
      const result = await window.api.whisperBinaryInstall();
      if (result.success) {
        setBinaryStatus((prev) => ({
          ...prev,
          installed: true,
          installing: false,
          progress: 100,
        }));
      } else {
        setBinaryStatus((prev) => ({
          ...prev,
          installing: false,
          error: result.error || 'Installation failed',
        }));
      }
    } catch (err) {
      setBinaryStatus((prev) => ({
        ...prev,
        installing: false,
        error: err instanceof Error ? err.message : 'Installation failed',
      }));
    }
  }, []);

  const downloadModel = useCallback(
    async (modelId: string) => {
      if (downloads[modelId]) return; // already downloading

      setDownloads((prev) => ({
        ...prev,
        [modelId]: { progress: 0, speedBps: 0, etaSeconds: -1, status: 'queued', error: null },
      }));
      setError(null);

      try {
        const result = await window.api.whisperModelDownload({ modelId });
        if (!result.success) {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          setError(result.error || 'Download failed');
          return;
        }
        // Fallback in case the 'completed' event was missed (e.g. remount)
        setModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, downloaded: true } : m)),
        );
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
      } catch (err) {
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
        setError(err instanceof Error ? err.message : 'Download failed');
      }
    },
    [downloads],
  );

  const pauseDownload = useCallback(async (modelId: string) => {
    await window.api.downloadPause({ id: `whisper-model-${modelId}` });
  }, []);

  const resumeDownload = useCallback(async (modelId: string) => {
    await window.api.downloadResume({ id: `whisper-model-${modelId}` });
  }, []);

  const cancelDownload = useCallback(async (modelId: string) => {
    await window.api.downloadCancel({ id: `whisper-model-${modelId}` });
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      const result = await window.api.whisperModelDelete({ modelId });
      if (result.success) {
        setModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, downloaded: false } : m)),
        );
      } else {
        setError(result.error || 'Delete failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, []);

  return {
    loading,
    binaryStatus,
    models,
    downloads,
    error,
    installBinary,
    downloadModel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteModel,
    clearError: () => setError(null),
    reload: loadStatus,
  };
}
