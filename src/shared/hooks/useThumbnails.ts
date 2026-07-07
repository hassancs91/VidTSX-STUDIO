import { useState, useCallback, useEffect, useRef } from 'react';

export function useThumbnails() {
  const cacheRef = useRef(new Map<string, string>());
  const loadingRef = useRef(new Set<string>());
  const [, setRevision] = useState(0);

  const loadThumbnail = useCallback(async (tsxFilePath: string): Promise<string | null> => {
    if (cacheRef.current.has(tsxFilePath)) {
      return cacheRef.current.get(tsxFilePath)!;
    }
    if (loadingRef.current.has(tsxFilePath)) return null;

    loadingRef.current.add(tsxFilePath);
    try {
      const result = await window.api.thumbnailRead({ tsxFilePath });
      if (result.exists && result.data) {
        const dataUrl = `data:image/gif;base64,${result.data}`;
        cacheRef.current.set(tsxFilePath, dataUrl);
        setRevision((n) => n + 1);
        return dataUrl;
      }
    } catch {
      // Silently fail
    } finally {
      loadingRef.current.delete(tsxFilePath);
    }
    return null;
  }, []);

  const getThumbnail = useCallback((tsxFilePath: string): string | null => {
    return cacheRef.current.get(tsxFilePath) ?? null;
  }, []);

  useEffect(() => {
    const unsub = window.api.onThumbnailReady((event) => {
      cacheRef.current.delete(event.tsxFilePath);
      loadingRef.current.delete(event.tsxFilePath);
      loadThumbnail(event.tsxFilePath);
    });
    return unsub;
  }, [loadThumbnail]);

  return { loadThumbnail, getThumbnail };
}
