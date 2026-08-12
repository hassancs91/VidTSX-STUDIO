// Multi-clip (batch) timeline edits — the pure ops behind multi-select.
// Same contract as timeline-ops: clips on a track stay sorted and
// non-overlapping, and a rejected edit returns the IDENTICAL object so the
// reducer skips the undo step. One call = one undo step, however many clips.

import type { StudioClip, StudioTimeline, StudioTrack } from '../types';
import { clipEndTime, makeClipId } from './timeline-ops';
import { updateClip, type ClipPatch } from './clip-update-ops';

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

/**
 * Apply one inspector patch to a whole selection (multi-select volume/mute).
 * All-or-nothing on locked tracks like `moveClips`; identity when no clip
 * actually changes, so the reducer records at most one undo step.
 */
export function updateClips(
  timeline: StudioTimeline,
  clipIds: string[],
  patch: ClipPatch,
): StudioTimeline {
  const ids = new Set(clipIds);
  for (const track of timeline.tracks) {
    if (track.locked && track.clips.some((c) => ids.has(c.id))) return timeline;
  }
  let next = timeline;
  for (const id of clipIds) next = updateClip(next, id, patch);
  return next;
}

/** One copied clip: a snapshot plus where it came from and its place in the
 *  group. `offsetSeconds` is measured from the group's earliest clip so the
 *  relative layout survives however far away the paste lands. */
export interface ClipboardEntry {
  clip: StudioClip;
  trackId: string;
  offsetSeconds: number;
}

/** Same lane compatibility rule as clip-factory/useClipDrag: audio clips live
 *  on audio lanes, everything visual on any non-audio lane. */
function trackAcceptsKind(track: StudioTrack, kind: StudioClip['kind']): boolean {
  if (track.locked) return false;
  return kind === 'audio' || kind === 'sfx' ? track.kind === 'audio' : track.kind !== 'audio';
}

/**
 * Paste copied clips with their earliest member at `atSeconds`. Each entry
 * targets its source track when that still exists and can take the clip,
 * falling back to the first compatible unlocked track (like `trackForAsset`).
 * On collision with existing clips the WHOLE group shifts right together to
 * the nearest delta where every member fits — relative layout is never torn
 * apart. Rejects (identical object back, same contract as `moveClips`) when
 * any entry has no track to land on or the group overlaps itself.
 */
export function pasteClips(
  timeline: StudioTimeline,
  entries: ClipboardEntry[],
  atSeconds: number,
  newIds?: string[],
): StudioTimeline {
  if (entries.length === 0) return timeline;
  const at = Math.max(0, atSeconds);

  interface Placement {
    entry: ClipboardEntry;
    track: StudioTrack;
    desiredStart: number;
  }
  const placements: Placement[] = [];
  for (const entry of entries) {
    const source = timeline.tracks.find((t) => t.id === entry.trackId);
    const track =
      source && trackAcceptsKind(source, entry.clip.kind)
        ? source
        : timeline.tracks.find((t) => trackAcceptsKind(t, entry.clip.kind));
    if (!track) return timeline;
    placements.push({ entry, track, desiredStart: at + entry.offsetSeconds });
  }

  // The group must not overlap itself (possible when entries from different
  // source tracks fall back onto the same lane) — no shift can fix that.
  const byTrack = new Map<string, Placement[]>();
  for (const p of placements) {
    const list = byTrack.get(p.track.id) ?? [];
    list.push(p);
    byTrack.set(p.track.id, list);
  }
  for (const list of byTrack.values()) {
    const sorted = [...list].sort((a, b) => a.desiredStart - b.desiredStart);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      if (prev.desiredStart + prev.entry.clip.duration > sorted[i].desiredStart + 1e-9) {
        return timeline;
      }
    }
  }

  // Find the smallest rightward shift where every member fits. The minimal
  // fitting delta is either 0 or puts some member flush against an existing
  // clip's end, so those are the only candidates worth testing.
  const fits = (delta: number): boolean =>
    placements.every((p) => {
      const start = p.desiredStart + delta;
      const end = start + p.entry.clip.duration;
      return p.track.clips.every(
        (other) => clipEndTime(other) <= start + 1e-9 || other.timelineStart >= end - 1e-9,
      );
    });
  const candidates = [0];
  for (const p of placements) {
    for (const other of p.track.clips) {
      const delta = clipEndTime(other) - p.desiredStart;
      if (delta > 1e-9) candidates.push(delta);
    }
  }
  const delta = candidates.sort((a, b) => a - b).find(fits);
  if (delta === undefined) return timeline; // unreachable: past-everything always fits

  const pasted = placements.map((p, index) => ({
    trackId: p.track.id,
    clip: {
      ...p.entry.clip,
      id: newIds?.[index] ?? makeClipId(),
      timelineStart: p.desiredStart + delta,
    },
  }));
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      const additions = pasted.filter((p) => p.trackId === track.id).map((p) => p.clip);
      return additions.length > 0
        ? { ...track, clips: sortByStart([...track.clips, ...additions]) }
        : track;
    }),
  };
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
