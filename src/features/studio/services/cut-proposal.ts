// Cut proposals, renderer side: the plan → proposal inversion is SHARED with
// the Studio agent's `run_auto_cut` (src/shared/studio/cut-proposal.ts) so
// the button and the chat emit the same proposal; this file re-exports it
// and keeps the timeline-side helpers — mapping source spans onto the
// current clips for the overlay and auditions, drag bounds, readouts.
//
// All times are seconds. Plan/item spans are SOURCE-media seconds; the
// mapping helpers translate them into TIMELINE seconds through the clips
// that play the asset (sourceIn/duration).

import type { StudioProposal, StudioProposalItem, StudioTimeline } from '../types';
import { clipEndTime } from './timeline-ops';

export {
  DEAD_AIR_MIN,
  MIN_CUT_SPAN,
  buildCutProposal,
  makeProposalId,
} from '@shared/studio/cut-proposal';
export type { BuildCutProposalInput, CutContextWord } from '@shared/studio/cut-proposal';

import { MIN_CUT_SPAN } from '@shared/studio/cut-proposal';

// ---------------------------------------------------------------------------
// Source-span → timeline-region mapping (for the overlay + auditions)
// ---------------------------------------------------------------------------

export interface CutTimelineRegion {
  itemId: string;
  trackId: string;
  clipId: string;
  /** Timeline seconds. */
  start: number;
  end: number;
}

/**
 * Where a cut item lands on the CURRENT timeline: the intersection of its
 * source span with every clip that plays the same asset. A span outside all
 * clips (already trimmed away) yields no regions.
 */
export function mapCutItemToTimeline(
  timeline: StudioTimeline,
  item: StudioProposalItem,
): CutTimelineRegion[] {
  if (!item.assetId || item.sourceStart === undefined || item.sourceEnd === undefined) return [];
  const regions: CutTimelineRegion[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId !== item.assetId) continue;
      const sourceIn = clip.sourceIn ?? 0;
      const from = Math.max(item.sourceStart, sourceIn);
      const to = Math.min(item.sourceEnd, sourceIn + clip.duration);
      if (to - from < 1e-6) continue;
      regions.push({
        itemId: item.id,
        trackId: track.id,
        clipId: clip.id,
        start: clip.timelineStart + (from - sourceIn),
        end: clip.timelineStart + (to - sourceIn),
      });
    }
  }
  return regions.sort((a, b) => a.start - b.start || a.trackId.localeCompare(b.trackId));
}

/** All regions of a proposal, flattened — the overlay layer's data. */
export function mapProposalToTimeline(
  timeline: StudioTimeline,
  proposal: StudioProposal,
): CutTimelineRegion[] {
  return proposal.items.flatMap((item) => mapCutItemToTimeline(timeline, item));
}

/**
 * Bounds for dragging one item's edges, in source seconds: an edge may move
 * inside the gap between its neighbouring cut items (so cuts never overlap)
 * and never past the asset's ends. The item itself keeps MIN_CUT_SPAN.
 */
export function cutItemDragBounds(
  proposal: StudioProposal,
  itemId: string,
  sourceDuration: number,
): { minStart: number; maxStart: number; minEnd: number; maxEnd: number } | null {
  const item = proposal.items.find((i) => i.id === itemId);
  if (!item || item.sourceStart === undefined || item.sourceEnd === undefined) return null;
  let prevEnd = 0;
  let nextStart = sourceDuration;
  for (const other of proposal.items) {
    if (other.id === itemId || other.assetId !== item.assetId) continue;
    if (other.sourceEnd !== undefined && other.sourceEnd <= item.sourceStart + 1e-6) {
      prevEnd = Math.max(prevEnd, other.sourceEnd);
    }
    if (other.sourceStart !== undefined && other.sourceStart >= item.sourceEnd - 1e-6) {
      nextStart = Math.min(nextStart, other.sourceStart);
    }
  }
  return {
    minStart: prevEnd,
    maxStart: item.sourceEnd - MIN_CUT_SPAN,
    minEnd: item.sourceStart + MIN_CUT_SPAN,
    maxEnd: nextStart,
  };
}

/** Total seconds removed by the accepted items of a proposal. */
export function acceptedRemovedSeconds(proposal: StudioProposal): number {
  return proposal.items.reduce((sum, item) => {
    if (item.status !== 'accepted') return sum;
    if (item.sourceStart === undefined || item.sourceEnd === undefined) return sum;
    return sum + (item.sourceEnd - item.sourceStart);
  }, 0);
}

/** Timeline end time — used for the "0:39.4 → 0:31.9" readout. */
export function timelineEndSeconds(timeline: StudioTimeline): number {
  return timeline.tracks.reduce(
    (max, track) => track.clips.reduce((m, clip) => Math.max(m, clipEndTime(clip)), max),
    0,
  );
}
