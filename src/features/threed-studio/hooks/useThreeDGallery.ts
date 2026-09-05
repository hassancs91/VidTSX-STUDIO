import { useCallback, useEffect, useReducer, useState } from 'react';
import type { ThreedStudioEntry } from '../../../shared/ipc/types';
import { galleryReducer, INITIAL_GALLERY } from '../services/gallery-reducer';

/** 3D Studio gallery: list from main, local reducer for add/remove, file actions. */
export function useThreeDGallery() {
  const [state, dispatch] = useReducer(galleryReducer, INITIAL_GALLERY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await window.api.threedStudioList();
      if (res.success) dispatch({ type: 'loaded', entries: res.entries, basePath: res.basePath });
      else setError(res.error ?? 'Failed to load models');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addEntry = useCallback((entry: ThreedStudioEntry) => dispatch({ type: 'added', entry }), []);

  const removeEntry = useCallback(async (id: string) => {
    const res = await window.api.threedStudioDelete({ id });
    if (res.success) dispatch({ type: 'removed', id });
    return res.success;
  }, []);

  const removeEntries = useCallback(async (ids: string[]) => {
    const results = await Promise.all(ids.map(async (id) => ({ id, ok: (await window.api.threedStudioDelete({ id })).success })));
    const deleted = results.filter((r) => r.ok).map((r) => r.id);
    if (deleted.length > 0) dispatch({ type: 'removed-many', ids: deleted });
    return { deleted, failed: results.filter((r) => !r.ok).map((r) => r.id) };
  }, []);

  const saveAs = useCallback((id: string) => window.api.threedStudioSaveAs({ id }), []);
  const saveToLibrary = useCallback((id: string) => window.api.threedStudioSaveToLibrary({ id }), []);
  const openFolder = useCallback((id?: string) => window.api.threedStudioOpenFolder(id ? { id } : {}), []);

  return { models: state.entries, loading, error, refresh, addEntry, removeEntry, removeEntries, saveAs, saveToLibrary, openFolder };
}
