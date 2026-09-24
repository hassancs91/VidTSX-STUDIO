// Pack transitions — the pure half of how the composition renders them
// (docs/studio/TRANSITION_PACKS_DESIGN.md "Composition"). The serializer
// already built the overlap: a transition's two clips are both live across
// `transitionOut.frames` / `transitionIn.frames`. This decides which of those
// overlaps get a transition COMPONENT mounted over them (a "window"), and how
// much of each clip's own picture that window covers.

import type { StudioClipKind } from '../types/studio';
import type { SerializedClip } from './serialize';

/** Kinds the engine renders itself, as per-clip ramps. Bare (un-namespaced) on
 *  purpose: they predate packs and stay valid forever, so no document ever
 *  needs migrating. Every other kind is a pack transition's `<pack>/<item>`. */
const NATIVE_TRANSITION_KINDS: ReadonlySet<string> = new Set(['crossfade', 'dip-to-black']);

export function isNativeTransitionKind(kind: string): boolean {
  return NATIVE_TRANSITION_KINDS.has(kind);
}

/**
 * Audio through a transition. A dip is SUPPOSED to reach silence, so it ramps
 * linearly; everything else — the crossfade and every pack transition — hands
 * off at equal power so the summed energy across the overlap stays flat. The
 * composition's `volumeProp` and the export's `clipVolumeAt` both ask here,
 * which is what keeps the two from drifting apart.
 */
export function usesEqualPowerAudio(kind: string): boolean {
  return kind !== 'dip-to-black';
}

/** Clips that paint a picture a transition component can be handed. */
const PICTURE_KINDS: ReadonlySet<StudioClipKind> = new Set(['video', 'image', 'tsx']);

/** One boundary where a transition component renders both clips. */
export interface TransitionWindowPlan {
  /** The leading clip's id — a clip leads at most one boundary. */
  id: string;
  kind: string;
  leadId: string;
  trailId: string;
  /** Composition frame where both clips are first live. */
  from: number;
  /** Length of the overlap in composition frames. */
  frames: number;
}

/**
 * The windows on one track. `clips` is the serializer's output for the track,
 * in timeline order. A boundary gets a window only when the engine can't draw
 * it alone AND a component is on hand — a pack that isn't installed (or a
 * module that failed to load) therefore falls through to the crossfade ramps
 * the clips already carry, which is the graceful-degrade rule for free.
 *
 * The two sides are re-matched here rather than trusted: the serializer drops
 * clips it can't render (missing media, a shot still generating), so a clip's
 * array neighbour is not always its transition partner. Kind, length and the
 * overlap's own geometry all have to agree.
 */
export function planTransitionWindows(
  clips: readonly SerializedClip[],
  hasComponent: (kind: string) => boolean,
): TransitionWindowPlan[] {
  const windows: TransitionWindowPlan[] = [];
  for (let i = 0; i < clips.length - 1; i++) {
    const lead = clips[i];
    const trail = clips[i + 1];
    const out = lead.transitionOut;
    const into = trail.transitionIn;
    if (!out || !into || out.kind !== into.kind || out.frames !== into.frames) continue;
    if (out.frames <= 0 || isNativeTransitionKind(out.kind) || !hasComponent(out.kind)) continue;
    if (!PICTURE_KINDS.has(lead.kind) || !PICTURE_KINDS.has(trail.kind)) continue;
    // The overlap runs from the trailing clip's start to the leading clip's end.
    if (trail.from + into.frames !== lead.from + lead.durationInFrames) continue;
    windows.push({
      id: lead.id,
      kind: out.kind,
      leadId: lead.id,
      trailId: trail.id,
      from: trail.from,
      frames: into.frames,
    });
  }
  return windows;
}

/** Frames at each edge of a clip where a window paints its picture instead. */
export interface ClipCover {
  head: number;
  tail: number;
}

/** Per-clip cover for a track's windows; a clip with a transition at both ends gets both edges. */
export function coverByClip(windows: readonly TransitionWindowPlan[]): Map<string, ClipCover> {
  const covers = new Map<string, ClipCover>();
  const at = (id: string): ClipCover => {
    const existing = covers.get(id);
    if (existing) return existing;
    const created = { head: 0, tail: 0 };
    covers.set(id, created);
    return created;
  };
  for (const win of windows) {
    at(win.leadId).tail = win.frames;
    at(win.trailId).head = win.frames;
  }
  return covers;
}

/** Is the clip's own picture covered by a window at this clip-relative frame? */
export function isCovered(cover: ClipCover | undefined, frame: number, durationInFrames: number): boolean {
  if (!cover) return false;
  return frame < cover.head || frame >= durationInFrames - cover.tail;
}
