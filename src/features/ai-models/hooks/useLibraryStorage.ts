import { useCallback, useEffect, useState } from 'react';

export interface LibraryStorageRow {
  id: 'image' | 'video' | 'audio' | '3d';
  label: string;
  count: number;
  bytes: number;
}

export interface LibraryStorageState {
  rows: LibraryStorageRow[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Per-category installed counts and sizes for the Overview's Storage panel
 * (docs/ai-models-redesign.md §3.1): image and video from the model-library
 * scan, audio from the whisper list, 3D from the Python-model catalogue.
 * Best effort — a category that fails to answer reads 0.
 */
export function useLibraryStorage(): LibraryStorageState {
  const [rows, setRows] = useState<LibraryStorageRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [image, video, whisper, threed] = await Promise.all([
      window.api.modelsScan({ category: 'image' }).catch(() => null),
      window.api.modelsScan({ category: 'video' }).catch(() => null),
      window.api.whisperModelsList().catch(() => null),
      window.api.pythonModelStatus({ category: '3d' }).catch(() => null),
    ]);
    const sum = (sizes: number[]) => sizes.reduce((n, b) => n + b, 0);
    const whisperInstalled = whisper?.models.filter((m) => m.downloaded) ?? [];
    const threedInstalled = threed?.success ? threed.models.filter((m) => m.installed) : [];
    setRows([
      { id: 'image', label: 'Image models', count: image?.installed.length ?? 0, bytes: sum(image?.installed.map((m) => m.sizeBytes) ?? []) },
      { id: 'video', label: 'Video models', count: video?.installed.length ?? 0, bytes: sum(video?.installed.map((m) => m.sizeBytes) ?? []) },
      { id: 'audio', label: 'Audio models', count: whisperInstalled.length, bytes: sum(whisperInstalled.map((m) => m.sizeBytes)) },
      { id: '3d', label: '3D models', count: threedInstalled.length, bytes: sum(threedInstalled.map((m) => m.sizeBytes)) },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, refresh };
}
