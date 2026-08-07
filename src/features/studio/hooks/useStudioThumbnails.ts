import { useCallback, useRef, useState } from 'react';

/** In-memory cache of asset thumbnails (project cache files → data URLs). */
export function useStudioThumbnails(projectId: string) {
  const cacheRef = useRef(new Map<string, string>());
  const loadingRef = useRef(new Set<string>());
  const [, setRevision] = useState(0);

  const loadThumbnail = useCallback(
    async (assetId: string, relPath: string): Promise<void> => {
      if (cacheRef.current.has(assetId) || loadingRef.current.has(assetId)) return;
      loadingRef.current.add(assetId);
      try {
        const res = await window.api.studioCacheRead({ projectId, relPath });
        if (res.success && res.data) {
          cacheRef.current.set(assetId, `data:${res.mime ?? 'image/jpeg'};base64,${res.data}`);
          setRevision((n) => n + 1);
        }
      } catch {
        // Best-effort — the media pool falls back to a kind icon.
      } finally {
        loadingRef.current.delete(assetId);
      }
    },
    [projectId],
  );

  const getThumbnail = useCallback((assetId: string): string | null => {
    return cacheRef.current.get(assetId) ?? null;
  }, []);

  return { loadThumbnail, getThumbnail };
}
