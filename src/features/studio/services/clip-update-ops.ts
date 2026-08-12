// Clip-property edits from the Inspector and the clip context menu — split
// out of timeline-ops.ts (structural edits) to keep both files under the
// ~300-line house rule. Same contract: pure, identity-on-reject, clips on a
// track stay sorted and non-overlapping.

import type { StudioClip, StudioClipTransform, StudioTimeline } from '../types';
import {
  MIN_CLIP_DURATION,
  clampFades,
  clipEndTime,
  findClip,
  makeClipId,
  withTrackClips,
} from './timeline-ops';
import { addTrack } from './track-ops';

/** Inspector-settable clip fields. `transform` merges field-wise into the
 *  existing transform; a field set to its neutral value is dropped, so
 *  documents never accumulate no-op state. Fades are clamped to the fade
 *  invariant (fadeIn + fadeOut ≤ duration, fade-in wins). */
export interface ClipPatch {
  gain?: number;
  label?: string;
  transform?: StudioClipTransform;
  fadeInSec?: number;
  fadeOutSec?: number;
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
  return TRANSFORM_KEYS.every(
    (k) => (a?.[k] ?? TRANSFORM_NEUTRAL[k]) === (b?.[k] ?? TRANSFORM_NEUTRAL[k]),
  );
}

/**
 * Patch a clip's inspector fields. Values equal to the neutral default
 * (gain 1, empty label, identity transform field, zero fade) REMOVE the key
 * instead of storing it. Speed is deliberately not here — it changes the
 * clip's duration and needs neighbour clamping, see `setClipSpeed`.
 */
export function updateClip(
  timeline: StudioTimeline,
  clipId: string,
  patch: ClipPatch,
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked) return timeline;
  const { clip, track } = found;

  let next: StudioClip = { ...clip };
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
  if (patch.fadeInSec !== undefined && Number.isFinite(patch.fadeInSec)) {
    next.fadeInSec = patch.fadeInSec;
  }
  if (patch.fadeOutSec !== undefined && Number.isFinite(patch.fadeOutSec)) {
    next.fadeOutSec = patch.fadeOutSec;
  }
  next = clampFades(next);

  const unchanged =
    (next.gain ?? 1) === (clip.gain ?? 1) &&
    next.label === clip.label &&
    (next.fadeInSec ?? 0) === (clip.fadeInSec ?? 0) &&
    (next.fadeOutSec ?? 0) === (clip.fadeOutSec ?? 0) &&
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
 * even the minimum clip length no longer fits. Fades re-clamp to the new
 * duration.
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
    track.clips.map((c) => (c.id === clipId ? clampFades(next) : c)),
  );
}

/**
 * Detach a video clip's audio: the video clip is muted (gain 0 — the one mute
 * concept, same as the inspector's mute) and a NEW audio clip appears with the
 * SAME assetId / timelineStart / duration / sourceIn / speed, so it is
 * sample-aligned by construction. Remotion's <Audio> plays a video file's
 * audio track directly (verified in preview + renderMedia, Slice C2 spike).
 *
 * The audio clip carries the video's pre-detach gain and fades (they describe
 * the sound, which now lives on the new clip). Target lane: the first
 * unlocked audio track whose span is free; a new audio track is appended when
 * none fits. One reducer dispatch = one undo step restores both sides.
 */
export function detachAudio(
  timeline: StudioTimeline,
  clipId: string,
  newId: string = makeClipId(),
): StudioTimeline {
  const found = findClip(timeline, clipId);
  if (!found || found.track.locked || found.clip.kind !== 'video') return timeline;
  const { clip, track } = found;
  if ((clip.gain ?? 1) === 0) return timeline; // already silent — nothing to detach

  const start = clip.timelineStart;
  const end = clipEndTime(clip);
  const spanFree = (clips: StudioClip[]) =>
    clips.every((c) => clipEndTime(c) <= start + 1e-9 || c.timelineStart >= end - 1e-9);
  const host = timeline.tracks.find(
    (t) => t.kind === 'audio' && !t.locked && spanFree(t.clips),
  );

  const audioClip: StudioClip = {
    id: newId,
    kind: 'audio',
    timelineStart: start,
    duration: clip.duration,
    origin: { by: 'user' },
    ...(clip.assetId !== undefined ? { assetId: clip.assetId } : {}),
    ...(clip.sourceIn !== undefined ? { sourceIn: clip.sourceIn } : {}),
    ...(clip.speed !== undefined ? { speed: clip.speed } : {}),
    ...(clip.gain !== undefined ? { gain: clip.gain } : {}),
    ...(clip.fadeInSec !== undefined ? { fadeInSec: clip.fadeInSec } : {}),
    ...(clip.fadeOutSec !== undefined ? { fadeOutSec: clip.fadeOutSec } : {}),
  };
  const mutedVideo: StudioClip = { ...clip, gain: 0 };
  delete mutedVideo.fadeInSec;
  delete mutedVideo.fadeOutSec;

  const withMuted = withTrackClips(
    timeline,
    track.id,
    track.clips.map((c) => (c.id === clipId ? mutedVideo : c)),
  );
  if (host) {
    const hostAfter = withMuted.tracks.find((t) => t.id === host.id);
    if (!hostAfter) return timeline;
    return withTrackClips(withMuted, host.id, [...hostAfter.clips, audioClip]);
  }
  const withNewTrack = addTrack(withMuted, 'audio');
  const created = withNewTrack.tracks[withNewTrack.tracks.length - 1];
  return withTrackClips(withNewTrack, created.id, [audioClip]);
}
