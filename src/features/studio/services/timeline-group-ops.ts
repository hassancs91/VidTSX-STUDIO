// Multi-clip (batch) timeline edits — the pure ops behind multi-select.
// Same contract as timeline-ops: clips on a track stay sorted and
// non-overlapping, and a rejected edit returns the IDENTICAL object so the
// reducer skips the undo step. One call = one undo step, however many clips.

import type { StudioClip, StudioTimeline } from '../types';
import { clipEndTime } from './timeline-ops';

function sortByStart(clips: StudioClip[]): StudioClip[] {
  return [...clips].sort((a, b) => a.timelineStart - b.timelineStart);
}

/**
 * Move a GROUP of clips by one delta, preserving their relative positions.
 * Each clip stays on its own track. The delta is clamped so no selected clip
 * collides with an unselected neighbour or crosses zero; a group boxed in on
 * any side simply stops there. Locked tracks reject the whole move.
 */
export function moveClips(
  timeline: StudioTimeline,
  clipIds: string[],
  deltaSeconds: number,
): StudioTimeline {
  const ids = new Set(clipIds);
  let minDelta = Number.NEGATIVE_INFINITY;
  let maxDelta = Number.POSITIVE_INFINITY;
  let found = 0;

  for (const track of timeline.tracks) {
    const selected = track.clips.filter((c) => ids.has(c.id));
    if (selected.length === 0) continue;
    if (track.locked) return timeline;
    found += selected.length;
    const others = track.clips.filter((c) => !ids.has(c.id));
    for (const clip of selected) {
      const end = clipEndTime(clip);
      let prevEnd = 0;
      let nextStart = Number.POSITIVE_INFINITY;
      for (const other of others) {
        const otherEnd = clipEndTime(other);
        if (otherEnd <= clip.timelineStart + 1e-9) prevEnd = Math.max(prevEnd, otherEnd);
        else if (other.timelineStart >= end - 1e-9) {
          nextStart = Math.min(nextStart, other.timelineStart);
        }
      }
      minDelta = Math.max(minDelta, prevEnd - clip.timelineStart);
      maxDelta = Math.min(maxDelta, nextStart - end);
    }
  }
  if (found === 0) return timeline;
  if (minDelta > maxDelta + 1e-9) return timeline; // boxed in — nowhere to go
  const delta = Math.max(minDelta, Math.min(deltaSeconds, maxDelta));
  if (Math.abs(delta) < 1e-9) return timeline;

  return {
    ...timeline,
    tracks: timeline.tracks.map((track) =>
      track.clips.some((c) => ids.has(c.id))
        ? {
            ...track,
            clips: sortByStart(
              track.clips.map((c) =>
                ids.has(c.id) ? { ...c, timelineStart: c.timelineStart + delta } : c,
              ),
            ),
          }
        : track,
    ),
  };
}

/**
 * Delete a group of clips in one operation. With `ripple`, later clips on
 * each affected track slide left by the total duration removed before them —
 * the multi-clip generalisation of `removeClip`.
 */
export function removeClips(
  timeline: StudioTimeline,
  clipIds: string[],
  ripple: boolean,
): StudioTimeline {
  const ids = new Set(clipIds);
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    const removed = track.clips.filter((c) => ids.has(c.id));
    if (removed.length === 0 || track.locked) return track;
    changed = true;
    const remaining = track.clips.filter((c) => !ids.has(c.id));
    if (!ripple) return { ...track, clips: remaining };
    const shifted = remaining.map((clip) => {
      const removedBefore = removed
        .filter((r) => clipEndTime(r) <= clip.timelineStart + 1e-9)
        .reduce((sum, r) => sum + r.duration, 0);
      return removedBefore > 0
        ? { ...clip, timelineStart: Math.max(0, clip.timelineStart - removedBefore) }
        : clip;
    });
    return { ...track, clips: shifted };
  });
  return changed ? { ...timeline, tracks } : timeline;
}

/** Clip ids intersecting a marquee rectangle (content px), for drag-select. */
export function clipsInRect(
  timeline: StudioTimeline,
  pxPerSecond: number,
  trackHeight: number,
  rect: { x1: number; y1: number; x2: number; y2: number },
): string[] {
  const left = Math.min(rect.x1, rect.x2) / pxPerSecond;
  const right = Math.max(rect.x1, rect.x2) / pxPerSecond;
  const topRow = Math.floor(Math.min(rect.y1, rect.y2) / trackHeight);
  const bottomRow = Math.floor(Math.max(rect.y1, rect.y2) / trackHeight);
  const ids: string[] = [];
  timeline.tracks.forEach((track, row) => {
    if (row < topRow || row > bottomRow) return;
    for (const clip of track.clips) {
      if (clipEndTime(clip) > left && clip.timelineStart < right) ids.push(clip.id);
    }
  });
  return ids;
}
