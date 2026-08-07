// The one place seconds become frames — see docs/studio/PLAN.md §4.1.
//
// The timeline document speaks seconds only. Remotion speaks frames only.
// Every conversion goes through these helpers so the rounding rule is
// identical in the preview, the export, and any future agent tool.

import type { StudioClip, StudioTimeline } from '../types/studio';

/** Absolute frame index of a point in time. */
export function timeToFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

export function frameToTime(frame: number, fps: number): number {
  return frame / fps;
}

/**
 * Frame COUNT of the span [startSeconds, endSeconds).
 *
 * Cumulative rounding: both edges are rounded to absolute frames first and
 * only then subtracted (`round(b·fps) − round(a·fps)`, ported from the
 * reference pipeline's bake.py). Rounding each clip's duration on its own
 * would drift by up to half a frame per clip, which on a 100-cut timeline
 * becomes visible A/V slip; this way adjacent spans always tile exactly.
 */
export function spanToFrames(startSeconds: number, endSeconds: number, fps: number): number {
  return Math.max(0, timeToFrame(endSeconds, fps) - timeToFrame(startSeconds, fps));
}

/** Timeline seconds at which a clip stops being visible. */
export function clipEnd(clip: StudioClip): number {
  return clip.timelineStart + clip.duration;
}

/** Last occupied second across every track (0 for an empty timeline). */
export function timelineDuration(timeline: StudioTimeline): number {
  let end = 0;
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const clipEndTime = clipEnd(clip);
      if (clipEndTime > end) end = clipEndTime;
    }
  }
  return end;
}

/** Composition length in frames, never less than 1 (Remotion rejects 0). */
export function timelineDurationInFrames(timeline: StudioTimeline, fps: number): number {
  return Math.max(1, timeToFrame(timelineDuration(timeline), fps));
}
