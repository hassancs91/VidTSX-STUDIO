// Animation catalog + pure helpers for the Studio Animations tab and the
// composition that renders the arrows.
//
// The data shapes live in `@shared/ipc/types` (StudioClipAnimation,
// StudioAnimationState) because the composition — shared by preview + headless
// render — reads them. This module owns the EDIT-TIME and RENDER-TIME concerns
// that don't belong in the type file: the preset catalog the tab renders, the
// `from`/`to` fold that turns a clip's arrows into a per-frame visual state, the
// easing functions, and small immutable list helpers. No React state, no IPC —
// trivially testable.

import type { CSSProperties } from 'react';
import type {
  StudioAnimationState,
  StudioAnimationPreset,
  StudioAnimationEasing,
  StudioClipAnimation,
  LayerTransform,
} from '@shared/ipc/types';

export const DEFAULT_ANIMATION_DURATION_SECONDS = 0.7;
export const MIN_ANIMATION_DURATION_SECONDS = 0.1;
export const MAX_ANIMATION_DURATION_SECONDS = 5;

export type AnimationDirection = 'up' | 'down' | 'left' | 'right';

// ─── Resolved state ───
// A fully-populated visual state (no optional fields). `resolveAnimationState`
// folds a clip's arrows into one of these for the current frame; the composition
// turns it into CSS.
export interface ResolvedAnimationState {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  opacity: number;
}

export const RESTING_STATE: ResolvedAnimationState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  opacity: 1,
};

// Frame-based arrow consumed by the resolver. The composition passes these in
// (the edit-time StudioClipAnimation stores clip-relative seconds; the preview
// and render paths convert to frames first). `preset`/`direction` aren't needed
// here — `from`/`to` already encode the motion.
export interface AnimationArrow {
  startFrames: number;
  durationFrames: number;
  from: StudioAnimationState;
  to: StudioAnimationState;
  easing?: StudioAnimationEasing;
}

// Fill a sparse StudioAnimationState (absent field = resting for that property)
// into a full ResolvedAnimationState so endpoints can be interpolated.
function fill(s: StudioAnimationState): ResolvedAnimationState {
  return {
    scale: s.scale ?? RESTING_STATE.scale,
    offsetX: s.offsetX ?? RESTING_STATE.offsetX,
    offsetY: s.offsetY ?? RESTING_STATE.offsetY,
    rotation: s.rotation ?? RESTING_STATE.rotation,
    opacity: s.opacity ?? RESTING_STATE.opacity,
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function applyEasing(t: number, easing: StudioAnimationEasing | undefined): number {
  switch (easing) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'easeOutBack': {
      // Overshoots slightly past 1 then settles — a subtle bounce/pop feel.
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'linear':
    default:
      return t;
  }
}

function lerpState(
  a: ResolvedAnimationState,
  b: ResolvedAnimationState,
  t: number
): ResolvedAnimationState {
  const m = (x: number, y: number) => x + (y - x) * t;
  return {
    scale: m(a.scale, b.scale),
    offsetX: m(a.offsetX, b.offsetX),
    offsetY: m(a.offsetY, b.offsetY),
    rotation: m(a.rotation, b.rotation),
    opacity: m(a.opacity, b.opacity),
  };
}

// Fold a clip's arrows into the visual state at `frame` (clip-local). See the
// header comment on StudioClipAnimation in @shared/ipc/types for the rules:
//   • inside an arrow  → lerp(from, to, eased)
//   • after an arrow   → hold its `to`
//   • before the first → hold its `from`
//   • in a gap / none  → the previous arrow's `to` (or resting)
// Arrows are assumed non-overlapping (the editor enforces it). Pure — no hooks.
export function resolveAnimationState(
  arrows: AnimationArrow[] | undefined,
  frame: number
): ResolvedAnimationState {
  if (!arrows || arrows.length === 0) return RESTING_STATE;
  const sorted = [...arrows].sort((a, b) => a.startFrames - b.startFrames);

  // Before the first arrow: hold its `from` so an entrance stays off until it plays.
  if (frame < sorted[0].startFrames) return fill(sorted[0].from);

  let held = RESTING_STATE;
  for (const arrow of sorted) {
    const start = arrow.startFrames;
    const end = start + arrow.durationFrames;
    if (frame < start) {
      // In a gap between the previous arrow and this one → hold previous `to`.
      return held;
    }
    if (frame < end) {
      const dur = Math.max(1, arrow.durationFrames);
      const t = applyEasing(clamp01((frame - start) / dur), arrow.easing);
      return lerpState(fill(arrow.from), fill(arrow.to), t);
    }
    held = fill(arrow.to); // arrow fully ended → it becomes the held state
  }
  // After all arrows → hold the last `to`.
  return held;
}

// Turn a resolved state into the CSS the AnimationLayer applies. translate runs
// first (in composition px), then scale, then rotate, all about the box center.
export function animationStateToCss(s: ResolvedAnimationState): CSSProperties {
  const transforms: string[] = [];
  if (s.offsetX !== 0 || s.offsetY !== 0) {
    transforms.push(`translate(${s.offsetX}px, ${s.offsetY}px)`);
  }
  if (s.scale !== 1) transforms.push(`scale(${s.scale})`);
  if (s.rotation !== 0) transforms.push(`rotate(${s.rotation}deg)`);
  return {
    opacity: s.opacity,
    transform: transforms.length > 0 ? transforms.join(' ') : undefined,
  };
}

// ─── Canvas pose ↔ animation state (custom arrows) ───
// The AnimationLayer applies a state (scale/offset/rotation about center) INSIDE
// the clip's LayerBox, which itself scales the object into its resting box. So a
// state maps to a visible box on the canvas, and vice-versa. These two functions
// are exact inverses (for uniform scale — pose editing locks aspect to stay so).
//
//   box.size   = resting.size * scale
//   box.center = resting.center + offset * (resting.size / comp.size)
//   box.rot    = resting.rot + rotation

// Forward: the visible box a state produces, given the object's resting box.
export function effectivePoseBox(
  resting: LayerTransform,
  state: StudioAnimationState,
  compWidth: number,
  compHeight: number
): LayerTransform {
  const scale = state.scale ?? 1;
  const width = resting.width * scale;
  const height = resting.height * scale;
  const restCx = resting.x + resting.width / 2;
  const restCy = resting.y + resting.height / 2;
  const sx = compWidth > 0 ? resting.width / compWidth : 1;
  const sy = compHeight > 0 ? resting.height / compHeight : 1;
  const cx = restCx + (state.offsetX ?? 0) * sx;
  const cy = restCy + (state.offsetY ?? 0) * sy;
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotation: (resting.rotation ?? 0) + (state.rotation ?? 0),
  };
}

// Inverse: the state that reproduces an edited box. Scale is taken from the width
// ratio (pose editing locks aspect, so width and height ratios agree). `opacity`
// isn't expressible on the canvas, so it's carried over from `prev`.
export function poseBoxToState(
  resting: LayerTransform,
  box: LayerTransform,
  compWidth: number,
  compHeight: number,
  prev: StudioAnimationState
): StudioAnimationState {
  const scale = resting.width > 0 ? box.width / resting.width : 1;
  const restCx = resting.x + resting.width / 2;
  const restCy = resting.y + resting.height / 2;
  const boxCx = box.x + box.width / 2;
  const boxCy = box.y + box.height / 2;
  const sx = compWidth > 0 ? resting.width / compWidth : 1;
  const sy = compHeight > 0 ? resting.height / compHeight : 1;
  const offsetX = sx !== 0 ? (boxCx - restCx) / sx : 0;
  const offsetY = sy !== 0 ? (boxCy - restCy) / sy : 0;
  const rotation = (box.rotation ?? 0) - (resting.rotation ?? 0);
  return {
    scale,
    offsetX,
    offsetY,
    rotation,
    ...(prev.opacity !== undefined ? { opacity: prev.opacity } : {}),
  };
}

// ─── Preset catalog ───
// Each preset is just a `from`/`to` factory plus the metadata the tab needs to
// place and label it. `distance` (slide travel, composition px) is supplied by
// the caller from the object's box size so a slide enters from just off its own
// edge regardless of object scale.
export interface AnimationPresetDefinition {
  preset: StudioAnimationPreset;
  label: string;
  description: string;
  defaultDurationSeconds: number;
  // Where a freshly-dropped arrow sits on the clip by default.
  placement: 'start' | 'end' | 'anywhere';
  directional: boolean;
  defaultDirection?: AnimationDirection;
  defaultEasing: StudioAnimationEasing;
  build: (opts: { direction?: AnimationDirection; distance?: number }) => {
    from: StudioAnimationState;
    to: StudioAnimationState;
  };
}

function directionOffset(
  dir: AnimationDirection,
  dist: number
): { offsetX: number; offsetY: number } {
  switch (dir) {
    case 'left':
      return { offsetX: -dist, offsetY: 0 };
    case 'right':
      return { offsetX: dist, offsetY: 0 };
    case 'up':
      return { offsetX: 0, offsetY: -dist };
    case 'down':
      return { offsetX: 0, offsetY: dist };
  }
}

const DEFAULT_SLIDE_DISTANCE = 300;

// The eight starter presets, in display order.
export const ANIMATION_PRESETS: AnimationPresetDefinition[] = [
  {
    preset: 'fadeIn',
    label: 'Fade In',
    description: 'Object fades up from invisible to visible.',
    defaultDurationSeconds: DEFAULT_ANIMATION_DURATION_SECONDS,
    placement: 'start',
    directional: false,
    defaultEasing: 'easeOut',
    build: () => ({ from: { opacity: 0 }, to: {} }),
  },
  {
    preset: 'fadeOut',
    label: 'Fade Out',
    description: 'Object fades down to invisible.',
    defaultDurationSeconds: DEFAULT_ANIMATION_DURATION_SECONDS,
    placement: 'end',
    directional: false,
    defaultEasing: 'easeIn',
    build: () => ({ from: {}, to: { opacity: 0 } }),
  },
  {
    preset: 'popIn',
    label: 'Pop In',
    description: 'Object scales up from small while fading in.',
    defaultDurationSeconds: 0.5,
    placement: 'start',
    directional: false,
    defaultEasing: 'easeOut',
    build: () => ({ from: { scale: 0.4, opacity: 0 }, to: {} }),
  },
  {
    preset: 'slideIn',
    label: 'Slide In',
    description: 'Object slides into place from an edge while fading in.',
    defaultDurationSeconds: DEFAULT_ANIMATION_DURATION_SECONDS,
    placement: 'start',
    directional: true,
    defaultDirection: 'left',
    defaultEasing: 'easeOut',
    build: ({ direction = 'left', distance = DEFAULT_SLIDE_DISTANCE }) => ({
      from: { ...directionOffset(direction, distance), opacity: 0 },
      to: {},
    }),
  },
  {
    preset: 'slideOut',
    label: 'Slide Out',
    description: 'Object slides off toward an edge while fading out.',
    defaultDurationSeconds: DEFAULT_ANIMATION_DURATION_SECONDS,
    placement: 'end',
    directional: true,
    defaultDirection: 'right',
    defaultEasing: 'easeIn',
    build: ({ direction = 'right', distance = DEFAULT_SLIDE_DISTANCE }) => ({
      from: {},
      to: { ...directionOffset(direction, distance), opacity: 0 },
    }),
  },
  {
    preset: 'zoom',
    label: 'Zoom',
    description: 'A slow push that scales the object up.',
    defaultDurationSeconds: 1.5,
    placement: 'anywhere',
    directional: false,
    defaultEasing: 'easeInOut',
    build: () => ({ from: {}, to: { scale: 1.3 } }),
  },
  {
    preset: 'spinIn',
    label: 'Spin In',
    description: 'Object spins into place while fading in.',
    defaultDurationSeconds: 0.7,
    placement: 'start',
    directional: false,
    defaultEasing: 'easeOut',
    build: () => ({ from: { rotation: -180, opacity: 0 }, to: {} }),
  },
  {
    preset: 'tilt',
    label: 'Tilt',
    description: 'A subtle rotate that settles upright.',
    defaultDurationSeconds: 0.6,
    placement: 'start',
    directional: false,
    defaultEasing: 'easeOut',
    build: () => ({ from: { rotation: -8 }, to: {} }),
  },
  {
    preset: 'fly',
    label: 'Fly In',
    description: 'Slides in from an edge — no fade, just motion.',
    defaultDurationSeconds: DEFAULT_ANIMATION_DURATION_SECONDS,
    placement: 'start',
    directional: true,
    defaultDirection: 'left',
    defaultEasing: 'easeOut',
    build: ({ direction = 'left', distance = DEFAULT_SLIDE_DISTANCE }) => ({
      from: directionOffset(direction, distance),
      to: {},
    }),
  },
  {
    preset: 'bounceIn',
    label: 'Bounce In',
    description: 'Scales up from small with a springy overshoot.',
    defaultDurationSeconds: 0.7,
    placement: 'start',
    directional: false,
    defaultEasing: 'easeOutBack',
    build: () => ({ from: { scale: 0.3, opacity: 0 }, to: {} }),
  },
  {
    preset: 'zoomOut',
    label: 'Zoom Out',
    description: 'Starts scaled up and settles back to its resting size.',
    defaultDurationSeconds: 1,
    placement: 'start',
    directional: false,
    defaultEasing: 'easeOut',
    build: () => ({ from: { scale: 1.4 }, to: {} }),
  },
  {
    preset: 'spinOut',
    label: 'Spin Out',
    description: 'Spins away while fading out.',
    defaultDurationSeconds: 0.7,
    placement: 'end',
    directional: false,
    defaultEasing: 'easeIn',
    build: () => ({ from: {}, to: { rotation: 180, opacity: 0 } }),
  },
  {
    preset: 'pan',
    label: 'Pan',
    description: 'A slow positional drift across the span (emphasis).',
    defaultDurationSeconds: 2,
    placement: 'anywhere',
    directional: true,
    defaultDirection: 'right',
    defaultEasing: 'easeInOut',
    // A gentle drift — a fraction of the box so it reads as a pan, not a fly.
    build: ({ direction = 'right', distance = DEFAULT_SLIDE_DISTANCE }) => ({
      from: {},
      to: directionOffset(direction, distance * 0.3),
    }),
  },
  {
    preset: 'grow',
    label: 'Grow',
    description: 'A gentle scale-up that holds (emphasis). Pulse comes later.',
    defaultDurationSeconds: 0.8,
    placement: 'anywhere',
    directional: false,
    defaultEasing: 'easeInOut',
    build: () => ({ from: {}, to: { scale: 1.1 } }),
  },
  {
    preset: 'custom',
    label: 'Custom',
    description: 'Set the start/end pose yourself by dragging the object on the canvas.',
    defaultDurationSeconds: 1,
    placement: 'anywhere',
    directional: false,
    defaultEasing: 'easeInOut',
    // Starts as no motion (identity from→to); the user defines the pose on canvas.
    build: () => ({ from: {}, to: {} }),
  },
];

export function getAnimationPreset(preset: StudioAnimationPreset): AnimationPresetDefinition {
  // Non-null: ANIMATION_PRESETS covers every StudioAnimationPreset.
  return ANIMATION_PRESETS.find((p) => p.preset === preset)!;
}

function makeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// Default clip-relative start (seconds) for a freshly-dropped arrow, honoring
// the preset's placement. `playheadSeconds` is the playhead position relative to
// the clip start; used only by 'anywhere' presets.
export function defaultStartSeconds(
  def: AnimationPresetDefinition,
  clipDurationSeconds: number,
  durationSeconds: number,
  playheadSeconds: number
): number {
  const maxStart = Math.max(0, clipDurationSeconds - durationSeconds);
  switch (def.placement) {
    case 'start':
      return 0;
    case 'end':
      return maxStart;
    case 'anywhere':
      return Math.max(0, Math.min(maxStart, playheadSeconds));
  }
}

// Build a fresh StudioClipAnimation from a preset. `boxDimension` is the object
// box size (composition px) along the slide axis — passed so a slide enters from
// just off the object's own edge; defaults are used when omitted.
export function buildAnimation(
  preset: StudioAnimationPreset,
  opts: {
    startSeconds: number;
    durationSeconds: number;
    direction?: AnimationDirection;
    distance?: number;
  }
): StudioClipAnimation {
  const def = getAnimationPreset(preset);
  const direction = opts.direction ?? def.defaultDirection;
  const { from, to } = def.build({ direction, distance: opts.distance });
  return {
    id: makeId(),
    preset,
    startSeconds: opts.startSeconds,
    durationSeconds: opts.durationSeconds,
    from,
    to,
    direction: def.directional ? direction : undefined,
    easing: def.defaultEasing,
  };
}

// Find a clip-relative start where [start, start+duration] doesn't overlap any
// existing arrow. Prefers `desired`; otherwise the first gap wide enough; falls
// back to `desired` (allowing overlap) only when the clip has no room.
function findFreeStart(
  existing: StudioClipAnimation[],
  desired: number,
  duration: number,
  clipDuration: number
): number {
  const maxStart = Math.max(0, clipDuration - duration);
  const want = Math.max(0, Math.min(maxStart, desired));
  const occ = existing
    .map((a) => ({ s: a.startSeconds, e: a.startSeconds + a.durationSeconds }))
    .sort((x, y) => x.s - y.s);
  const overlaps = (s: number) => occ.some((o) => s < o.e && s + duration > o.s);
  if (!overlaps(want)) return want;
  let cursor = 0;
  for (const o of occ) {
    if (o.s - cursor >= duration && cursor <= maxStart) {
      return Math.max(0, Math.min(maxStart, cursor));
    }
    cursor = Math.max(cursor, o.e);
  }
  if (cursor <= maxStart) return cursor;
  return want; // no room — overlap as a last resort
}

// Build a freshly-placed arrow for a clip: honors the preset's placement (start
// / end / playhead), clamps the duration to the clip, derives the slide distance
// from the object's box along the chosen axis, and nudges off existing arrows.
export function placeAnimation(opts: {
  preset: StudioAnimationPreset;
  clipDurationSeconds: number;
  playheadClipSeconds: number;
  existing: StudioClipAnimation[] | undefined;
  boxWidth: number;
  boxHeight: number;
  direction?: AnimationDirection;
}): StudioClipAnimation {
  const def = getAnimationPreset(opts.preset);
  const clip = Math.max(MIN_ANIMATION_DURATION_SECONDS, opts.clipDurationSeconds);
  const duration = Math.max(
    MIN_ANIMATION_DURATION_SECONDS,
    Math.min(def.defaultDurationSeconds, clip)
  );
  const direction = opts.direction ?? def.defaultDirection;
  const distance =
    direction === 'up' || direction === 'down' ? opts.boxHeight : opts.boxWidth;
  const desired = defaultStartSeconds(def, clip, duration, opts.playheadClipSeconds);
  const start = findFreeStart(opts.existing ?? [], desired, duration, clip);
  return buildAnimation(opts.preset, {
    startSeconds: start,
    durationSeconds: duration,
    direction,
    distance: distance > 0 ? distance : undefined,
  });
}

// ─── Immutable list helpers ───
export function addAnimation(
  list: StudioClipAnimation[] | undefined,
  animation: StudioClipAnimation
): StudioClipAnimation[] {
  return [...(list ?? []), animation].sort((a, b) => a.startSeconds - b.startSeconds);
}

export function updateAnimation(
  list: StudioClipAnimation[] | undefined,
  id: string,
  patch: Partial<StudioClipAnimation>
): StudioClipAnimation[] | undefined {
  if (!list) return list;
  return list
    .map((a) => (a.id === id ? { ...a, ...patch } : a))
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

// Re-derive a directional preset's from/to for a new direction/distance, keeping
// its timing. No-op for non-directional presets.
export function reaimAnimation(
  animation: StudioClipAnimation,
  direction: AnimationDirection,
  distance?: number
): StudioClipAnimation {
  const def = getAnimationPreset(animation.preset);
  if (!def.directional) return animation;
  const { from, to } = def.build({ direction, distance });
  return { ...animation, direction, from, to };
}

export function removeAnimation(
  list: StudioClipAnimation[] | undefined,
  id: string
): StudioClipAnimation[] | undefined {
  if (!list) return undefined;
  const next = list.filter((a) => a.id !== id);
  return next.length > 0 ? next : undefined;
}

// ─── Clip-level helpers (shared by the video / image / text hooks) ───
// Every animatable track exposes the same fields the placement math needs, so
// one generic implementation drives all three hooks. The hook stays a one-liner.
interface AnimatableClip {
  id: string;
  startTime: number;
  endTime: number;
  transform?: LayerTransform;
  animations?: StudioClipAnimation[];
}

// Box used for slide distance: the clip's transform box, or the full canvas when
// the object is full-frame (untransformed).
function clipBox(clip: AnimatableClip, compWidth: number, compHeight: number) {
  return {
    width: clip.transform?.width ?? compWidth,
    height: clip.transform?.height ?? compHeight,
  };
}

export function clipAddAnimation<T extends AnimatableClip>(
  clips: T[],
  id: string,
  preset: StudioAnimationPreset,
  ctx: { playheadSeconds: number; compWidth: number; compHeight: number }
): T[] {
  return clips.map((c) => {
    if (c.id !== id) return c;
    const box = clipBox(c, ctx.compWidth, ctx.compHeight);
    const anim = placeAnimation({
      preset,
      clipDurationSeconds: c.endTime - c.startTime,
      playheadClipSeconds: ctx.playheadSeconds - c.startTime,
      existing: c.animations,
      boxWidth: box.width,
      boxHeight: box.height,
    });
    return { ...c, animations: addAnimation(c.animations, anim) };
  });
}

export function clipUpdateAnimation<T extends AnimatableClip>(
  clips: T[],
  id: string,
  animId: string,
  patch: Partial<StudioClipAnimation>,
  ctx: { compWidth: number; compHeight: number }
): T[] {
  return clips.map((c) => {
    if (c.id !== id) return c;
    let anims = updateAnimation(c.animations, animId, patch);
    // A direction change must re-derive the arrow's from/to for the new axis.
    if (patch.direction && anims) {
      const box = clipBox(c, ctx.compWidth, ctx.compHeight);
      const dist =
        patch.direction === 'up' || patch.direction === 'down' ? box.height : box.width;
      anims = anims.map((a) =>
        a.id === animId ? reaimAnimation(a, patch.direction!, dist) : a
      );
    }
    return { ...c, animations: anims };
  });
}

export function clipRemoveAnimation<T extends AnimatableClip>(
  clips: T[],
  id: string,
  animId: string
): T[] {
  return clips.map((c) =>
    c.id === id ? { ...c, animations: removeAnimation(c.animations, animId) } : c
  );
}

// Convert edit-time arrows (clip-relative seconds) to the frame-based form the
// resolver/composition consume. Shared by the preview builder and the export
// render-input builder so both stay in lockstep.
export function animationsToFrames(
  animations: StudioClipAnimation[] | undefined,
  fps: number
): AnimationArrow[] | undefined {
  if (!animations || animations.length === 0) return undefined;
  return animations.map((a) => ({
    startFrames: Math.round(a.startSeconds * fps),
    durationFrames: Math.max(1, Math.round(a.durationSeconds * fps)),
    from: a.from,
    to: a.to,
    easing: a.easing,
  }));
}
