import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LibrarySearchEvent } from '@shared/ipc/types';
import type { LibrarySearchRequest, LibrarySearchResult, LibrarySearchStatus } from '@shared/types/library-search';
import type { CategoryFilter } from '../services/asset-search';
import {
  keepAnswer,
  RERANK_SETTLE_MS,
  rerankRequestOf,
  requestKeyOf,
  shouldRerank,
  smartSearchRequestOf,
  SMART_DEBOUNCE_MS,
  type HeldAnswer,
} from '../services/smart-search-request';

export interface LibrarySearchView {
  /** The effective mode + vector state (null until read). */
  status: LibrarySearchStatus | null;
  /** The service's answer for the CURRENT query / scope / kinds; null = Basic, or not answered yet. */
  result: LibrarySearchResult | null;
  /** `result`'s candidates' relPaths in the service's order (null with `result`). */
  relPaths: string[] | null;
  error: string | null;
  /** Enter in the box: the query is settled now (Smart + AI rerank asks at once instead of after 1 s idle). */
  settle: () => void;
}

/**
 * The Assets box's Smart search (LIBRARY_SEARCH_DESIGN.md §8.3), over IPC only: reads the
 * status (and its pushes — a Settings change, a download, the build's counts); while the
 * effective mode is not Basic it calls `library:search` 250 ms after the last change, scoped
 * to the breadcrumb (`scopeRelPath`, '' = the whole library), kinds from the category. Under
 * the explicit Smart + AI rerank choice the SETTLED query (1 s idle, or Enter) is asked once
 * more with `rerank: true` (LS-r7) — once per box state. An answer is used only for the
 * request it was asked for; a late plain answer never replaces the reranked one; in Basic
 * nothing is called at all.
 */
export function useLibrarySearch(query: string, scopeRelPath: string, category: CategoryFilter): LibrarySearchView {
  const [status, setStatus] = useState<LibrarySearchStatus | null>(null);
  const [answer, setAnswer] = useState<HeldAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentKey = useRef<string | null>(null);
  const rerankedKey = useRef<string | null>(null);

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
  const rerankOn = shouldRerank(status);
  const request = useMemo(
    () => (smartOn ? smartSearchRequestOf(query, scopeRelPath, category) : null),
    [smartOn, query, scopeRelPath, category]
  );
  const key = request ? requestKeyOf(request) : null;
  useEffect(() => {
    currentKey.current = key;
  }, [key]);

  /** One `library:search` call; its answer is kept only while the box still shows the state it was asked for. */
  const ask = useCallback(async (req: LibrarySearchRequest, askedKey: string, reranked: boolean) => {
    try {
      const res = await window.api.librarySearch(req);
      if (currentKey.current !== askedKey) return;
      if (res.ok) {
        setAnswer((prev) => keepAnswer(prev, { key: askedKey, result: res.result, reranked }));
        setError(null);
      } else {
        setError(res.error);
      }
    } catch (err) {
      if (currentKey.current === askedKey) setError(err instanceof Error ? err.message : 'Library search failed');
    }
  }, []);

  useEffect(() => {
    if (!request || key === null) return undefined;
    const timer = setTimeout(() => void ask(request, key, false), SMART_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [request, key, ask]);

  const settle = useCallback(() => {
    if (!rerankOn || !request || key === null || rerankedKey.current === key) return;
    rerankedKey.current = key;
    void ask(rerankRequestOf(request), key, true);
  }, [rerankOn, request, key, ask]);

  useEffect(() => {
    if (!rerankOn || !request) return undefined;
    const timer = setTimeout(settle, RERANK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [rerankOn, request, settle]);

  const result = answer !== null && key !== null && answer.key === key ? answer.result : null;
  const relPaths = useMemo(() => (result ? result.candidates.map((c) => c.relPath) : null), [result]);
  return { status, result, relPaths, error, settle };
}
