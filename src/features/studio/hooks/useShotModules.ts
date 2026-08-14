import { useEffect, useMemo, useRef, useState, createElement, type ComponentType } from 'react';
import { setupVirtualModuleGlobals } from '@features/player';
import type { StudioShot } from '../types';
import { ShotErrorBoundary, ShotPlaceholder } from '../components/ShotErrorBoundary';

/**
 * The preview's shot-component supplier (TSX_SHOTS_DESIGN.md D4): for every
 * READY shot in the registry, ask main to transpile its active version
 * (STUDIO_SHOT_MODULE keeps path authority in main), dynamic-import the
 * served ESM, and hand back a components map for TimelineComposition.
 *
 * Shots are few, so every referenced shot loads up front — no lazy per-clip
 * loading, and the Player's `premountFor` behavior is untouched. A version
 * bump (or regenerate) changes the source content, which changes the
 * transpile hash and therefore the module URL — the `shotId@version` cache
 * key here re-requests, and the fresh URL makes the browser re-import.
 *
 * Every imported component is wrapped in ShotErrorBoundary — preview-only
 * containment; the export entry (D6, later slice) stays unwrapped on purpose.
 * While a module is loading (or after it failed) the map serves a labeled
 * placeholder so the composition itself can stay dumb.
 */
export function useShotModules(
  projectId: string,
  shots: StudioShot[],
): Record<string, ComponentType> {
  const [components, setComponents] = useState<Record<string, ComponentType>>({});
  // shotId@version → the wrapped component (or a load in flight). Survives
  // re-renders; entries for versions no longer active are dropped below.
  const cacheRef = useRef(new Map<string, ComponentType | Promise<ComponentType>>());

  const ready = useMemo(() => shots.filter((s) => s.status === 'ready'), [shots]);

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const wanted = new Set(ready.map((s) => `${s.id}@${s.activeVersion}`));
    for (const key of cache.keys()) {
      if (!wanted.has(key)) cache.delete(key);
    }

    async function load(shot: StudioShot): Promise<ComponentType> {
      // Pins the app's own React/Remotion instances onto the virtual-module
      // globals BEFORE any shot imports — this is what makes the shot's
      // useCurrentFrame() resolve against the hosting Player (Spike 0).
      await setupVirtualModuleGlobals();
      const res = await window.api.studioShotModule({
        projectId,
        shotId: shot.id,
        version: shot.activeVersion,
      });
      if (!res.success || !res.moduleUrl) {
        throw new Error(res.error ?? 'Failed to prepare shot module');
      }
      const mod = (await import(/* @vite-ignore */ res.moduleUrl)) as {
        default: ComponentType;
      };
      if (typeof mod.default !== 'function') {
        throw new Error('Shot module has no component default export');
      }
      const Inner = mod.default;
      const Wrapped: ComponentType = () =>
        createElement(ShotErrorBoundary, { label: shot.name, children: createElement(Inner) });
      return Wrapped;
    }

    const rebuild = () => {
      if (cancelled) return;
      const next: Record<string, ComponentType> = {};
      for (const shot of ready) {
        const entry = cache.get(`${shot.id}@${shot.activeVersion}`);
        next[shot.id] =
          entry && typeof entry === 'function'
            ? entry
            : () => createElement(ShotPlaceholder, { label: shot.name, detail: 'Loading…' });
      }
      setComponents(next);
    };

    for (const shot of ready) {
      const key = `${shot.id}@${shot.activeVersion}`;
      if (cache.has(key)) continue;
      const pending = load(shot)
        .catch((err: unknown) => {
          const detail = err instanceof Error ? err.message : String(err);
          const Failed: ComponentType = () =>
            createElement(ShotPlaceholder, { label: shot.name, detail });
          return Failed;
        })
        .then((component) => {
          cache.set(key, component);
          rebuild();
          return component;
        });
      cache.set(key, pending);
    }

    rebuild();
    return () => {
      cancelled = true;
    };
  }, [projectId, ready]);

  return components;
}
