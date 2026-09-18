// Restoring deleted text (NEXT_FEATURES_DESIGN.md Q5a) — the inverse of a text
// delete: open the join back up by the length of the missing source and put a
// clip there that plays it. The gap is read from the timeline as it is NOW,
// never from the pill that was clicked, so a stale pill can do no harm. Pure;
// one call = one undo step.

import { masterLane } from '@shared/studio';
import type { StudioClip, StudioTimeline } from '../types';
import { clipEndTime, clipRate, makeClipId, withTrackClips } from './timeline-ops';
import { insertGapAllTracks, insertGapOnTrack } from './ripple-ops';

const EPS = 1e-6;
/** Same tolerances the transcript document reads a join with. */
const JOIN_TOLERANCE = 0.05;
const MIN_RESTORE = 0.05;

export interface RestoreDeletionOptions {
  /** Push every unlocked lane and the markers along (the toolbar's ripple mode). */
  rippleAllTracks?: boolean;
  newClipId?: string;
}

/**
 * Bring back the source between `beforeClipId` and `afterClipId`. Returns the
 * SAME timeline when the two are no longer one join of one source (moved,
 * trimmed, re-cut, locked) — the reducer reads identity as "no undo step".
 */
export function restoreDeletion(
  timeline: StudioTimeline,
  beforeClipId: string,
  afterClipId: string,
  options: RestoreDeletionOptions = {},
): StudioTimeline {
  const lane = masterLane(timeline);
  if (!lane || lane.locked) return timeline;
  const before = lane.clips.find((c) => c.id === beforeClipId);
  const after = lane.clips.find((c) => c.id === afterClipId);
  if (!before || !after || !before.assetId || before.assetId !== after.assetId) return timeline;
  if (Math.abs(after.timelineStart - clipEndTime(before)) > JOIN_TOLERANCE) return timeline;

  const rate = clipRate(before);
  if (Math.abs(rate - clipRate(after)) > EPS) return timeline;
  const gapStart = (before.sourceIn ?? 0) + before.duration * rate;
  const gap = (after.sourceIn ?? 0) - gapStart;
  if (gap < MIN_RESTORE) return timeline;

  const at = after.timelineStart;
  const length = gap / rate;
  const opened = options.rippleAllTracks
    ? insertGapAllTracks(timeline, at, length)
    : insertGapOnTrack(timeline, lane.id, at, length);
  const openedLane = opened.tracks.find((t) => t.id === lane.id);
  if (opened === timeline || !openedLane) return timeline;

  // The restored piece takes the look of the piece it continues, but none of
  // its edge state: a fade or transition belongs to a boundary, and this clip
  // sits between two invisible ones.
  const restored: StudioClip = {
    ...before,
    id: options.newClipId ?? makeClipId(),
    timelineStart: at,
    duration: length,
    sourceIn: gapStart,
    origin: { by: 'user' },
  };
  delete restored.fadeInSec;
  delete restored.fadeOutSec;
  delete restored.transitionOut;
  delete restored.label;
  delete restored.note;
  return withTrackClips(opened, lane.id, [...openedLane.clips, restored]);
}
