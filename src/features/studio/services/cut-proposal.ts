// Cut proposals, renderer side: the plan → proposal inversion is SHARED with
// the Studio agent's `run_auto_cut` (src/shared/studio/cut-proposal.ts) so
// the button and the chat emit the same proposal; this file re-exports it
// and keeps the timeline-side helpers — mapping source spans onto the
// current clips for the overlay and auditions, drag bounds, readouts.
//
// All times are seconds. Plan/item spans are SOURCE-media seconds; the
// mapping helpers translate them into TIMELINE seconds through the clips
// that play the asset (sourceIn/duration).

import { masterLane } from '@shared/studio';
import { mapSourceSpanToTimeline } from '@shared/studio/source-span-map';
import type { CutQaItem, CutQaReport } from '@shared/types/studio-cut-plan';
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
 * clips (already trimmed away) yields no regions. The mapping itself is the
 * shared `mapSourceSpanToTimeline` (the cut anchor checks against it too).
 */
export function mapCutItemToTimeline(
  timeline: StudioTimeline,
  item: StudioProposalItem,
): CutTimelineRegion[] {
  if (!item.assetId || item.sourceStart === undefined || item.sourceEnd === undefined) return [];
  const span = { assetId: item.assetId, sourceStart: item.sourceStart, sourceEnd: item.sourceEnd };
  return mapSourceSpanToTimeline(timeline, span).map((region) => ({ itemId: item.id, ...region }));
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

/** "M:SS.d" — one decimal, because cut edges live under a second. */
export function formatCutTc(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

// ---------------------------------------------------------------------------
// Cut QA spots on the card (B3): where each one plays, and the list order
// ---------------------------------------------------------------------------

/** A QA spot auditions from ~1 s before it, ~2 s in all (B3 decision 3). */
export const QA_AUDITION_LEAD_S = 1;
export const QA_AUDITION_SPAN_S = 2;
/** Spots listed before "show all". */
export const QA_VISIBLE_SPOTS = 20;
/** A spot often sits exactly on a kept piece's edge — the slack handlePlayJoin uses too. */
const QA_EDGE_SLACK_S = 0.05;

/** One listed QA spot and where it plays on the RESULT timeline (null = not on it). */
export interface QaSpot {
  item: CutQaItem;
  time: number | null;
}

/**
 * Where a QA spot plays on the RESULT timeline (the proposal's accepted cuts
 * applied — what the Player plays while previewing): the first clip of the
 * spot's asset whose source window holds the time, master lane first. A spot
 * inside a span the proposal removes (an editorial tail can land past its
 * cut's start; a dragged edge can swallow a join) plays at that cut's join —
 * the kept edge, what the user will hear. Null when no clip plays it (trimmed
 * away) or the item names no asset. Clip speed is not applied, like
 * `mapCutItemToTimeline` and the cut apply.
 */
export function mapQaItemToTimeline(
  result: StudioTimeline,
  proposal: StudioProposal,
  item: CutQaItem,
): number | null {
  const assetId = item.assetId;
  if (!assetId) return null;
  const direct = sourceTimeOnTimeline(result, assetId, item.sourceTime);
  if (direct !== null) return direct;
  for (const cut of proposal.items) {
    const { sourceStart, sourceEnd } = cut;
    if (cut.status !== 'accepted' || cut.assetId !== assetId) continue;
    if (sourceStart === undefined || sourceEnd === undefined) continue;
    if (item.sourceTime <= sourceStart || item.sourceTime >= sourceEnd) continue;
    return (
      sourceTimeOnTimeline(result, assetId, sourceStart) ??
      sourceTimeOnTimeline(result, assetId, sourceEnd)
    );
  }
  return null;
}

/** The card's list: hard entries first (plan order), then tails loudest first. */
export function buildQaSpots(
  result: StudioTimeline,
  proposal: StudioProposal,
  qa: CutQaReport,
): QaSpot[] {
  const hard = qa.items.filter((x) => x.kind === 'hard-entry');
  const tails = qa.items
    .filter((x) => x.kind === 'clipped-tail')
    .sort((a, b) => b.overDb - a.overDb);
  return [...hard, ...tails].map((item) => ({
    item,
    time: mapQaItemToTimeline(result, proposal, item),
  }));
}

function sourceTimeOnTimeline(
  timeline: StudioTimeline,
  assetId: string,
  t: number,
): number | null {
  const master = masterLane(timeline);
  const lanes = master ? [master, ...timeline.tracks.filter((x) => x !== master)] : timeline.tracks;
  for (const lane of lanes) {
    const clips = lane.clips
      .filter((c) => c.assetId === assetId)
      .sort((a, b) => a.timelineStart - b.timelineStart);
    for (const clip of clips) {
      const sourceIn = clip.sourceIn ?? 0;
      if (t < sourceIn - QA_EDGE_SLACK_S || t > sourceIn + clip.duration + QA_EDGE_SLACK_S) continue;
      return clip.timelineStart + Math.min(Math.max(t - sourceIn, 0), clip.duration);
    }
  }
  return null;
}
