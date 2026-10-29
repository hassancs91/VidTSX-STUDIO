import { useEffect, useMemo, useState } from 'react';
import type { LibrarySearchEvent } from '@shared/ipc/types';
import type { LibrarySearchResult, LibrarySearchStatus } from '@shared/types/library-search';
import type { CategoryFilter } from '../services/asset-search';
import { requestKeyOf, smartSearchRequestOf, SMART_DEBOUNCE_MS } from '../services/smart-search-request';

export interface LibrarySearchView {
  /** The effective mode + vector state (null until read). */
  status: LibrarySearchStatus | null;
  /** The service's answer for the CURRENT query / scope / kinds; null = Basic, or not answered yet. */
  result: LibrarySearchResult | null;
  /** `result`'s candidates' relPaths in the service's order (null with `result`). */
  relPaths: string[] | null;
  error: string | null;
}

/**
 * The Assets box's Smart search (LIBRARY_SEARCH_DESIGN.md §8.3), over IPC only: reads the
 * status (and its pushes — a Settings change, a download, the build's counts); while the
 * effective mode is not Basic it calls `library:search` 250 ms after the last change, scoped
 * to the breadcrumb (`scopeRelPath`, '' = the whole library), kinds from the category. An
 * answer is used only for the request it was asked for; in Basic nothing is called at all.
 */
export function useLibrarySearch(query: string, scopeRelPath: string, category: CategoryFilter): LibrarySearchView {
  const [status, setStatus] = useState<LibrarySearchStatus | null>(null);
  const [answer, setAnswer] = useState<{ key: string; result: LibrarySearchResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const read = async () => {
      try {
        const res = await window.api.librarySearchStatus();
        if (live) setStatus(res);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : 'Could not read the library search status');
      }
    };
    void read();
    const unsubscribe = window.api.onLibrarySearchEvent((event: LibrarySearchEvent) => {
      if (event.type === 'status') {
        setStatus(event.status);
        return;
      }
      const vectors = { ready: event.ready, total: event.total, building: event.building };
      setStatus((prev) => (prev ? { ...prev, vectors } : prev));
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const smartOn = status !== null && status.mode !== 'basic';
  const request = useMemo(
    () => (smartOn ? smartSearchRequestOf(query, scopeRelPath, category) : null),
    [smartOn, query, scopeRelPath, category]
  );
  const key = request ? requestKeyOf(request) : null;

  useEffect(() => {
    if (!request || key === null) return undefined;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await window.api.librarySearch(request);
        if (!live) return;
        if (res.ok) {
          setAnswer({ key, result: res.result });
          setError(null);
        } else {
          setError(res.error);
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : 'Library search failed');
      }
    }, SMART_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [request, key]);

  const result = answer !== null && key !== null && answer.key === key ? answer.result : null;
  const relPaths = useMemo(() => (result ? result.candidates.map((c) => c.relPath) : null), [result]);
  return { status, result, relPaths, error };
}
