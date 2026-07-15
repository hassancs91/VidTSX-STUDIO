import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DownloadProgressEvent,
  ModelsScanResponse,
  ModelSetupConfig,
} from '@shared/ipc/types';

export interface ModelDownloadStatus {
  progress: number;
  speedBps: number;
  etaSeconds: number;
  status: 'downloading' | 'paused' | 'extracting' | 'queued';
  error: string | null;
}

const EMPTY_SCAN: ModelsScanResponse = {
  category: 'image',
  folder: '',
  installed: [],
  profiles: [],
  unrecognized: [],
  companions: [],
};

function mapDownloadStatus(status: string): ModelDownloadStatus['status'] {
  return (['downloading', 'paused', 'extracting', 'queued'] as const).find((s) => s === status) ?? 'queued';
}

/**
 * State for the Image models library view (design §6.2). Consumes the generic
 * `MODELS_SCAN` channel; active-model + D1 download reuse the existing sd-image
 * / download-manager plumbing.
 */
export function useImageLibrary() {
  const [scan, setScan] = useState<ModelsScanResponse>(EMPTY_SCAN);
  const [loading, setLoading] = useState(true);
  const [cliInstalled, setCliInstalled] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Record<string, ModelDownloadStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);

  const rescan = useCallback(async () => {
    const result = await window.api.modelsScan({ category: 'image' });
    setScan(result);
    if (result.error && result.error !== 'unsupported-category') setError(result.error);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [status, scanResult, downloadsResult] = await Promise.all([
        window.api.sdImageStatus(),
        window.api.modelsScan({ category: 'image' }),
        window.api.downloadGetAll(),
      ]);
      setCliInstalled(status.sdCliInstalled);
      setActiveModelId(status.activeModelId);
      setScan(scanResult);
      if (scanResult.error && scanResult.error !== 'unsupported-category') setError(scanResult.error);

      const restored: Record<string, ModelDownloadStatus> = {};
      for (const d of downloadsResult.downloads) {
        if (d.metadata?.type !== 'sdimage-model') continue;
        if (d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled') continue;
        const modelId = d.metadata.modelId;
        if (!modelId) continue;
        restored[modelId] = {
          progress: d.percent,
          speedBps: d.speedBps,
          etaSeconds: d.etaSeconds,
          status: mapDownloadStatus(d.status),
          error: null,
        };
      }
      if (Object.keys(restored).length > 0) setDownloads(restored);
    } catch {
      // ignore — leave empty scan
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Download-manager progress → drives the per-profile download UI.
  useEffect(() => {
    unsubRef.current = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      if (event.metadata?.type !== 'sdimage-model') return;
      const modelId = event.metadata.modelId;
      if (!modelId) return;

      if (event.status === 'completed') {
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
        void rescan(); // the file is now in the folder → shows up as installed
        return;
      }

      if (event.status === 'failed' || event.status === 'cancelled') {
        if (event.status === 'failed') setError(event.error || 'Download failed');
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
        return;
      }

      setDownloads((prev) => ({
        ...prev,
        [modelId]: {
          progress: event.percent >= 0 ? event.percent : prev[modelId]?.progress ?? 0,
          speedBps: event.speedBps,
          etaSeconds: event.etaSeconds,
          status: mapDownloadStatus(event.status),
          error: null,
        },
      }));
    });
    return () => unsubRef.current?.();
  }, [rescan]);

  const setActiveModel = useCallback(async (modelId: string) => {
    const result = await window.api.sdImageSetActiveModel({ modelId });
    if (result.success) setActiveModelId(modelId);
    else setError(result.error || 'Failed to set active model');
  }, []);

  const removeModel = useCallback(
    async (modelId: string) => {
      const result = await window.api.modelsRemove({ category: 'image', modelId, deleteFile: true });
      if (!result.success) {
        setError(result.error || 'Delete failed');
        return;
      }
      if (activeModelId === modelId) setActiveModelId(null);
      await rescan();
    },
    [activeModelId, rescan],
  );

  const openFolder = useCallback(async () => {
    await window.api.modelsOpenFolder({ category: 'image' });
  }, []);

  const changeFolder = useCallback(async () => {
    const picked = await window.api.dialogOpenFolder();
    if (picked.canceled || !picked.folderPath) return;
    const result = await window.api.modelsSetFolder({ category: 'image', folderPath: picked.folderPath });
    if (!result.success) {
      setError(result.error || 'Failed to change folder');
      return;
    }
    await rescan();
  }, [rescan]);

  /** Open a file picker and return the chosen model path (or null). */
  const pickModelFile = useCallback(async (): Promise<string | null> => {
    const picked = await window.api.dialogOpen({
      filters: [{ name: 'Model files', extensions: ['safetensors', 'gguf', 'ckpt'] }],
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;
    return picked.filePaths[0];
  }, []);

  const importModel = useCallback(
    async (sourcePath: string, mode: 'move' | 'copy', setup?: ModelSetupConfig) => {
      const result = await window.api.modelsImport({ category: 'image', sourcePath, mode, setup });
      if (!result.success) {
        setError(result.error || 'Import failed');
        return null;
      }
      await rescan();
      return result.filePath ?? null;
    },
    [rescan],
  );

  const configureModel = useCallback(
    async (filePath: string, setup: ModelSetupConfig) => {
      const result = await window.api.modelsConfigure({ category: 'image', filePath, setup });
      if (!result.success) {
        setError(result.error || 'Configure failed');
        return;
      }
      await rescan();
    },
    [rescan],
  );

  const downloadProfile = useCallback(async (profileId: string) => {
    if (downloads[profileId]) return;
    setDownloads((prev) => ({
      ...prev,
      [profileId]: { progress: 0, speedBps: 0, etaSeconds: -1, status: 'queued', error: null },
    }));
    setError(null);
    try {
      const result = await window.api.sdImageModelDownload({ modelId: profileId });
      if (!result.success) {
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[profileId];
          return next;
        });
        setError(result.error || 'Download failed');
      }
    } catch (err) {
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }, [downloads]);

  const pauseDownload = useCallback((id: string) => window.api.downloadPause({ id: `sdimage-model-${id}` }), []);
  const resumeDownload = useCallback((id: string) => window.api.downloadResume({ id: `sdimage-model-${id}` }), []);
  const cancelDownload = useCallback(async (id: string) => {
    await window.api.downloadCancel({ id: `sdimage-model-${id}` });
    setDownloads((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const openExternal = useCallback((url: string) => window.api.appOpenExternal({ url }), []);

  return {
    scan,
    loading,
    cliInstalled,
    activeModelId,
    downloads,
    error,
    rescan,
    setActiveModel,
    removeModel,
    openFolder,
    changeFolder,
    pickModelFile,
    importModel,
    configureModel,
    downloadProfile,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    openExternal,
    clearError: () => setError(null),
  };
}
