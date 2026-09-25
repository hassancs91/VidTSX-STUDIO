// Filter packs in the renderer (docs/studio/FILTER_PACKS_DESIGN.md): the
// installed list, and the live-imported definitions the Player paints with.
//
// The transitions hooks' shape — main keeps path authority, the renderer asks
// by document kind and dynamic-imports the served bundle. Definitions load ON
// DEMAND: the preview asks only for the kinds its timeline uses. A filter is
// plain Canvas 2D code, so nothing pins React or Remotion before the import.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioFilterInfo } from '@shared/ipc/types';
import { isFilterDefinition } from '@shared/studio/filter-runtime';
import type { FilterDefinition, StudioTimeline } from '@shared/types/studio';
import type { AnalysisKind, AnalysisState } from '../services/analysis-status';
import { effectStatuses, type EffectStatus } from '../services/filter-status';

/** Dispatched on `window` after an install; every open list re-scans. */
export const FILTERS_CHANGED_EVENT = 'vidtsx:filters-changed';

export interface FilterList {
  filters: StudioFilterInfo[];
  /** Installed kinds → their entries; null until the first list lands, so
   *  nothing is called "not installed" while it is merely loading. */
  installed: ReadonlyMap<string, StudioFilterInfo> | null;
  loading: boolean;
  /** Re-scan the pack roots — the tabs ask on every open, so a folder-dropped
   *  pack shows up without reopening the project. */
  refresh: () => void;
}

/** The installed filters, fetched on mount, on `refresh()` and after an import. */
export function useFilterList(): FilterList {
  const [filters, setFilters] = useState<StudioFilterInfo[]>([]);
  /** A list has arrived at least once — until then no kind is "missing". */
  const [listed, setListed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await window.api.studioFilterList();
      if (cancelled) return;
      // A failed re-scan keeps the last good list rather than emptying the tab.
      if (res.success && res.filters) {
        setFilters(res.filters);
        setListed(true);
      }
      setSettled(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const refresh = useCallback(() => setGeneration((g) => g + 1), []);
  useEffect(() => {
    window.addEventListener(FILTERS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FILTERS_CHANGED_EVENT, refresh);
  }, [refresh]);
  const installed = useMemo(() => (listed ? new Map(filters.map((f) => [f.kind, f])) : null), [listed, filters]);
  return { filters, installed, loading: !settled, refresh };
}

/**
 * Definitions for the requested kinds, keyed by kind — the shape
 * `TimelineComposition`'s `filterDefinitions` takes. A kind that fails to
 * load (pack uninstalled, a file the gate refused, a module whose default
 * export is not a filter) is simply absent, so its clip shows the plain
 * picture. Undefined while nothing has loaded: the composition then takes
 * exactly the path it took before filters existed.
 *
 * `retryKey`: when it changes (pass the installed list), kinds that failed are
 * asked for again — a reinstalled pack comes back in the preview without
 * reopening the project. A kind that loaded stays loaded.
 */
export function useFilterDefinitions(
  kinds: readonly string[],
  retryKey?: unknown,
): Record<string, FilterDefinition> | undefined {
  const [loaded, setLoaded] = useState<Record<string, FilterDefinition | null>>({});
  const cache = useRef(new Map<string, Promise<FilterDefinition | null>>());
  const failed = useRef(new Set<string>());
  const lastRetryKey = useRef(retryKey);

  const load = useCallback(async (kind: string): Promise<FilterDefinition | null> => {
    const res = await window.api.studioFilterModule({ kind });
    if (!res.success || !res.moduleUrl) {
      if (!res.notInstalled) console.warn(`[filters] ${kind} did not load: ${res.error ?? 'unknown error'}`);
      return null;
    }
    const mod = (await import(/* @vite-ignore */ res.moduleUrl)) as { default?: unknown };
    return isFilterDefinition(mod.default) ? mod.default : null;
  }, []);

  const key = [...kinds].sort().join('|');
  useEffect(() => {
    let cancelled = false;
    if (lastRetryKey.current !== retryKey) {
      lastRetryKey.current = retryKey;
      for (const kind of failed.current) cache.current.delete(kind);
      failed.current.clear();
    }
    for (const kind of key === '' ? [] : key.split('|')) {
      let pending = cache.current.get(kind);
      if (!pending) {
        pending = load(kind)
          .catch(() => null)
          .then((definition) => {
            if (!definition) failed.current.add(kind);
            return definition;
          });
        cache.current.set(kind, pending);
      }
      // Subscribed on every run, cached or not: a load that outlived the run
      // that started it must still land.
      void pending.then((definition) => {
        if (cancelled) return;
        setLoaded((prev) => (kind in prev && prev[kind] === definition ? prev : { ...prev, [kind]: definition }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key, load, retryKey]);

  return useMemo(() => {
    const out: Record<string, FilterDefinition> = {};
    for (const kind of key === '' ? [] : key.split('|')) {
      const definition = loaded[kind];
      if (definition) out[kind] = definition;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [loaded, key]);
}

/** What every filtered clip's chip shows, recomputed per edit — one pass over the clips. */
export function useEffectStatuses(
  timeline: StudioTimeline,
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
  analysisOf?: (kind: AnalysisKind, assetId: string) => AnalysisState | undefined,
): ReadonlyMap<string, EffectStatus> {
  return useMemo(() => effectStatuses(timeline, installed, analysisOf), [timeline, installed, analysisOf]);
}
