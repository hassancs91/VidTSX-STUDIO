// Turns a cut plan (keep-segments from the mechanical planner) into a
// reviewable proposal: the complement of the keeps becomes cut items the user
// audits on the timeline. Pure logic — no IPC, no document mutation.
//
// All times are seconds. Plan spans are SOURCE-media seconds; the mapping
// helpers at the bottom translate them into TIMELINE seconds through the
// clips that play the asset (sourceIn/duration), for the overlay regions.

import type { StudioCutPlan } from '@shared/types/studio-cut-plan';
import type {
  StudioCutCategory,
  StudioProposal,
  StudioProposalItem,
  StudioTimeline,
} from '../types';
import { clipEndTime } from './timeline-ops';

/** Spans shorter than this are not worth a cut (≈ one 25 fps frame). */
export const MIN_CUT_SPAN = 0.05;

/** A gap at least this long reads as dead air rather than a breath pause. */
export const DEAD_AIR_MIN = 2.0;

/** Structural subset of a transcript word — avoids importing engine types. */
export interface CutContextWord {
  text: string;
  start: number;
  end: number;
}

export function makeProposalId(): string {
  return `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Last word ending at or before `at`, first word starting at or after `at`. */
function contextAround(
  words: CutContextWord[],
  spanStart: number,
  spanEnd: number,
): { before?: string; after?: string; inside: string[] } {
  let before: string | undefined;
  let after: string | undefined;
  const inside: string[] = [];
  for (const word of words) {
    if (word.end <= spanStart + 1e-6) before = word.text;
    else if (word.start >= spanEnd - 1e-6) {
      after = word.text;
      break;
    } else inside.push(word.text);
  }
  return { before, after, inside };
}

function categoryForGap(gap: number): StudioCutCategory {
  return gap >= DEAD_AIR_MIN ? 'dead_air' : 'long_pause';
}

export interface BuildCutProposalInput {
  plan: StudioCutPlan;
  /** Transcript words for review context (empty array is fine). */
  words: CutContextWord[];
  /** Engine label for the header line, e.g. "assemblyai". */
  engine?: string;
  createdAt?: string;
}

/**
 * Invert the plan's keep-segments into cut items. Every item starts
 * `accepted` — the review flow is veto-based, not approval-based.
 */
export function buildCutProposal(input: BuildCutProposalInput): StudioProposal {
  const { plan, words } = input;
  const segments = [...plan.segments].sort((a, b) => a.start - b.start);
  const duration = plan.stats.sourceDuration;

  const spans: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const seg of segments) {
    if (seg.start - cursor >= MIN_CUT_SPAN) spans.push({ start: cursor, end: seg.start });
    cursor = Math.max(cursor, seg.end);
  }
  if (duration - cursor >= MIN_CUT_SPAN) spans.push({ start: cursor, end: duration });

  const items: StudioProposalItem[] = spans.map((span, i) => {
    const gap = span.end - span.start;
    const { before, after, inside } = contextAround(words, span.start, span.end);
    const parts: string[] = [];
    if (before) parts.push(`…${before}`);
    parts.push(`[${gap.toFixed(1)} s]`);
    if (after) parts.push(`${after}…`);
    return {
      id: `cut_${i}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'accepted',
      assetId: plan.assetId,
      sourceStart: span.start,
      sourceEnd: span.end,
      category: categoryForGap(gap),
      ...(inside.length > 0 ? { text: inside.join(' ') } : {}),
      note: parts.join(' '),
    };
  });

  const removed = spans.reduce((sum, s) => sum + (s.end - s.start), 0);
  const headline =
    `Auto Cut (${plan.styleName})` +
    (input.engine ? ` · ${input.engine}` : '') +
    ` · −${removed.toFixed(1)} s of ${duration.toFixed(1)} s` +
    ` · noise floor ${plan.stats.noiseFloorDb.toFixed(0)} dB`;

  return {
    id: makeProposalId(),
    kind: 'cut-plan',
    status: 'proposed',
    createdAt: input.createdAt ?? new Date().toISOString(),
    agentNote: [headline, ...plan.qaNotes].join('\n'),
    items,
  };
}

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
