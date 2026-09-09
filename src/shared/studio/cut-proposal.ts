// Turns a cut plan (keep-segments from the mechanical planner) into a
// reviewable proposal: the complement of the keeps becomes cut items the user
// audits on the timeline. Pure logic — no IPC, no document mutation.
//
// Shared between the renderer's Auto Cut button (useAutoCut) and the Studio
// agent's `run_auto_cut` tool (W3), so both emit the SAME proposal — "buttons
// and chat converge" (docs/studio/PLAN.md §6). The timeline-mapping helpers
// stay renderer-side in features/studio/services/cut-proposal.ts.
//
// All times are seconds. Plan spans are SOURCE-media seconds.

import type { StudioCutPlan } from '../types/studio-cut-plan';
import type { StudioCutCategory, StudioProposal, StudioProposalItem } from '../types/studio';

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
