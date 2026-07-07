import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SdImageModelIpc,
  DownloadProgressEvent,
} from '../../shared/ipc/types';

export interface ModelDownloadStatus {
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: 'downloading' | 'paused' | 'extracting' | 'queued';
  error: string | null;
}

interface CliStatus {
  installed: boolean;
  path?: string;
}

export function useSdImageModels() {
  const [models, setModels] = useState<SdImageModelIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [cliStatus, setCliStatus] = useState<CliStatus>({ installed: false });
  const [downloads, setDownloads] = useState<Record<string, ModelDownloadStatus>>({});
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unsubDownloadRef = useRef<(() => void) | null>(null);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const [statusResult, modelsResult, cliResult, downloadsResult] = await Promise.all([
        window.api.sdImageStatus(),
        window.api.sdImageModelsList(),
        window.api.sdImageCliStatus(),
        window.api.downloadGetAll(),
      ]);
      setCliStatus({ installed: cliResult.installed, path: cliResult.path });
      setActiveModelId(statusResult.activeModelId);
      setModels(modelsResult.models);

      // Restore download status for any active image downloads
      const restored: Record<string, ModelDownloadStatus> = {};
      for (const d of downloadsResult.downloads) {
        if (d.metadata?.type !== 'sdimage-model') continue;
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
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Subscribe to download manager progress
  useEffect(() => {
    unsubDownloadRef.current = window.api.onDownloadProgress(
      (event: DownloadProgressEvent) => {
        if (event.metadata?.type !== 'sdimage-model') return;

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

  const activeCount = Object.keys(downloads).length;

  const downloadModel = useCallback(
    async (modelId: string) => {
      if (downloads[modelId]) return;

      setDownloads((prev) => ({
        ...prev,
        [modelId]: { progress: 0, speedBps: 0, etaSeconds: -1, status: 'queued', error: null },
      }));
      setError(null);

      try {
        const result = await window.api.sdImageModelDownload({ modelId });
        if (!result.success) {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
          setError(result.error || 'Download failed');
        }
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
    await window.api.downloadPause({ id: `sdimage-model-${modelId}` });
  }, []);

  const resumeDownload = useCallback(async (modelId: string) => {
    await window.api.downloadResume({ id: `sdimage-model-${modelId}` });
  }, []);

  const cancelDownload = useCallback(async (modelId: string) => {
    await window.api.downloadCancel({ id: `sdimage-model-${modelId}` });
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      const result = await window.api.sdImageModelDelete({ modelId });
      if (result.success) {
        setModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, downloaded: false } : m)),
        );
        if (activeModelId === modelId) {
          setActiveModelId(null);
        }
      } else {
        setError(result.error || 'Delete failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [activeModelId]);

  const setActiveModel = useCallback(async (modelId: string) => {
    try {
      const result = await window.api.sdImageSetActiveModel({ modelId });
      if (result.success) {
        setActiveModelId(modelId);
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    models,
    loading,
    cliStatus,
    downloads,
    activeCount,
    activeModelId,
    error,
    downloadModel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteModel,
    setActiveModel,
    clearError: () => setError(null),
    reload: loadModels,
  };
}
