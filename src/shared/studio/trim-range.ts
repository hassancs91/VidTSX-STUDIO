// Range export (Slice D2): cut a timeline down to the [rangeIn, rangeOut)
// window so `serializeTimeline` stays the single source of truth — the export
// handler trims the document and serializes the result exactly like a full
// export.
//
// Frame accuracy: both edges are snapped to the frame grid FIRST (the same
// cumulative-rounding rule as spanToFrames), so shifting every clip left by
// `rangeIn` can never move a cut point onto a different frame.

import type { StudioClip, StudioTimeline } from '../types/studio';
import { frameToTime, timeToFrame } from './time-math';

/**
 * The timeline as it plays between `rangeInSeconds` and `rangeOutSeconds`,
 * re-anchored at 0. Clips wholly outside the window drop; clips crossing an
 * edge are cut like a split — a clip whose head is cut loses its fade-in and
 * advances `sourceIn`, one whose tail is cut loses its fade-out (the discarded
 * ramp played outside the window, so the range renders exactly what the
 * preview plays inside it). Identity-on-reject for an invalid window.
 */
export function trimTimelineToRange(
  timeline: StudioTimeline,
  rangeInSeconds: number,
  rangeOutSeconds: number,
  fps: number,
): StudioTimeline {
  if (!Number.isFinite(rangeInSeconds) || !Number.isFinite(rangeOutSeconds) || !(fps > 0)) {
    return timeline;
  }
  const inFrame = Math.max(0, timeToFrame(rangeInSeconds, fps));
  const outFrame = timeToFrame(rangeOutSeconds, fps);
  if (outFrame <= inFrame) return timeline;
  const inSec = frameToTime(inFrame, fps);
  const outSec = frameToTime(outFrame, fps);

  const tracks = timeline.tracks.map((track) => ({
    ...track,
    clips: track.clips.flatMap((clip): StudioClip[] => {
      const start = Math.max(clip.timelineStart, inSec);
      const end = Math.min(clip.timelineStart + clip.duration, outSec);
      if (end <= start) return [];
      const headCut = start - clip.timelineStart;
      const tailCut = clip.timelineStart + clip.duration - end;
      const next: StudioClip = { ...clip, timelineStart: start - inSec, duration: end - start };
      if (headCut > 0) {
        delete next.fadeInSec;
        // Same convention as trimClip: sourceIn advances by timeline seconds.
        if (clip.sourceIn !== undefined) next.sourceIn = clip.sourceIn + headCut;
      }
      if (tailCut > 0) delete next.fadeOutSec;
      return [next];
    }),
  }));

  const markers = (timeline.markers ?? [])
    .filter((m) => m.time >= inSec && m.time <= outSec)
    .map((m) => ({ ...m, time: m.time - inSec }));

  const next: StudioTimeline = { ...timeline, tracks };
  if (markers.length > 0) next.markers = markers;
  else delete next.markers;
  return next;
}

/** Exact length of the range window in frames — the export renders this many
 *  even when the window runs past the last clip (trailing black/silence, like
 *  every NLE's in/out export). */
export function rangeDurationInFrames(
  rangeInSeconds: number,
  rangeOutSeconds: number,
  fps: number,
): number {
  return Math.max(
    0,
    timeToFrame(rangeOutSeconds, fps) - Math.max(0, timeToFrame(rangeInSeconds, fps)),
  );
}
