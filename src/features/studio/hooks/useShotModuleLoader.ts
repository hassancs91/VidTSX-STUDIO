import { createElement, useEffect, useMemo, useRef, type ComponentType } from 'react';
import { setupVirtualModuleGlobals } from '@features/player';
import type { ShotRuntimeProps, StudioShot, StudioTimeline } from '../types';
import { ShotErrorBoundary, ShotPlaceholder } from '../components/ShotErrorBoundary';
import { markOpen } from '../services/open-timing';
import { orderShotLoads, shotSpans } from '../services/shot-load-order';
import {
  createShotModuleLoader,
  type ShotLoadRequest,
  type ShotModuleLoader,
} from '../services/shot-module-loader';

/** A shot component as the composition renders it — receives the serialized
 *  runtime props (resolved asset URLs, D12). */
export type ShotComponent = ComponentType<ShotRuntimeProps>;

interface PlayheadSource {
  secondsRef: { current: number };
  subscribe: (listener: (seconds: number) => void) => () => void;
}

/** Re-order the remaining queue only after the playhead moved this far. */
const REPRIORITIZE_STEP_SEC = 1;

/**
 * The preview's shot-component supplier (TSX_SHOTS_DESIGN.md D4): for every
 * READY shot, ask main for its active version's module (STUDIO_SHOT_MODULE
 * keeps path authority in main — memo, project disk cache, then transpile),
 * dynamic-import the served ESM and wrap it in ShotErrorBoundary (preview-only
 * containment; the export entry stays unwrapped on purpose).
 *
 * Loading runs in a per-editor store (services/shot-module-loader.ts), not in
 * this hook's state: the caller that owns the editor only syncs the wanted set
 * — playhead-nearest first — and the Player + the open overlay subscribe to
 * the snapshot (useShotModuleSnapshot), so a module arriving re-renders the
 * preview, never the whole editor (video-10 feedback item 2). A version bump
 * (regenerate/edit) is a new shotId@version request; main's content-hash URL
 * makes the browser import the new code.
 */
export function useShotModuleLoader(
  projectId: string,
  shots: StudioShot[],
  timeline: StudioTimeline,
  playhead: PlayheadSource,
): ShotModuleLoader<ShotComponent> {
  const loader = useMemo(
    () =>
      createShotModuleLoader<ShotComponent>({
        load: (req) => loadShotComponent(projectId, req),
        placeholder: (req) => () => createElement(ShotPlaceholder, { label: req.label, detail: 'Loading…' }),
        failed: (req, detail) => () => createElement(ShotPlaceholder, { label: req.label, detail }),
      }),
    [projectId],
  );
  useEffect(() => () => loader.dispose(), [loader]);

  const ready = useMemo(() => shots.filter((s) => s.status === 'ready'), [shots]);
  const spans = useMemo(() => shotSpans(timeline), [timeline]);
  const latest = useRef({ ready, spans });
  latest.current = { ready, spans };
  const { secondsRef, subscribe } = playhead;

  useEffect(() => {
    const byId = new Map(ready.map((s) => [s.id, s]));
    const order = orderShotLoads(
      ready.map((s) => s.id),
      spans,
      secondsRef.current,
    );
    loader.sync(
      order.map((id): ShotLoadRequest => {
        const shot = byId.get(id)!;
        return { key: `${shot.id}@${shot.activeVersion}`, shotId: shot.id, version: shot.activeVersion, label: shot.name };
      }),
    );
  }, [loader, ready, spans, secondsRef]);

  // A seek while shots are still queued pulls the ones around it forward.
  useEffect(() => {
    let orderedAt = secondsRef.current;
    return subscribe((seconds) => {
      if (!loader.hasQueued() || Math.abs(seconds - orderedAt) < REPRIORITIZE_STEP_SEC) return;
      orderedAt = seconds;
      const { ready: shotsNow, spans: spansNow } = latest.current;
      loader.reprioritize(orderShotLoads(shotsNow.map((s) => s.id), spansNow, seconds));
    });
  }, [loader, secondsRef, subscribe]);

  return loader;
}

async function loadShotComponent(projectId: string, req: ShotLoadRequest): Promise<ShotComponent> {
  // The request goes out first, so main prepares the module while the editor
  // is still mounting; the import waits for both. Pinning the app's own
  // React/Remotion instances onto the virtual-module globals BEFORE any shot
  // imports is what makes the shot's useCurrentFrame() resolve against the
  // hosting Player (Spike 0).
  markOpen(`shot:ipc-start:${req.shotId}`);
  const [res] = await Promise.all([
    window.api.studioShotModule({ projectId, shotId: req.shotId, version: req.version }),
    setupVirtualModuleGlobals(),
  ]);
  markOpen(`shot:ipc-end:${req.shotId}`);
  if (!res.success || !res.moduleUrl) {
    throw new Error(res.error ?? 'Failed to prepare shot module');
  }
  const mod = (await import(/* @vite-ignore */ res.moduleUrl)) as { default: ShotComponent };
  markOpen(`shot:import-end:${req.shotId}`);
  if (typeof mod.default !== 'function') {
    throw new Error('Shot module has no component default export');
  }
  const Inner = mod.default;
  // Forward the serializer's runtime props through the boundary (D12).
  const Wrapped: ShotComponent = (props) =>
    createElement(ShotErrorBoundary, { label: req.label, children: createElement(Inner, props) });
  return Wrapped;
}
