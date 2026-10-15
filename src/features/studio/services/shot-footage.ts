// What footage a shot plays over (P3 part 5, Hasan's 1(b)): the builder looks
// at a transparent shot over the frame it will cover, so the renderer, which
// owns the timeline, names it: the master lane's video clip at a timeline
// second (the playhead for the pool button, the clip's start in the
// Inspector) as its asset and the source second there. Anchored shots carry
// their own (main reads the anchor); nothing here = a checkerboard.

import { masterLane } from '@shared/studio/caption-words';
import type { StudioTimeline } from '../types';

export interface ShotFootage {
  assetId: string;
  sourceSeconds: number;
}

export function footageAt(timeline: StudioTimeline, seconds: number): ShotFootage | undefined {
  const lane = masterLane(timeline);
  if (!lane || lane.kind !== 'video') return undefined;
  const clip = lane.clips.find(
    (c) => c.kind === 'video' && c.assetId && seconds >= c.timelineStart && seconds < c.timelineStart + c.duration,
  );
  if (!clip?.assetId) return undefined;
  const rate = clip.speed && clip.speed > 0 ? clip.speed : 1;
  return { assetId: clip.assetId, sourceSeconds: (clip.sourceIn ?? 0) + (seconds - clip.timelineStart) * rate };
}
