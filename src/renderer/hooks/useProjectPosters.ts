import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioProjectSummary } from '@shared/ipc/types';

/**
 * Data URLs for Studio project posters (V1 completion plan §2.6), read through
 * STUDIO_CACHE_READ exactly the way the media pool reads asset thumbnails — the
 * renderer never sees a file path in an <img>. Renderer-level because both the
 * Studio browser and Home draw the same cards and features may not import each
 * other. Keyed by project id + `updatedAt`, so a regenerated poster is re-read
 * after the next listing.
 */
export function useProjectPosters(projects: Pick<StudioProjectSummary, 'id' | 'posterPath' | 'updatedAt'>[]) {
  const cacheRef = useRef(new Map<string, string>());
  const loadingRef = useRef(new Set<string>());
  const [, setRevision] = useState(0);

  const load = useCallback(async (projectId: string, relPath: string, key: string): Promise<void> => {
    if (cacheRef.current.has(key) || loadingRef.current.has(key)) return;
    loadingRef.current.add(key);
    try {
      const res = await window.api.studioCacheRead({ projectId, relPath });
      if (res.success && res.data) {
        cacheRef.current.set(key, `data:${res.mime ?? 'image/jpeg'};base64,${res.data}`);
        setRevision((n) => n + 1);
      }
    } catch {
      // Best-effort — the card falls back to the placeholder.
    } finally {
      loadingRef.current.delete(key);
    }
  }, []);

  useEffect(() => {
    for (const project of projects) {
      if (project.posterPath) void load(project.id, project.posterPath, `${project.id}@${project.updatedAt}`);
    }
  }, [projects, load]);

  const getPoster = useCallback(
    (project: Pick<StudioProjectSummary, 'id' | 'posterPath' | 'updatedAt'>): string | null =>
      project.posterPath ? (cacheRef.current.get(`${project.id}@${project.updatedAt}`) ?? null) : null,
    [],
  );

  return { getPoster };
}
