import { useCallback, useEffect, useRef, useState } from 'react';
import type { DownloadProgressEvent, ModelsScanResponse } from '@shared/ipc/types';
import type { ModelDownloadStatus } from './useImageLibrary';

const EMPTY_SCAN: ModelsScanResponse = {
  category: 'video',
  folder: '',
  installed: [],
  profiles: [],
  unrecognized: [],
  companions: [],
};

function mapDownloadStatus(status: string): ModelDownloadStatus['status'] {
  return (['downloading', 'paused', 'extracting', 'queued'] as const).find((s) => s === status) ?? 'queued';
}

function fileLabelOf(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata?.fileLabel) return undefined;
  return metadata.fileStep ? `${metadata.fileLabel} (${metadata.fileStep})` : metadata.fileLabel;
}

/** True when this event is for the last file of the profile's download set. */
function isLastFile(metadata: Record<string, string> | undefined): boolean {
  const step = metadata?.fileStep;
  if (!step) return true;
  const [current, total] = step.split('/');
  return current === total;
}

/**
 * State for the Video models library view — mirrors useImageLibrary, minus
 * active-model/import/folder-change (no video runner yet, allowCustomImport
 * false). A profile download is a multi-file set (model + missing companions);
 * per-model progress carries a `label` naming the file being fetched, and
 * `taskId` targets pause/resume/cancel at the task that is actually running.
 */
export function useVideoLibrary() {
  const [scan, setScan] = useState<ModelsScanResponse>(EMPTY_SCAN);
  const [loading, setLoading] = useState(true);
  const [downloads, setDownloads] = useState<Record<string, ModelDownloadStatus>>({});
  const [error, setError] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);

  const rescan = useCallback(async () => {
    const result = await window.api.modelsScan({ category: 'video' });
    setScan(result);
    if (result.error && result.error !== 'unsupported-category') setError(result.error);
    // The local video provider reads this library live: a model that just
    // became ready (or was deleted) changes what the Videos screen, the Flows
    // node and the agents can pick, so tell the pickers to reload.
    window.dispatchEvent(new CustomEvent('vidtsx:video-providers-changed'));
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [scanResult, downloadsResult] = await Promise.all([
        window.api.modelsScan({ category: 'video' }),
        window.api.downloadGetAll(),
      ]);
      setScan(scanResult);
      if (scanResult.error && scanResult.error !== 'unsupported-category') setError(scanResult.error);

      const restored: Record<string, ModelDownloadStatus> = {};
      for (const d of downloadsResult.downloads) {
        if (d.metadata?.type !== 'sdvideo-model') continue;
        if (d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled') continue;
        const modelId = d.metadata.modelId;
        if (!modelId) continue;
        restored[modelId] = {
          progress: d.percent,
          speedBps: d.speedBps,
          etaSeconds: d.etaSeconds,
          status: mapDownloadStatus(d.status),
          error: null,
          label: fileLabelOf(d.metadata),
          taskId: d.id,
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

  // Download-manager progress → per-profile download UI.
  useEffect(() => {
    unsubRef.current = window.api.onDownloadProgress((event: DownloadProgressEvent) => {
      if (event.metadata?.type !== 'sdvideo-model') return;
      const modelId = event.metadata.modelId;
      if (!modelId) return;

      if (event.status === 'completed') {
        // Each finished file may clear a "Needs N files" issue → rescan.
        // Only the set's last file removes the progress card.
        if (isLastFile(event.metadata)) {
          setDownloads((prev) => {
            const next = { ...prev };
            delete next[modelId];
            return next;
          });
        }
        void rescan();
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
          label: fileLabelOf(event.metadata),
          taskId: event.id,
        },
      }));
    });
    return () => unsubRef.current?.();
  }, [rescan]);

  const removeModel = useCallback(
    async (modelId: string) => {
      const result = await window.api.modelsRemove({ category: 'video', modelId, deleteFile: true });
      if (!result.success) {
        setError(result.error || 'Delete failed');
        return;
      }
      await rescan();
    },
    [rescan],
  );

  const openFolder = useCallback(async () => {
    await window.api.modelsOpenFolder({ category: 'video' });
  }, []);

  const downloadProfile = useCallback(async (profileId: string) => {
    if (downloads[profileId]) return;
    setDownloads((prev) => ({
      ...prev,
      [profileId]: {
        progress: 0,
        speedBps: 0,
        etaSeconds: -1,
        status: 'queued',
        error: null,
        taskId: `sdvideo-model-${profileId}`,
      },
    }));
    setError(null);
    try {
      const result = await window.api.sdVideoModelDownload({ modelId: profileId });
      if (!result.success) {
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[profileId];
          return next;
        });
        setError(result.error || 'Download failed');
        return;
      }
      // Fallback in case the 'completed' event was missed (e.g. remount):
      // all files are finalized on disk by now.
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      await rescan();
    } catch (err) {
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }, [downloads, rescan]);

  const activeTaskId = useCallback(
    (profileId: string) => downloads[profileId]?.taskId ?? `sdvideo-model-${profileId}`,
    [downloads],
  );

  const pauseDownload = useCallback(
    (id: string) => window.api.downloadPause({ id: activeTaskId(id) }),
    [activeTaskId],
  );
  const resumeDownload = useCallback(
    (id: string) => window.api.downloadResume({ id: activeTaskId(id) }),
    [activeTaskId],
  );
  const cancelDownload = useCallback(
    async (id: string) => {
      await window.api.downloadCancel({ id: activeTaskId(id) });
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [activeTaskId],
  );

  const openExternal = useCallback((url: string) => window.api.appOpenExternal({ url }), []);

  return {
    scan,
    loading,
    downloads,
    error,
    rescan,
    removeModel,
    openFolder,
    downloadProfile,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    openExternal,
    clearError: () => setError(null),
  };
}
