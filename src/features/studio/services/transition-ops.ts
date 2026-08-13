// Transition edits (Slice E) — pure, identity-on-reject, same contract as
// timeline-ops. A transition lives on the LEADING clip of a contiguous pair
// (`transitionOut`); the document never stores an overlap. Validity is a
// TIMELINE invariant, not a per-op one: `pruneTransitions` runs in the
// reducer's commit path so every op — current and future — drops a transition
// the moment its boundary stops being contiguous. Design notes:
// docs/studio/TRANSITIONS_DESIGN.md.

import type { StudioClip, StudioTimeline, StudioTransitionKind } from '../types';
import { clipEndTime, findClip, withTrackClips } from './timeline-ops';

/** Contiguity tolerance: times are floats produced by arithmetic, not input. */
const EPSILON = 1e-6;

/** Shortest sensible transition (one 25 fps frame each side of the cut). */
export const MIN_TRANSITION_DURATION = 0.08;

/** The clip that starts exactly where `clip` ends on this track, if any. */
export function contiguousNext(clips: StudioClip[], clip: StudioClip): StudioClip | null {
  const end = clipEndTime(clip);
  return (
    clips.find((c) => c.id !== clip.id && Math.abs(c.timelineStart - end) < EPSILON) ?? null
  );
}

/**
 * Set (or replace) the transition at a clip's end boundary. Rejects when the
 * clip is unknown, its track is locked, or no clip starts exactly at its end.
 * Duration clamps to both clips' lengths; source-handle clamping for
 * crossfades happens at render time (handles shrink under later trims anyway).
 */
export function setTransition(
  timeline: StudioTimeline,
  clipId: string,
  kind: StudioTransitionKind,
  duration: number,
): StudioTimeline {
  if (!Number.isFinite(duration) || duration < MIN_TRANSITION_DURATION) return timeline;
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const { clip, track } = found;
  const next = contiguousNext(track.clips, clip);
  if (!next) return timeline;

  const clamped = Math.min(duration, clip.duration, next.duration);
  if (
    clip.transitionOut &&
    clip.transitionOut.kind === kind &&
    clip.transitionOut.duration === clamped
  ) {
    return timeline;
  }
  return withTrackClips(
    timeline,
    track.id,
    track.clips.map((c) =>
      c.id === clipId ? { ...c, transitionOut: { kind, duration: clamped } } : c,
    ),
  );
}

export function removeTransition(timeline: StudioTimeline, clipId: string): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked || !found.clip.transitionOut) return timeline;
  return withTrackClips(
    timeline,
    found.track.id,
    found.track.clips.map((c) => {
      if (c.id !== clipId) return c;
      const next = { ...c };
      delete next.transitionOut;
      return next;
    }),
  );
}

/**
 * Drop every `transitionOut` whose boundary is no longer contiguous. Runs on
 * every reducer commit; returns the IDENTICAL object when nothing is invalid,
 * so rejected edits stay rejected and a prune caused by an edit lands in the
 * same undo step as the edit itself.
 */
export function pruneTransitions(timeline: StudioTimeline): StudioTimeline {
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    if (!track.clips.some((c) => c.transitionOut)) return track;
    const clips = track.clips.map((clip) => {
      if (!clip.transitionOut) return clip;
      if (contiguousNext(track.clips, clip)) return clip;
      changed = true;
      const next = { ...clip };
      delete next.transitionOut;
      return next;
    });
    return clips.some((c, i) => c !== track.clips[i]) ? { ...track, clips } : track;
  });
  return changed ? { ...timeline, tracks } : timeline;
}
