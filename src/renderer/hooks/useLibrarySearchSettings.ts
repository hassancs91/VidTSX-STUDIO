import { useCallback, useEffect, useState } from 'react';
import type { EmbeddingDownloadProgressEvent, LibrarySearchEvent } from '@shared/ipc/types';
import type { LibrarySearchChoice, LibrarySearchStatus } from '@shared/types/library-search';

const messageOf = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message : fallback);

export interface LibrarySearchSettings {
  status: LibrarySearchStatus | null;
  /** 0–100 while the search model downloads, else null. */
  downloadPercent: number | null;
  error: string | null;
  setChoice: (choice: LibrarySearchChoice) => Promise<void>;
  /** Fetches the search model through the AI Models path (`embedding:model:download`) — only on a click. */
  download: () => Promise<void>;
}

/**
 * The Settings "Library search" row's state (LIBRARY_SEARCH_DESIGN.md §4), over the preload
 * API only: the status, its pushes (`library:search:event` — the setting, the download, the
 * background build's vector counts), the ladder choice, and the model download with its
 * progress (`embedding:download:progress`, filtered to the search model).
 */
export function useLibrarySearchSettings(): LibrarySearchSettings {
  const [status, setStatus] = useState<LibrarySearchStatus | null>(null);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.librarySearchStatus();
      setStatus(res);
      setError(res.error ?? null);
    } catch (err) {
      setError(messageOf(err, 'Could not read the library search status'));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return window.api.onLibrarySearchEvent((event: LibrarySearchEvent) => {
      if (event.type === 'status') {
        setStatus(event.status);
        return;
      }
      const vectors = { ready: event.ready, total: event.total, building: event.building };
      setStatus((prev) => (prev ? { ...prev, vectors } : prev));
    });
  }, [refresh]);

  const modelId = status?.modelId ?? null;
  useEffect(() => {
    if (modelId === null) return undefined;
    return window.api.onEmbeddingDownloadProgress((event: EmbeddingDownloadProgressEvent) => {
      if (event.modelId !== modelId) return;
      setDownloadPercent(Math.max(0, Math.min(100, event.percent)));
    });
  }, [modelId]);

  const setChoice = useCallback(async (choice: LibrarySearchChoice) => {
    setError(null);
    try {
      const res = await window.api.librarySearchSettingsSet({ mode: choice });
      setStatus(res);
      if (res.error) setError(res.error);
    } catch (err) {
      setError(messageOf(err, 'Could not save the library search setting'));
    }
  }, []);

  const download = useCallback(async () => {
    if (modelId === null) return;
    setError(null);
    setDownloadPercent(0);
    try {
      const res = await window.api.embeddingModelDownload({ modelId });
      if (!res.success) setError(res.error || 'The model download failed');
    } catch (err) {
      setError(messageOf(err, 'The model download failed'));
    } finally {
      setDownloadPercent(null);
      await refresh();
    }
  }, [modelId, refresh]);

  return { status, downloadPercent, error, setChoice, download };
}
