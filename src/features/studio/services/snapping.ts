// Magnetic snapping for drags. Snap targets are the things an editor actually
// wants to land on: the playhead, timeline zero, and every clip edge on the
// timeline (its own edges excluded).

import type { StudioTimeline } from '../types';
import { clipEndTime } from './timeline-ops';

/** How close (in pixels, so it feels the same at every zoom) a drag must get. */
export const SNAP_THRESHOLD_PX = 8;

export function collectSnapTargets(
  timeline: StudioTimeline,
  playheadSeconds: number,
  excludeClipId?: string,
): number[] {
  const targets = new Set<number>([0, playheadSeconds]);
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      targets.add(clip.timelineStart);
      targets.add(clipEndTime(clip));
    }
  }
  return [...targets].sort((a, b) => a - b);
}

export interface SnapResult {
  seconds: number;
  /** The target that was hit, for drawing the snap guide. */
  snappedTo: number | null;
}

/**
 * Snap `seconds` to the nearest target within the pixel threshold. When a clip
 * is dragged, both of its edges compete for the snap — passing `spanSeconds`
 * lets the trailing edge win when it is the closer one.
 */
export function snapSeconds(
  seconds: number,
  targets: number[],
  pxPerSecond: number,
  spanSeconds = 0,
): SnapResult {
  const threshold = SNAP_THRESHOLD_PX / pxPerSecond;
  let best: { seconds: number; target: number; distance: number } | null = null;

  for (const target of targets) {
    for (const edgeOffset of spanSeconds > 0 ? [0, spanSeconds] : [0]) {
      const candidate = target - edgeOffset;
      const distance = Math.abs(seconds - candidate);
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = { seconds: candidate, target, distance };
      }
    }
  }

  if (!best || best.seconds < 0) return { seconds, snappedTo: null };
  return { seconds: best.seconds, snappedTo: best.target };
}
