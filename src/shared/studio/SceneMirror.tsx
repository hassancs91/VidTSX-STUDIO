// Transition scene mirrors — the Player's half of "Structure B"
// (docs/studio/TRANSITION_PACKS_DESIGN.md "Composition", P0 Player results).
//
// In the Player, a transition component's scene nodes are NOT fresh video
// elements. A component is free to return a different tree from one progress
// value to the next (both core components short-circuit at progress 0), and
// every such change remounts whatever <video> sits in the scene — a fresh
// element has no frame to show, so the window flashed black on its first
// playing frame. A multi-copy component also multiplied decoders.
//
// Instead, each covered clip's own full-length element (the "spine", which is
// mounted, in sync and decoding through the whole window anyway) registers
// itself here, and every scene copy is a <canvas> painted from it. A remounted
// canvas paints on mount, and N copies cost N draws instead of N decoders.
//
// Renders never take this path: a headless render waits for every frame, and
// its scene copies are the byte-verified Structure A.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';

export interface SceneSources {
  /** Ref callback for a covered clip's slot. */
  attach(clipId: string): (element: HTMLElement | null) => void;
  /** The element the clip is currently painting (video, or canvas for the WebCodecs engine). */
  source(clipId: string): HTMLVideoElement | HTMLCanvasElement | null;
}

export const SceneSourceContext = createContext<SceneSources | null>(null);

export function useSceneSources(): SceneSources {
  const slots = useRef(new Map<string, HTMLElement>());
  return useMemo<SceneSources>(
    () => ({
      attach: (clipId) => (element) => {
        if (element) slots.current.set(clipId, element);
        else slots.current.delete(clipId);
      },
      // A filtered clip's picture is its filter canvas (`FilteredPicture`
      // marks it `data-scene-picture`), which sits AFTER the media element in
      // DOM order — so it is asked for first, or a window would mirror the
      // unfiltered element underneath.
      source: (clipId) => {
        const slot = slots.current.get(clipId);
        if (!slot) return null;
        return (
          slot.querySelector<HTMLCanvasElement>('canvas[data-scene-picture]') ??
          slot.querySelector<HTMLVideoElement | HTMLCanvasElement>('video, canvas')
        );
      },
    }),
    [],
  );
}

/** Wraps a covered clip's element so its scene copies can find it. Layout-neutral. */
export function SceneSourceSlot({ clipId, children }: { clipId: string; children: ReactNode }) {
  const sources = useContext(SceneSourceContext);
  const attach = useMemo(() => sources?.attach(clipId), [sources, clipId]);
  return (
    <div ref={attach} style={{ position: 'absolute', inset: 0 }}>
      {children}
    </div>
  );
}

/**
 * Redraws after every change of the source's time. A draw made the moment a
 * seek lands can come back EMPTY (measured: transparent pixels at `seeked`
 * with readyState 4) — the frame arrives a paint or two later. Drawing over
 * the previous picture never blanks it, so repeating is safe.
 */
const SETTLE_FRAMES = 8;

/** One scene copy: a canvas mirroring the clip's own element. */
export function SceneMirror({ clipId, style }: { clipId: string; style: CSSProperties }) {
  const sources = useContext(SceneSourceContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawn = useRef<number | null>(null);
  const settle = useRef(0);

  const draw = useCallback(
    (force: boolean) => {
      const canvas = canvasRef.current;
      const source = sources?.source(clipId) ?? null;
      if (!canvas || !source) return;
      let width: number;
      let height: number;
      if (source instanceof HTMLVideoElement) {
        // Mid-seek the element still holds the OLD frame; keep ours until it lands.
        if (source.readyState < 2 || source.seeking) return;
        if (force || drawn.current !== source.currentTime) settle.current = SETTLE_FRAMES;
        if (settle.current <= 0) return;
        settle.current -= 1;
        width = source.videoWidth;
        height = source.videoHeight;
      } else {
        width = source.width;
        height = source.height;
      }
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      canvas.getContext('2d')?.drawImage(source, 0, 0, width, height);
      drawn.current = source instanceof HTMLVideoElement ? source.currentTime : null;
    },
    [sources, clipId],
  );

  // Every render is a new Player frame (or a fresh mount): paint now, before
  // the browser shows the frame.
  useLayoutEffect(() => draw(true));

  // Between renders the source keeps advancing (and a seek lands late).
  useEffect(() => {
    let id = requestAnimationFrame(function loop() {
      draw(false);
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [draw]);

  return <canvas ref={canvasRef} style={style} />;
}
