// Editorial cut pass: the agent authors WHAT to remove (retakes, false
// starts, fillers, fluff) as word-time spans; this module decides exactly
// WHERE the edges land. Edges are snapped with the same planner the
// mechanical pass uses — head pads, RMS tails, and the clamp that stops a
// tail riding into cut speech — but with pause compression disabled
// (internalGap = ∞): silence removal is Auto Cut's job, not the editorial
// pass's. The snapping itself is src/shared/studio/cut-snap.ts (the Transcript
// panel's text delete uses it too); this file types it to the agent's categories
// and wraps the result as a proposal. Pure logic; the studio-agent service does
// the I/O around it.

import type {
  StudioCutCategory,
  StudioProposal,
  StudioProposalItem,
} from '../../../shared/types/studio';
import type { CutQaReport } from '../../../shared/types/studio-cut-plan';
import { withQaAsset } from '../../../shared/studio/cut-qa';
import {
  snapCutSpans,
  type CutSpanInput,
  type SnapCutSpansInput,
  type SnapCutSpansResult,
  type SnappedCut,
} from '../../../shared/studio/cut-snap';

/** Categories the editorial agent may propose (subset of StudioCutCategory). */
export const EDITORIAL_CATEGORIES = ['retake', 'false_start', 'filler', 'fluff'] as const;
export type EditorialCategory = (typeof EDITORIAL_CATEGORIES)[number];

export type EditorialSpanInput = CutSpanInput<EditorialCategory>;
/** A snapped cut ready to become a proposal item. */
export type EditorialCutItem = SnappedCut<EditorialCategory>;
export type SnapEditorialCutsInput = SnapCutSpansInput<EditorialCategory>;
export type SnapEditorialCutsResult = SnapCutSpansResult<EditorialCategory>;

/**
 * Cuts that start in the same review state merge through any wordless gap
 * between them (B7); an accepted removal never swallows an unchecked fluff.
 */
function editorialMergeKey(category: EditorialCategory): string {
  return category === 'fluff' ? 'fluff' : 'cut';
}

/** The shared snapper (src/shared/studio/cut-snap.ts), typed to the agent's categories. */
export function snapEditorialCuts(input: SnapEditorialCutsInput): SnapEditorialCutsResult {
  return snapCutSpans({ mergeKey: editorialMergeKey, ...input });
}

export interface BuildEditorialProposalInput {
  assetId: string;
  items: EditorialCutItem[];
  removedSeconds: number;
  sourceDuration: number;
  /** Transcript engine label for the headline (e.g. 'assemblyai'). */
  engine?: string;
  /** The agent's one-line summary of the pass, shown under the headline. */
  summary?: string;
  qaNotes?: string[];
  /** The snapped plan's QA readout (`snapCutSpans` → `qa`); absent = none shown. */
  qa?: CutQaReport;
  createdAt?: string;
}

/**
 * Wrap snapped editorial cuts as a StudioProposal for the review UI.
 * Retakes/false starts/fillers start ACCEPTED (veto-based review); fluff
 * starts REJECTED — the clean-cut policy is "suggest, don't auto-remove".
 */
export function buildEditorialProposal(input: BuildEditorialProposalInput): StudioProposal {
  const items: StudioProposalItem[] = input.items.map((item, i) => ({
    id: `cut_${i}_${Math.random().toString(36).slice(2, 8)}`,
    status: item.category === 'fluff' ? 'rejected' : 'accepted',
    assetId: input.assetId,
    sourceStart: item.sourceStart,
    sourceEnd: item.sourceEnd,
    // B4: the snapped span, kept beside the final one an edge drag writes.
    snapped: { sourceStart: item.sourceStart, sourceEnd: item.sourceEnd },
    category: item.category as StudioCutCategory,
    ...(item.text ? { text: item.text } : {}),
    ...(item.note ? { note: item.note } : {}),
  }));

  const fluffCount = input.items.filter((i) => i.category === 'fluff').length;
  const headline =
    `Editorial cut · ${input.engine ?? 'transcript'} · ` +
    `−${input.removedSeconds.toFixed(1)} s of ${input.sourceDuration.toFixed(1)} s`;
  const lines = [headline];
  if (input.summary) lines.push(input.summary);
  if (fluffCount > 0) {
    lines.push(
      `${fluffCount} fluff suggestion${fluffCount === 1 ? '' : 's'} start unchecked — tick the ones you agree with.`,
    );
  }
  lines.push(...(input.qaNotes ?? []));

  return {
    id: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'cut-plan',
    status: 'proposed',
    createdAt: input.createdAt ?? new Date().toISOString(),
    agentNote: lines.join('\n'),
    items,
    ...(input.qa ? { qa: withQaAsset(input.qa, input.assetId) } : {}),
  };
}
