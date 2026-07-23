import { useState, useEffect, useCallback, useRef } from 'react';
import type { EmbeddingModelIpc, DownloadProgressEvent } from '../../../shared/ipc/types';

export interface ModelDownloadStatus {
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: 'downloading' | 'paused' | 'extracting' | 'queued';
  error: string | null;
}

export function useEmbeddingModels() {
  const [models, setModels] = useState<EmbeddingModelIpc[]>([]);
  const [loading, setLoading] = useState(true);
  /** Per-model download status, keyed by modelId */
  const [downloads, setDownloads] = useState<Record<string, ModelDownloadStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const unsubDownloadRef = useRef<(() => void) | null>(null);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const [modelsResult, downloadsResult] = await Promise.all([
        window.api.embeddingModelsList(),
        window.api.downloadGetAll(),
      ]);
      setModels(modelsResult.models);

      // Restore download status for any active embedding downloads
      const restored: Record<string, ModelDownloadStatus> = {};
      for (const d of downloadsResult.downloads) {
        if (d.metadata?.type !== 'embedding-model') continue;
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

  // Subscribe to download manager progress (single download ID per model)
  useEffect(() => {
    unsubDownloadRef.current = window.api.onDownloadProgress(
      (event: DownloadProgressEvent) => {
        if (event.metadata?.type !== 'embedding-model') return;

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
      if (downloads[modelId]) return; // already downloading this model

      setDownloads((prev) => ({
        ...prev,
        [modelId]: { progress: 0, speedBps: 0, etaSeconds: -1, status: 'queued', error: null },
      }));
      setError(null);

      try {
        const result = await window.api.embeddingModelDownload({ modelId });
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
    await window.api.downloadPause({ id: `embedding-model-${modelId}` });
  }, []);

  const resumeDownload = useCallback(async (modelId: string) => {
    await window.api.downloadResume({ id: `embedding-model-${modelId}` });
  }, []);

  const cancelDownload = useCallback(async (modelId: string) => {
    await window.api.downloadCancel({ id: `embedding-model-${modelId}` });
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      const result = await window.api.embeddingModelDelete({ modelId });
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
    models,
    loading,
    downloads,
    activeCount,
    error,
    downloadModel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteModel,
    clearError: () => setError(null),
    reload: loadModels,
  };
}
