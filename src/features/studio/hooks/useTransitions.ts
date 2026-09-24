// Transition packs in the renderer (docs/studio/TRANSITION_PACKS_DESIGN.md):
// the installed list, and the live-imported components the Player renders.
//
// The caption-template path copied — main keeps path authority, the renderer
// asks by document kind and dynamic-imports the served ESM. Modules load ON
// DEMAND: the preview asks only for the kinds its timeline uses.

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { setupVirtualModuleGlobals } from '@features/player';
import type { StudioMediaAsset, StudioTimeline, TransitionRuntimeProps } from '@shared/types/studio';
import type { StudioTransitionInfo } from '@shared/ipc/types';
import { describeJoin, joinStatuses, type JoinStatus, type JoinTargetInfo } from '../services/join-status';
import { TRANSITIONS_CHANGED_EVENT } from './useTransitionImport';

export type TransitionComponent = ComponentType<TransitionRuntimeProps>;

export interface TransitionList {
  transitions: StudioTransitionInfo[];
  /** Installed kinds → display names; null until the first list lands, so
   *  nothing is called "not installed" while it is merely loading. */
  installed: ReadonlyMap<string, string> | null;
  loading: boolean;
  /** Re-scan the pack roots — the Transitions tab asks on every open, so a
   *  folder-dropped pack shows up without reopening the project. */
  refresh: () => void;
}

/** The installed transitions, fetched on mount, on `refresh()` and after an import. */
export function useTransitionList(): TransitionList {
  const [transitions, setTransitions] = useState<StudioTransitionInfo[]>([]);
  /** A list has arrived at least once — until then no kind is "missing". */
  const [listed, setListed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await window.api.studioTransitionList();
      if (cancelled) return;
      // A failed re-scan keeps the last good list rather than emptying the tab.
      if (res.success && res.transitions) {
        setTransitions(res.transitions);
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
  // An import anywhere in the app re-scans every open list.
  useEffect(() => {
    window.addEventListener(TRANSITIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TRANSITIONS_CHANGED_EVENT, refresh);
  }, [refresh]);
  const installed = useMemo(
    () => (listed ? new Map(transitions.map((t) => [t.kind, t.name])) : null),
    [listed, transitions],
  );
  return { transitions, installed, loading: !settled, refresh };
}

/**
 * Components for the requested kinds, keyed by kind — the shape
 * `TimelineComposition`'s `transitionComponents` takes. A kind that fails to
 * load (pack uninstalled, a file the import gate refused, a broken module) is
 * simply absent, so its boundary renders as a crossfade. Undefined while
 * nothing has loaded: the composition then takes exactly the path it took
 * before packs existed.
 *
 * `retryKey`: when it changes (pass the installed list), kinds that failed are
 * asked for again — a reinstalled pack comes back in the preview without
 * reopening the project. A kind that loaded stays loaded.
 */
export function useTransitionComponents(
  kinds: readonly string[],
  retryKey?: unknown,
): Record<string, TransitionComponent> | undefined {
  const [loaded, setLoaded] = useState<Record<string, TransitionComponent | null>>({});
  const cache = useRef(new Map<string, Promise<TransitionComponent | null>>());
  const failed = useRef(new Set<string>());
  const lastRetryKey = useRef(retryKey);

  const load = useCallback(async (kind: string): Promise<TransitionComponent | null> => {
    // Pins the app's React/Remotion onto the virtual-module globals BEFORE the
    // import, so a component's hooks resolve against the host Player.
    await setupVirtualModuleGlobals();
    const res = await window.api.studioTransitionModule({ kind });
    if (!res.success || !res.moduleUrl) {
      if (!res.notInstalled) console.warn(`[transitions] ${kind} did not load: ${res.error ?? 'unknown error'}`);
      return null;
    }
    const mod = (await import(/* @vite-ignore */ res.moduleUrl)) as { default: TransitionComponent };
    return typeof mod.default === 'function' ? mod.default : null;
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
          .then((component) => {
            if (!component) failed.current.add(kind);
            return component;
          });
        cache.current.set(kind, pending);
      }
      // Subscribed on every run, cached or not: a load that outlived the run
      // that started it must still land.
      void pending.then((component) => {
        if (cancelled) return;
        setLoaded((prev) => (kind in prev && prev[kind] === component ? prev : { ...prev, [kind]: component }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key, load, retryKey]);

  return useMemo(() => {
    const out: Record<string, TransitionComponent> = {};
    for (const kind of key === '' ? [] : key.split('|')) {
      const component = loaded[kind];
      if (component) out[kind] = component;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [loaded, key]);
}

/**
 * What every join on the timeline shows (name, real length, warning) and the
 * Transitions tab's target, described. Recomputed per edit — it is one pass
 * over the clips.
 */
export function useJoinStatus({
  timeline,
  fps,
  assets,
  installed,
  targetId,
}: {
  timeline: StudioTimeline;
  fps: number;
  assets: readonly StudioMediaAsset[];
  installed: ReadonlyMap<string, string> | null;
  targetId: string | null;
}): { statuses: ReadonlyMap<string, JoinStatus>; target: JoinTargetInfo | null } {
  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const statuses = useMemo(
    () => joinStatuses(timeline, fps, (id) => assetsById.get(id)?.probe.duration, installed),
    [timeline, fps, assetsById, installed],
  );
  const target = useMemo(
    () => describeJoin(timeline, targetId, statuses, assetsById),
    [timeline, targetId, statuses, assetsById],
  );
  return { statuses, target };
}
