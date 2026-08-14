// Turning a media asset into a clip: the one place that decides default
// durations and which lane a kind belongs on.

import type { StudioClip, StudioMediaAsset, StudioShot, StudioTimeline, StudioTrack } from '../types';
import { makeClipId } from './timeline-ops';

/** How long a still image occupies the timeline when first placed. */
export const DEFAULT_IMAGE_DURATION = 5;

/** Can this asset kind live on this track? Mirrors useClipDrag's acceptsClip:
 *  audio ↔ audio lanes, everything visual on any non-audio lane. */
function trackAccepts(track: StudioTrack, asset: StudioMediaAsset): boolean {
  if (track.locked) return false;
  return asset.kind === 'audio' ? track.kind === 'audio' : track.kind !== 'audio';
}

export function trackForAsset(
  timeline: StudioTimeline,
  asset: StudioMediaAsset,
  preferredTrackId?: string | null,
): StudioTrack | null {
  // The user's chosen track wins when it can hold the asset at all.
  const preferred = preferredTrackId
    ? timeline.tracks.find((t) => t.id === preferredTrackId)
    : undefined;
  if (preferred && trackAccepts(preferred, asset)) return preferred;

  const wanted = asset.kind === 'audio' ? 'audio' : 'video';
  return (
    timeline.tracks.find((t) => t.kind === wanted && !t.locked) ??
    timeline.tracks.find((t) => !t.locked) ??
    null
  );
}

export function clipFromAsset(asset: StudioMediaAsset): StudioClip {
  const duration =
    asset.kind === 'image' ? DEFAULT_IMAGE_DURATION : Math.max(0.1, asset.probe.duration);
  return {
    id: makeClipId(),
    kind: asset.kind,
    assetId: asset.id,
    timelineStart: 0,
    duration,
    sourceIn: 0,
    origin: { by: 'user' },
  };
}

/** Default clip duration when a shot has no parsed config to take it from. */
export const DEFAULT_SHOT_DURATION = 5;

/** A timeline clip referencing a shot registry entry (S4). `sourceIn: 0` is
 *  load-bearing: split advances a DEFINED sourceIn, which is what keeps the
 *  right half continuing the animation instead of restarting it (D5). */
export function clipFromShot(shot: StudioShot): StudioClip {
  const duration = shot.config
    ? Math.max(0.1, shot.config.durationInFrames / shot.config.fps)
    : DEFAULT_SHOT_DURATION;
  return {
    id: makeClipId(),
    kind: 'tsx',
    timelineStart: 0,
    duration,
    sourceIn: 0,
    tsx: { shotId: shot.id, mode: shot.kind === 'cutaway' ? 'cutaway' : 'overlay' },
    origin: shot.origin ?? { by: 'user' },
  };
}
