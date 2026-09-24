// A video or image clip's picture with its filter chain painted over it
// (docs/studio/FILTER_PACKS_DESIGN.md "Composition"). The media element keeps
// every prop it has today and gains `onVideoFrame`; a <canvas> with the same
// fill style sits above it and shows the result. Every draw is synchronous
// and `time` is a pure function of the Remotion frame, so a render is
// deterministic and the Player paints the same picture.
//
// Render host: Remotion's Img calls `onVideoFrame(img)` BEFORE it releases
// the frame's delayRender handle, so the draw made here is in the captured
// frame — no delayRender of our own.
//
// Player: ONE paint per presented frame. While the video plays,
// `requestVideoFrameCallback` owns painting (a frame it hands over has been
// composited, so it is drawable); the per-frame layout effect stands down
// while those callbacks keep arriving. When the Player is paused or
// scrubbing, the layout effect paints from the element and a short settle
// loop repaints for a few rAFs, because a draw made at `seeked` can come
// back empty (SceneMirror's finding). Before the first callback the element
// itself is the source as soon as it holds a frame.
//
// P0 (2026-09-18) measured the first prototype at 12–14 fps in the Player:
// it painted every frame up to three times (callback + layout effect +
// settle) at full source size. This shape is what the re-measure tests.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useCurrentFrame, useRemotionEnvironment, useVideoConfig } from 'remotion';
import type { FilterDefinition } from '../types/studio-effects';
import { createFilterRenderer, filterSourceSize, type FilterRenderer } from './filter-runtime';

/** One slot of the chain: a definition and the document's params for it. */
export interface FilterStage {
  definition: FilterDefinition;
  /** `intensity` plus the filter's own keys; missing keys take the defaults. */
  params?: Readonly<Record<string, number | string>>;
}

/** What the caller's media element must accept: the frame hook and its fit style. */
export interface FilteredMediaProps {
  onVideoFrame: (source: CanvasImageSource) => void;
  style: CSSProperties;
}

export interface FilteredPictureProps {
  kind: 'video' | 'image';
  /** The clip's fill style (objectFit + transform + opacity), as ClipRenderer builds it. */
  style: CSSProperties;
  /** Composition frames of source before the clip's first frame (`trimBefore`). */
  sourceOffset?: number;
  /** Filter first, then effect — render order. */
  chain: readonly FilterStage[];
  /** The composition size: the working canvas never exceeds it. */
  maxWidth: number;
  maxHeight: number;
  /**
   * Player only: the working canvas's long side never exceeds this — the
   * preview is ~900 px wide and plays a 540p proxy anyway, so filter math at
   * 1080p would be paid for nothing. A render always works at the
   * composition cap. 0 = no cap.
   */
  previewMaxSide?: number;
  /** Renders the media element itself — the caller keeps its engine switch
   *  and every other prop; it must spread `onVideoFrame` (or map it to Img's
   *  `onImageFrame`) and `style` onto the element. */
  renderMedia: (props: FilteredMediaProps) => ReactNode;
}

const SETTLE_FRAMES = 8;
/** A frame callback this recent means the video is playing and owns painting. */
const PLAYING_WINDOW_MS = 80;
export const DEFAULT_PREVIEW_MAX_SIDE = 640;

/** Split the clip's fill style: the box (transform/opacity) goes on the wrapper, the fit on both children. */
function splitStyle(style: CSSProperties): { box: CSSProperties; fit: CSSProperties } {
  const { transform, opacity, visibility, ...rest } = style;
  const box: CSSProperties = { position: 'absolute', inset: 0 };
  if (transform) box.transform = transform;
  if (opacity !== undefined) box.opacity = opacity;
  if (visibility) box.visibility = visibility;
  return { box, fit: { ...rest, width: '100%', height: '100%', objectFit: 'contain' } };
}

function isDrawable(source: CanvasImageSource | null): source is CanvasImageSource {
  if (!source) return false;
  if (source instanceof HTMLVideoElement) return source.readyState >= 2 && !source.seeking;
  if (source instanceof HTMLImageElement) return source.complete;
  return true;
}

export function FilteredPicture({
  kind,
  style,
  sourceOffset,
  chain,
  maxWidth,
  maxHeight,
  previewMaxSide = DEFAULT_PREVIEW_MAX_SIDE,
  renderMedia,
}: FilteredPictureProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSource = useRef<CanvasImageSource | null>(null);
  const lastCallbackAt = useRef(-Infinity);
  const stages = useRef<{ canvas: HTMLCanvasElement; renderer: FilterRenderer }[]>([]);
  const settle = useRef(0);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { box, fit } = useMemo(() => splitStyle(style), [style]);

  const paint = useCallback(
    (source: CanvasImageSource) => {
      const visible = canvasRef.current;
      const dims = filterSourceSize(source);
      if (!visible || !dims || chain.length === 0) return;
      const cap = !isRendering && previewMaxSide > 0 ? previewMaxSide / Math.max(dims.width, dims.height) : 1;
      const scale = Math.min(1, maxWidth / dims.width, maxHeight / dims.height, cap);
      const w = Math.max(1, Math.round(dims.width * scale));
      const h = Math.max(1, Math.round(dims.height * scale));
      // One renderer per stage; the last stage paints the visible canvas.
      while (stages.current.length < chain.length) {
        const own = stages.current.length === chain.length - 1 ? visible : document.createElement('canvas');
        own.width = w;
        own.height = h;
        stages.current.push({ canvas: own, renderer: createFilterRenderer(own) });
      }
      const time = (frameRef.current + (sourceOffset ?? 0)) / fps;
      let input: CanvasImageSource = source;
      chain.forEach((stage, i) => {
        const { canvas, renderer } = stages.current[i];
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const { intensity, ...parameters } = stage.params ?? {};
        renderer.render(stage.definition, {
          source: input,
          time,
          options: { ...(typeof intensity === 'number' ? { intensity } : {}), parameters },
        });
        input = canvas;
      });
    },
    [chain, fps, isRendering, maxWidth, maxHeight, previewMaxSide, sourceOffset],
  );

  // The media tag hands over a frame: the render host's <img> for THIS frame,
  // the Player's <video> whenever it presents one. Composited = drawable, so
  // no settling after it.
  const onVideoFrame = useCallback(
    (source: CanvasImageSource) => {
      lastSource.current = source;
      lastCallbackAt.current = performance.now();
      settle.current = 0;
      paint(source);
    },
    [paint],
  );

  // A new frame while paused or scrubbing (or an animated filter on a still):
  // repaint before the browser shows it, then settle in case the seek landed
  // late. Stands down while frame callbacks are arriving — the video is
  // playing and each callback already paints. Renders never take this path.
  useLayoutEffect(() => {
    if (isRendering) return;
    if (performance.now() - lastCallbackAt.current < PLAYING_WINDOW_MS) return;
    const source = lastSource.current;
    if (!isDrawable(source)) return;
    paint(source);
    if (source instanceof HTMLVideoElement) settle.current = SETTLE_FRAMES;
  });

  // Player only: the settle repaints, and — before the first callback — the
  // element itself as soon as it holds a frame.
  useEffect(() => {
    if (isRendering) return;
    let id = requestAnimationFrame(function loop() {
      if (!lastSource.current) {
        const element =
          wrapperRef.current?.querySelector<HTMLVideoElement | HTMLImageElement>(kind === 'video' ? 'video' : 'img') ?? null;
        if (isDrawable(element)) {
          lastSource.current = element;
          paint(element);
        }
      } else if (settle.current > 0 && isDrawable(lastSource.current)) {
        settle.current -= 1;
        paint(lastSource.current);
      }
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [isRendering, kind, paint]);

  useEffect(
    () => () => {
      for (const stage of stages.current) stage.renderer.dispose();
      stages.current = [];
    },
    [],
  );

  const media = useMemo(() => renderMedia({ onVideoFrame, style: fit }), [renderMedia, onVideoFrame, fit]);
  const canvasStyle: CSSProperties = { ...fit, position: 'absolute', inset: 0 };
  return (
    <div ref={wrapperRef} style={box}>
      {media}
      {/* data-scene-picture: what a transition window's SceneMirror copies. */}
      <canvas ref={canvasRef} data-scene-picture="" style={canvasStyle} />
    </div>
  );
}
