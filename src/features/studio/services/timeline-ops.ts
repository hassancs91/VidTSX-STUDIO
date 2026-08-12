// Pure timeline-document edits. Every mouse gesture and (later) every agent
// tool call funnels through these functions, so the invariants live in one
// place: clips on a track are sorted by start time and never overlap.
//
// All times are seconds — see docs/studio/PLAN.md §4.

import type { StudioClip, StudioClipTransform, StudioTimeline, StudioTrack } from '../types';

/** Shortest clip a trim/split may leave behind (~1 frame at 25 fps). */
export const MIN_CLIP_DURATION = 0.04;

export function makeClipId(): string {
  return `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clipEndTime(clip: StudioClip): number {
  return clip.timelineStart + clip.duration;
}

export interface ClipLocation {
  track: StudioTrack;
  clip: StudioClip;
  index: number;
}

export function findClip(timeline: StudioTimeline, clipId: string): ClipLocation | null {
  for (const track of timeline.tracks) {
    const index = track.clips.findIndex((c) => c.id === clipId);
    if (index >= 0) return { track, clip: track.clips[index], index };
  }
  return null;
}

function sortByStart(clips: StudioClip[]): StudioClip[] {
  return [...clips].sort((a, b) => a.timelineStart - b.timelineStart);
}

/** Replace one track's clip list, keeping every other track identical. */
function withTrackClips(
  timeline: StudioTimeline,
  trackId: string,
  clips: StudioClip[],
): StudioTimeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: sortByStart(clips) } : t,
    ),
  };
}

/** First timeline second at or after `from` where `duration` fits on `track`. */
export function findFreeSlot(track: StudioTrack, duration: number, from = 0): number {
  let start = Math.max(0, from);
  for (const clip of sortByStart(track.clips)) {
    const end = clipEndTime(clip);
    if (end <= start) continue;
    if (clip.timelineStart >= start + duration) break;
    start = end;
  }
  return start;
}

/** Append a clip at the first free slot at/after `preferredStart`. */
export function addClip(
  timeline: StudioTimeline,
  trackId: string,
  clip: StudioClip,
  preferredStart = 0,
): StudioTimeline {
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track || track.locked) return timeline;
  const timelineStart = findFreeSlot(track, clip.duration, preferredStart);
  return withTrackClips(timeline, trackId, [...track.clips, { ...clip, timelineStart }]);
}

/**
 * Move a clip to `startSeconds`, optionally onto another track. The clip is
 * clamped so it never overlaps its new neighbours — gaps are allowed, overlaps
 * are not (S2 has no track-stacking UI to resolve them).
 */
export function moveClip(
  timeline: StudioTimeline,
  clipId: string,
  startSeconds: number,
  toTrackId?: string,
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found) return timeline;
  const targetId = toTrackId ?? found.track.id;
  const target = timeline.tracks.find((t) => t.id === targetId);
  if (!target || target.locked || found.track.locked) return timeline;

  const neighbours = target.clips.filter((c) => c.id !== clipId);
  const desired = Math.max(0, startSeconds);
  const duration = found.clip.duration;

  // Clamp between the closest neighbour edges around the drop point.
  let minStart = 0;
  let maxStart = Number.POSITIVE_INFINITY;
  for (const other of neighbours) {
    const otherEnd = clipEndTime(other);
    if (otherEnd <= desired) minStart = Math.max(minStart, otherEnd);
    else if (other.timelineStart >= desired + duration) {
      maxStart = Math.min(maxStart, other.timelineStart - duration);
    } else {
      // Overlapping the drop point: push to whichever side is nearer.
      const distanceToLeft = Math.abs(desired - (otherEnd - 0));
      const distanceToRight = Math.abs(other.timelineStart - (desired + duration));
      if (distanceToLeft <= distanceToRight) minStart = Math.max(minStart, otherEnd);
      else maxStart = Math.min(maxStart, Math.max(0, other.timelineStart - duration));
    }
  }
  const timelineStart = Math.max(minStart, Math.min(desired, maxStart));
  if (!Number.isFinite(timelineStart)) return timeline;

  const moved: StudioClip = { ...found.clip, timelineStart };
  if (targetId === found.track.id) {
    return withTrackClips(timeline, targetId, [...neighbours, moved]);
  }
  const withoutSource = withTrackClips(
    timeline,
    found.track.id,
    found.track.clips.filter((c) => c.id !== clipId),
  );
  return withTrackClips(withoutSource, targetId, [...neighbours, moved]);
}

/**
 * Cut a clip in two at `atSeconds`. The right half keeps playing the same
 * source from where the left half stopped, so a split is invisible until one
 * half is moved or deleted — the basis of the whole manual-cut workflow.
 */
export function splitClip(
  timeline: StudioTimeline,
  clipId: string,
  atSeconds: number,
  newId: string = makeClipId(),
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const { clip, track } = found;
  const offset = atSeconds - clip.timelineStart;
  if (offset < MIN_CLIP_DURATION || clip.duration - offset < MIN_CLIP_DURATION) {
    return timeline;
  }

  const left: StudioClip = { ...clip, duration: offset };
  const right: StudioClip = {
    ...clip,
    id: newId,
    timelineStart: atSeconds,
    duration: clip.duration - offset,
    ...(clip.sourceIn !== undefined ? { sourceIn: clip.sourceIn + offset } : {}),
  };
  return withTrackClips(
    timeline,
    track.id,
    track.clips.map((c) => (c.id === clipId ? left : c)).concat(right),
  );
}

/**
 * Drag a clip edge. Trimming the start also advances `sourceIn`, so the frame
 * under the edge stays put. Bounded by the neighbouring clips and by the
 * source media itself (`sourceDuration`, when known).
 */
export function trimClip(
  timeline: StudioTimeline,
  clipId: string,
  edge: 'start' | 'end',
  atSeconds: number,
  sourceDuration?: number,
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const { clip, track } = found;
  const sourceIn = clip.sourceIn ?? 0;
  const others = track.clips.filter((c) => c.id !== clipId);
  const end = clipEndTime(clip);

  if (edge === 'start') {
    const prevEnd = others
      .filter((c) => clipEndTime(c) <= clip.timelineStart)
      .reduce((max, c) => Math.max(max, clipEndTime(c)), 0);
    // Can't reveal source before its first frame.
    const earliest = Math.max(prevEnd, clip.timelineStart - sourceIn, 0);
    const newStart = Math.max(earliest, Math.min(atSeconds, end - MIN_CLIP_DURATION));
    const delta = newStart - clip.timelineStart;
    const next: StudioClip = {
      ...clip,
      timelineStart: newStart,
      duration: clip.duration - delta,
      ...(clip.sourceIn !== undefined ? { sourceIn: sourceIn + delta } : {}),
    };
    return withTrackClips(timeline, track.id, [...others, next]);
  }

  const nextStart = others
    .filter((c) => c.timelineStart >= end)
    .reduce((min, c) => Math.min(min, c.timelineStart), Number.POSITIVE_INFINITY);
  // Can't run past the last frame of the source.
  const sourceLimit =
    sourceDuration !== undefined
      ? clip.timelineStart + Math.max(MIN_CLIP_DURATION, sourceDuration - sourceIn)
      : Number.POSITIVE_INFINITY;
  const latest = Math.min(nextStart, sourceLimit);
  const newEnd = Math.min(latest, Math.max(atSeconds, clip.timelineStart + MIN_CLIP_DURATION));
  const next: StudioClip = { ...clip, duration: newEnd - clip.timelineStart };
  return withTrackClips(timeline, track.id, [...others, next]);
}

/**
 * Delete a clip. With `ripple`, later clips on the SAME track slide left to
 * close the gap — other tracks hold their timing, which is what you want when
 * music or an overlay shouldn't move because a bad take was cut.
 */
export function removeClip(
  timeline: StudioTimeline,
  clipId: string,
  ripple: boolean,
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const { clip, track } = found;
  const remaining = track.clips.filter((c) => c.id !== clipId);
  if (!ripple) return withTrackClips(timeline, track.id, remaining);

  const shifted = remaining.map((c) =>
    c.timelineStart >= clipEndTime(clip)
      ? { ...c, timelineStart: Math.max(0, c.timelineStart - clip.duration) }
      : c,
  );
  return withTrackClips(timeline, track.id, shifted);
}

/** Inspector-settable clip fields. `transform` merges field-wise into the
 *  existing transform; a field set to its neutral value is dropped, so
 *  documents never accumulate no-op transforms. */
export interface ClipPatch {
  gain?: number;
  label?: string;
  transform?: StudioClipTransform;
}

const TRANSFORM_NEUTRAL: Required<StudioClipTransform> = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};
const TRANSFORM_KEYS = Object.keys(TRANSFORM_NEUTRAL) as (keyof StudioClipTransform)[];

function sameTransform(a?: StudioClipTransform, b?: StudioClipTransform): boolean {
  return TRANSFORM_KEYS.every((k) => (a?.[k] ?? TRANSFORM_NEUTRAL[k]) === (b?.[k] ?? TRANSFORM_NEUTRAL[k]));
}

/**
 * Patch a clip's inspector fields. Values equal to the neutral default
 * (gain 1, empty label, identity transform field) REMOVE the key instead of
 * storing it. Speed is deliberately not here — it changes the clip's duration
 * and needs neighbour clamping, see `setClipSpeed`.
 */
export function updateClip(
  timeline: StudioTimeline,
  clipId: string,
  patch: ClipPatch,
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const { clip, track } = found;

  const next: StudioClip = { ...clip };
  if (patch.gain !== undefined) {
    const gain = Math.min(2, Math.max(0, patch.gain));
    if (gain === 1) delete next.gain;
    else next.gain = gain;
  }
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (label === '') delete next.label;
    else next.label = label;
  }
  if (patch.transform !== undefined) {
    const merged: StudioClipTransform = { ...clip.transform };
    for (const key of TRANSFORM_KEYS) {
      const value = patch.transform[key];
      if (value === undefined || !Number.isFinite(value)) continue;
      if (value === TRANSFORM_NEUTRAL[key]) delete merged[key];
      else merged[key] = value;
    }
    if (Object.keys(merged).length === 0) delete next.transform;
    else next.transform = merged;
  }

  const unchanged =
    (next.gain ?? 1) === (clip.gain ?? 1) &&
    next.label === clip.label &&
    sameTransform(next.transform, clip.transform);
  if (unchanged) return timeline;
  return withTrackClips(
    timeline,
    track.id,
    track.clips.map((c) => (c.id === clipId ? next : c)),
  );
}

/**
 * Change a clip's playback speed. The same source material now takes
 * `sourceSpan / speed` seconds, so `timelineStart` stays put and the duration
 * is recomputed, clamped against the next clip on the track exactly like an
 * end-trim (a clamp cuts off tail material; no ripple in v1). Rejects when
 * even the minimum clip length no longer fits.
 */
export function setClipSpeed(
  timeline: StudioTimeline,
  clipId: string,
  speed: number,
): StudioTimeline {
  if (!Number.isFinite(speed) || speed <= 0) return timeline;
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const { clip, track } = found;
  const current = clip.speed ?? 1;
  if (speed === current) return timeline;

  const desired = (clip.duration * current) / speed;
  const end = clipEndTime(clip);
  const nextStart = track.clips
    .filter((c) => c.id !== clipId && c.timelineStart >= end)
    .reduce((min, c) => Math.min(min, c.timelineStart), Number.POSITIVE_INFINITY);
  const duration = Math.min(desired, nextStart - clip.timelineStart);
  if (duration < MIN_CLIP_DURATION) return timeline;

  const next: StudioClip = { ...clip, duration };
  if (speed === 1) delete next.speed;
  else next.speed = speed;
  return withTrackClips(
    timeline,
    track.id,
    track.clips.map((c) => (c.id === clipId ? next : c)),
  );
}

/** Drop every clip that plays a given asset — used when the asset leaves the
 *  media pool, so the timeline never references media the project forgot. */
export function removeClipsForAsset(timeline: StudioTimeline, assetId: string): StudioTimeline {
  if (!timeline.tracks.some((t) => t.clips.some((c) => c.assetId === assetId))) return timeline;
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.assetId !== assetId),
    })),
  };
}

/** The clip under `seconds` on a track, if any. */
export function clipAt(track: StudioTrack, seconds: number): StudioClip | null {
  return (
    track.clips.find((c) => seconds >= c.timelineStart && seconds < clipEndTime(c)) ?? null
  );
}
