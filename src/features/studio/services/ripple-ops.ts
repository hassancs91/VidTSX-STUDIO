// Ripple across ALL tracks (video-10 feedback item 1, 2026-09-12).
//
// The ops in timeline-ops.ts ripple per track on purpose — a music bed should
// not move because a take was cut. These are the other mode: removing a SPAN
// of time from the master lane pulls every unlocked track along, so shots,
// B-roll and images placed against the master stay aligned with it after a
// cut. Locked tracks never move. Markers (absolute timeline seconds) follow
// the same rule. Pure; the identical object comes back when nothing changes.

import { masterLane } from '@shared/studio';
import type { StudioClip, StudioMarker, StudioTimeline, StudioTrack } from '../types';
import {
  MIN_CLIP_DURATION,
  clampFades,
  clipEndTime,
  clipRate,
  findClip,
  makeClipId,
  trimClip,
} from './timeline-ops';
import { removeClips } from './timeline-group-ops';

const EPS = 1e-6;

/**
 * Cut [from, to) out of one clip list. Clips inside the span vanish; a clip
 * straddling it keeps the parts outside (a left piece keeps the id, a right
 * piece plays on from `to` and lands at `from`, like a split whose middle was
 * deleted); everything after slides left by the span length.
 */
export function cutSpanFromClips(
  clips: StudioClip[],
  from: number,
  to: number,
  newId: () => string = makeClipId,
): { clips: StudioClip[]; changed: boolean } {
  const length = to - from;
  const out: StudioClip[] = [];
  let changed = false;
  for (const clip of clips) {
    const start = clip.timelineStart;
    const end = clipEndTime(clip);
    if (end <= from + EPS) {
      out.push(clip);
      continue;
    }
    if (start >= to - EPS) {
      out.push({ ...clip, timelineStart: Math.max(0, start - length) });
      changed = true;
      continue;
    }
    changed = true;
    const leftDuration = from - start;
    const rightDuration = end - to;
    const hasLeft = leftDuration >= MIN_CLIP_DURATION;
    const hasRight = rightDuration >= MIN_CLIP_DURATION;
    if (hasLeft) {
      const left: StudioClip = { ...clip, duration: leftDuration };
      if (hasRight) {
        // Same convention as splitClip: the two pieces are separate cuts now,
        // so a fade or transition at the removed middle would be audible.
        delete left.fadeOutSec;
        delete left.transitionOut;
      }
      out.push(clampFades(left));
    }
    if (hasRight) {
      const offset = to - start;
      const right: StudioClip = {
        ...clip,
        id: hasLeft ? newId() : clip.id,
        timelineStart: from,
        duration: rightDuration,
        // `offset` is timeline seconds; a sped clip has consumed offset × speed of source.
        sourceIn: (clip.sourceIn ?? 0) + offset * clipRate(clip),
      };
      if (hasLeft) delete right.fadeInSec;
      out.push(clampFades(right));
    }
  }
  return { clips: out, changed };
}

/** Markers inside the span vanish; later ones slide left. */
export function cutSpanFromMarkers(
  markers: StudioMarker[],
  from: number,
  to: number,
): { markers: StudioMarker[]; changed: boolean } {
  const length = to - from;
  let changed = false;
  const out: StudioMarker[] = [];
  for (const marker of markers) {
    if (marker.time < from - EPS) {
      out.push(marker);
    } else if (marker.time < to - EPS) {
      changed = true;
    } else {
      out.push({ ...marker, time: Math.max(0, marker.time - length) });
      changed = true;
    }
  }
  return { markers: out, changed };
}

function removeSpanFrom(
  timeline: StudioTimeline,
  from: number,
  to: number,
  pick: (track: StudioTrack) => boolean,
  withMarkers: boolean,
): StudioTimeline {
  const start = Math.max(0, from);
  if (to - start <= EPS) return timeline;
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    if (track.locked || !pick(track)) return track;
    const cut = cutSpanFromClips(track.clips, start, to);
    if (!cut.changed) return track;
    changed = true;
    return { ...track, clips: cut.clips };
  });
  let markers = timeline.markers;
  if (withMarkers && markers && markers.length > 0) {
    const cut = cutSpanFromMarkers(markers, start, to);
    if (cut.changed) {
      changed = true;
      markers = cut.markers;
    }
  }
  if (!changed) return timeline;
  return { ...timeline, tracks, ...(markers !== timeline.markers ? { markers } : {}) };
}

/** Remove [from, to) from every unlocked track and from the markers. */
export function removeSpanAllTracks(
  timeline: StudioTimeline,
  from: number,
  to: number,
): StudioTimeline {
  return removeSpanFrom(timeline, from, to, () => true, true);
}

/** Remove [from, to) from ONE track only — the per-track flavour of a range delete. */
export function removeSpanFromTrack(
  timeline: StudioTimeline,
  trackId: string,
  from: number,
  to: number,
): StudioTimeline {
  return removeSpanFrom(timeline, from, to, (t) => t.id === trackId, false);
}

/**
 * Open a gap: every clip starting at or after `at` on an unlocked track (and
 * every marker there) moves right by `length`. A clip straddling `at` holds.
 * `exceptClipId` stays put — the clip whose edge is being extended into the gap.
 */
export function insertGapAllTracks(
  timeline: StudioTimeline,
  at: number,
  length: number,
  exceptClipId?: string,
): StudioTimeline {
  if (length <= EPS) return timeline;
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    if (track.locked) return track;
    let trackChanged = false;
    const clips = track.clips.map((clip) => {
      if (clip.id === exceptClipId || clip.timelineStart < at - EPS) return clip;
      trackChanged = true;
      return { ...clip, timelineStart: clip.timelineStart + length };
    });
    if (!trackChanged) return track;
    changed = true;
    return { ...track, clips };
  });
  let markers = timeline.markers;
  if (markers && markers.some((m) => m.time >= at - EPS)) {
    changed = true;
    markers = markers.map((m) => (m.time >= at - EPS ? { ...m, time: m.time + length } : m));
  }
  if (!changed) return timeline;
  return { ...timeline, tracks, ...(markers !== timeline.markers ? { markers } : {}) };
}

/** Open a gap on ONE track — the per-track flavour; other lanes and the markers hold. */
export function insertGapOnTrack(
  timeline: StudioTimeline,
  trackId: string,
  at: number,
  length: number,
): StudioTimeline {
  if (length <= EPS) return timeline;
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track || track.locked || !track.clips.some((c) => c.timelineStart >= at - EPS)) return timeline;
  const clips = track.clips.map((clip) =>
    clip.timelineStart < at - EPS ? clip : { ...clip, timelineStart: clip.timelineStart + length },
  );
  return { ...timeline, tracks: timeline.tracks.map((t) => (t.id === trackId ? { ...t, clips } : t)) };
}

/**
 * Delete clips in "ripple all tracks" mode. A deleted MASTER-lane clip takes
 * its span of time out of the whole timeline; a deleted clip on any other lane
 * is an ordinary per-track ripple delete (removing a shot must never cut the
 * footage under it). One call = one undo step.
 */
export function removeClipsRippleAll(timeline: StudioTimeline, clipIds: string[]): StudioTimeline {
  const ids = new Set(clipIds);
  const master = masterLane(timeline);
  const masterClips = master && !master.locked ? master.clips.filter((c) => ids.has(c.id)) : [];
  let next = timeline;
  // Latest span first, so the earlier ones still sit at their original seconds.
  for (const clip of [...masterClips].sort((a, b) => b.timelineStart - a.timelineStart)) {
    next = removeSpanAllTracks(next, clip.timelineStart, clipEndTime(clip));
  }
  const masterIds = new Set(masterClips.map((c) => c.id));
  const rest = clipIds.filter((id) => !masterIds.has(id));
  return rest.length > 0 ? removeClips(next, rest, true) : next;
}

/**
 * Edge trim that keeps every track in sync when the clip sits on the master
 * lane: shortening pulls everything after the edge left, lengthening pushes
 * it right (so the neighbour never clamps the trim — the source length still
 * does). A clip on any other lane trims exactly as `trimClip` does.
 */
export function trimClipRippleAll(
  timeline: StudioTimeline,
  clipId: string,
  edge: 'start' | 'end',
  atSeconds: number,
  sourceDuration?: number,
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const master = masterLane(timeline);
  if (!master || master.id !== found.track.id) {
    return trimClip(timeline, clipId, edge, atSeconds, sourceDuration);
  }
  const { clip } = found;
  const start = clip.timelineStart;
  const end = clipEndTime(clip);
  const sourceIn = clip.sourceIn ?? 0;

  if (edge === 'end') {
    if (atSeconds < end - EPS) {
      const trimmed = trimClip(timeline, clipId, 'end', atSeconds, sourceDuration);
      const after = findClip(trimmed, clipId);
      if (!after) return timeline;
      return removeSpanAllTracks(trimmed, clipEndTime(after.clip), end);
    }
    const sourceLimit =
      sourceDuration !== undefined
        ? start + Math.max(MIN_CLIP_DURATION, sourceDuration - sourceIn)
        : Number.POSITIVE_INFINITY;
    const newEnd = Math.min(sourceLimit, atSeconds);
    if (newEnd <= end + EPS) return timeline;
    const opened = insertGapAllTracks(timeline, end, newEnd - end, clipId);
    return trimClip(opened, clipId, 'end', newEnd, sourceDuration);
  }

  if (atSeconds > start + EPS) {
    const trimmed = trimClip(timeline, clipId, 'start', atSeconds, sourceDuration);
    const after = findClip(trimmed, clipId);
    if (!after) return timeline;
    // The clip now starts at the span's end, so it slides back to `start`.
    return removeSpanAllTracks(trimmed, start, after.clip.timelineStart);
  }
  // Reveal earlier source: the clip and everything after it move right by the
  // extension, then the clip's start comes back to where it was.
  const earliest = Math.max(0, start - sourceIn);
  const newStart = Math.max(earliest, atSeconds);
  const delta = start - newStart;
  if (delta <= EPS) return timeline;
  const opened = insertGapAllTracks(timeline, start, delta);
  return trimClip(opened, clipId, 'start', start, sourceDuration);
}
