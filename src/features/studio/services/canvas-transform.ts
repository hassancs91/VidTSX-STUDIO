// Coordinate math for the Player's canvas-manipulation overlay (lean slice,
// 2026-08-14 decision): select a clip → bounding box, drag to move, corner
// handles for uniform scale. Everything here is pure — the React overlay only
// measures rects and forwards pointer events.
//
// Transform semantics (must match TimelineComposition.transformStyle): each
// visual clip is an absolute-fill element the size of the composition, styled
// `translate(x px, y px) scale(s)` with the CSS default center origin. So the
// element's center sits at (W/2 + x, H/2 + y) in composition pixels, its box
// is the composition size × scale, and x/y are UN-scaled composition pixels.
// The box describes the ELEMENT — a letterboxed picture inside it (objectFit
// contain) and an inspector-set rotation are deliberately not represented
// (rotation handles are ledgered in V2_FEATURES.md).

import type { StudioClipKind, StudioClipTransform } from '@shared/types/studio';
import type { SerializedTimeline } from '@shared/studio';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Axis-aligned box in composition pixels. */
export interface ClipBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ScaleCorner = 'nw' | 'ne' | 'sw' | 'se';

// Clamps mirror the Inspector's NumberFields exactly, so a drag can never
// produce a value the numeric controls would refuse to round-trip.
export const MIN_SCALE = 0.01;
export const MAX_SCALE = 10;
export const MAX_OFFSET = 10000;

/** Kinds the overlay manipulates — clips that paint pixels in the Player. */
export const VISUAL_KINDS: ReadonlySet<StudioClipKind> = new Set(['video', 'image', 'tsx']);

const CORNER_SIGN: Record<ScaleCorner, Point> = {
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  sw: { x: -1, y: 1 },
  se: { x: 1, y: 1 },
};

/**
 * Player pixels per composition pixel. The Player box keeps the composition's
 * aspect ratio (CSS `aspect-ratio`), so both axes agree; `min` only guards
 * sub-pixel layout noise from ever inflating a coordinate.
 */
export function fitScale(playerRect: Size, comp: Size): number {
  if (playerRect.width <= 0 || playerRect.height <= 0) return 0;
  return Math.min(playerRect.width / comp.width, playerRect.height / comp.height);
}

/** A point in player-local pixels → composition pixels. */
export function playerPointToComp(point: Point, playerRect: Size, comp: Size): Point {
  const fit = fitScale(playerRect, comp);
  if (fit === 0) return { x: 0, y: 0 };
  return { x: point.x / fit, y: point.y / fit };
}

/** The transformed element's box in composition pixels. */
export function clipBox(comp: Size, transform?: StudioClipTransform): ClipBox {
  const scale = transform?.scale ?? 1;
  const width = comp.width * scale;
  const height = comp.height * scale;
  const centerX = comp.width / 2 + (transform?.x ?? 0);
  const centerY = comp.height / 2 + (transform?.y ?? 0);
  return { left: centerX - width / 2, top: centerY - height / 2, width, height };
}

function clampOffset(value: number): number {
  return Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, Math.round(value)));
}

/** 4 decimals ≈ 0.01% — invisible on any canvas, keeps documents tidy. */
function roundScale(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * MOVE: the pointer delta (already in composition pixels) applied to the
 * gesture's starting transform. A zero delta returns the starting values, so
 * the reducer's identity check turns an accidental click into no undo step.
 */
export function moveGesture(
  start: StudioClipTransform | undefined,
  delta: Point,
): { x: number; y: number } {
  return {
    x: clampOffset((start?.x ?? 0) + delta.x),
    y: clampOffset((start?.y ?? 0) + delta.y),
  };
}

/**
 * SCALE from a corner handle, keeping the OPPOSITE corner anchored. The new
 * scale is the pointer's projection onto the box's fixed diagonal direction
 * (uniform scale can't honour both axes, and the projection is what makes the
 * dragged corner track the pointer as closely as the aspect allows). The
 * center is then recomputed from the anchor so it never drifts. Dragging past
 * the anchor clamps at MIN_SCALE instead of inverting the box.
 */
export function scaleGesture(
  comp: Size,
  start: StudioClipTransform | undefined,
  corner: ScaleCorner,
  pointer: Point,
): { x: number; y: number; scale: number } {
  const sign = CORNER_SIGN[corner];
  const startScale = start?.scale ?? 1;
  const center = { x: comp.width / 2 + (start?.x ?? 0), y: comp.height / 2 + (start?.y ?? 0) };
  const anchor = {
    x: center.x - (sign.x * comp.width * startScale) / 2,
    y: center.y - (sign.y * comp.height * startScale) / 2,
  };
  const diagonal = Math.hypot(comp.width, comp.height);
  // (dragged corner − anchor) at scale s is s·(±W, ±H): length s·diagonal
  // along a fixed direction. Project the pointer onto it and divide.
  const raw =
    ((pointer.x - anchor.x) * sign.x * comp.width +
      (pointer.y - anchor.y) * sign.y * comp.height) /
    (diagonal * diagonal);
  const scale = roundScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw)));
  return {
    x: clampOffset(anchor.x + (sign.x * comp.width * scale) / 2 - comp.width / 2),
    y: clampOffset(anchor.y + (sign.y * comp.height * scale) / 2 - comp.height / 2),
    scale,
  };
}

/**
 * Topmost visual clip under a composition-space point at a frame — the
 * click-in-player selection. Priority is exactly the serializer's paint
 * order: tracks[] is UI order and painted in REVERSE, so tracks[0] (the top
 * lane) lands on top; within a track a trailing clip paints over the leading
 * one through a crossfade overlap, so clips are checked back-to-front too.
 * Serialized clips are used (not the document) so hidden tracks and dropped
 * clips are skipped for free.
 */
export function hitTestClip(
  timeline: SerializedTimeline,
  frame: number,
  point: Point,
): string | null {
  const comp = { width: timeline.width, height: timeline.height };
  for (const track of timeline.tracks) {
    for (let i = track.clips.length - 1; i >= 0; i--) {
      const clip = track.clips[i];
      if (!VISUAL_KINDS.has(clip.kind)) continue;
      if (frame < clip.from || frame >= clip.from + clip.durationInFrames) continue;
      const box = clipBox(comp, clip.transform);
      if (
        point.x >= box.left &&
        point.x <= box.left + box.width &&
        point.y >= box.top &&
        point.y <= box.top + box.height
      ) {
        return clip.id;
      }
    }
  }
  return null;
}

/**
 * The live-preview injection: the serialized timeline with one clip's
 * transform fields overridden (merged over the existing transform, so a drag
 * of x/y never wipes an opacity). Returns the SAME object when the clip isn't
 * in the serialization, so memos don't churn.
 */
export function overrideClipTransform(
  timeline: SerializedTimeline,
  clipId: string,
  transform: StudioClipTransform,
): SerializedTimeline {
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index === -1) return track;
    changed = true;
    const clips = track.clips.slice();
    clips[index] = { ...clips[index], transform: { ...clips[index].transform, ...transform } };
    return { ...track, clips };
  });
  return changed ? { ...timeline, tracks } : timeline;
}
