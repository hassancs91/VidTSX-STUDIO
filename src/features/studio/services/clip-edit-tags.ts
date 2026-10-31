// Tag the user's edits on the timeline (plan T1 "the learning signal", B4).
// The reducer runs the edit op first, then hands the before/after timelines
// here: a trim tags the edge it actually moved 'trim'; a Transcript delete
// tags every master-lane edge it created 'text-delete'. Undo needs nothing —
// the history keeps the untagged document. Pure; the SAME timeline comes back
// when there is nothing to tag (the reducer reads identity as "no change").

import { masterLane, withEdgeTag } from '@shared/studio';
import type { ClipEdge } from '@shared/studio';
import type { StudioClip, StudioTimeline } from '../types';
import { clipRate, findClip, withTrackClips } from './timeline-ops';

/** Two source seconds closer than this are the same edge. */
const EPS = 1e-6;

const sourceStart = (clip: StudioClip): number => clip.sourceIn ?? 0;
const sourceEnd = (clip: StudioClip): number => sourceStart(clip) + clip.duration * clipRate(clip);
const sourceAt = (clip: StudioClip, edge: ClipEdge): number =>
  edge === 'start' ? sourceStart(clip) : sourceEnd(clip);

/** After a user trim of `clipId`'s `edge`: tag it 'trim' when its source second moved. */
export function tagTrimmedEdge(
  before: StudioTimeline,
  after: StudioTimeline,
  clipId: string,
  edge: ClipEdge,
): StudioTimeline {
  if (after === before) return after;
  const was = findClip(before, clipId);
  const now = findClip(after, clipId);
  if (!was || !now) return after;
  if (Math.abs(sourceAt(now.clip, edge) - sourceAt(was.clip, edge)) <= EPS) return after;
  return replaceClip(after, now.track.id, withEdgeTag(now.clip, edge, 'trim'));
}

/**
 * After a Transcript delete: tag the master-lane edges it created. A piece
 * whose source start or end moved got a new edge there; a piece with a new id
 * is the right half of a clip the delete went through (its start is new).
 */
export function tagTextDeleteEdges(before: StudioTimeline, after: StudioTimeline): StudioTimeline {
  if (after === before) return after;
  const lane = masterLane(after);
  if (!lane) return after;
  const old = new Map((masterLane(before)?.clips ?? []).map((c) => [c.id, c]));
  let changed = false;
  const clips = lane.clips.map((clip) => {
    const was = old.get(clip.id);
    let next = clip;
    if (!was || Math.abs(sourceStart(clip) - sourceStart(was)) > EPS) {
      next = withEdgeTag(next, 'start', 'text-delete');
    }
    if (was && Math.abs(sourceEnd(clip) - sourceEnd(was)) > EPS) {
      next = withEdgeTag(next, 'end', 'text-delete');
    }
    if (next !== clip) changed = true;
    return next;
  });
  return changed ? withTrackClips(after, lane.id, clips) : after;
}

function replaceClip(timeline: StudioTimeline, trackId: string, clip: StudioClip): StudioTimeline {
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track) return timeline;
  return withTrackClips(
    timeline,
    trackId,
    track.clips.map((c) => (c.id === clip.id ? clip : c)),
  );
}
