// Turning a media asset into a clip: the one place that decides default
// durations and which lane a kind belongs on.

import type { StudioClip, StudioMediaAsset, StudioTimeline, StudioTrack } from '../types';
import { makeClipId } from './timeline-ops';

/** How long a still image occupies the timeline when first placed. */
export const DEFAULT_IMAGE_DURATION = 5;

export function trackForAsset(
  timeline: StudioTimeline,
  asset: StudioMediaAsset,
): StudioTrack | null {
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
