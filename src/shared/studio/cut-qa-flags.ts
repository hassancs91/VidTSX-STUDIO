// B7 item 5 (orchestrator decision 1): a hard entry the card's own QA can
// hear must not reach the timeline silently. Both card builders — the
// editorial pass (`buildEditorialProposal`) and Auto Cut (`buildCutProposal`,
// the button and `run_auto_cut` alike) — build a cut whose join carries a QA
// hard entry UNCHECKED, its reason in `qaFlag` on the row. Apply (the user's
// click and the agent's `accept_proposal`) takes accepted items only, so a
// flagged cut reaches the timeline only when the user ticks it. Pure logic.

import type { StudioProposalItem } from '../types/studio';
import type { CutQaItem, CutQaReport } from '../types/studio-cut-plan';

/**
 * A hard entry belongs to the cut it sits right after: its `sourceTime` is
 * the kept segment's start, which is the cut's `sourceEnd` (both rounded to
 * the millisecond by the snapper / QA).
 */
export const QA_FLAG_JOIN_TOLERANCE_S = 0.02;

type JoinItem = Pick<StudioProposalItem, 'assetId' | 'sourceEnd'>;

/** Per item (same order): the QA hard entries where kept speech resumes after it. */
export function hardEntriesAtItemJoins(items: readonly JoinItem[], report: CutQaReport | undefined): CutQaItem[][] {
  const hard = (report?.items ?? []).filter((q) => q.kind === 'hard-entry');
  return items.map((item) => {
    const end = item.sourceEnd;
    if (end === undefined) return [];
    return hard.filter(
      (q) =>
        Math.abs(q.sourceTime - end) <= QA_FLAG_JOIN_TOLERANCE_S + 1e-9 &&
        (q.assetId === undefined || item.assetId === undefined || q.assetId === item.assetId),
    );
  });
}

/**
 * The items with every QA-flagged cut built unchecked (`rejected`) and its
 * loudest hard entry in `qaFlag`. Clean items come back as the same objects.
 */
export function uncheckQaFlaggedItems(items: StudioProposalItem[], report: CutQaReport | undefined): StudioProposalItem[] {
  const flags = hardEntriesAtItemJoins(items, report);
  return items.map((item, i) => {
    if (flags[i].length === 0) return item;
    const loudest = flags[i].reduce((a, b) => (b.overDb > a.overDb ? b : a));
    return {
      ...item,
      status: 'rejected',
      qaFlag: { kind: 'hard-entry', sourceTime: loudest.sourceTime, overDb: loudest.overDb },
    };
  });
}

/** The row's reason: "Unchecked by QA: hard entry +15.9 dB where speech resumes — …". */
export function formatQaFlag(flag: NonNullable<StudioProposalItem['qaFlag']>): string {
  return `Unchecked by QA: hard entry +${flag.overDb.toFixed(1)} dB where speech resumes — play it; tick to cut anyway`;
}

/** The card note's line ("1 cut starts unchecked — …"); '' when nothing is flagged. */
export function formatQaUncheckedNote(items: readonly StudioProposalItem[]): string {
  const n = items.filter((i) => i.qaFlag).length;
  if (n === 0) return '';
  return `${countPhrase(n)} unchecked — the QA hears a hard entry where speech resumes; play ${n === 1 ? 'it' : 'each'}, tick to cut anyway.`;
}

/**
 * The tool-result line naming every flagged cut (source span, category, level);
 * '' when nothing is flagged.
 */
export function formatQaUncheckedLine(items: readonly StudioProposalItem[]): string {
  const flagged = items.filter((i) => i.qaFlag);
  if (flagged.length === 0) return '';
  const list = flagged
    .map((i) => {
      const span = `${(i.sourceStart ?? 0).toFixed(2)}–${(i.sourceEnd ?? 0).toFixed(2)} s`;
      return `${span}${i.category ? ` ${i.category}` : ''} (+${(i.qaFlag?.overDb ?? 0).toFixed(1)} dB)`;
    })
    .join(', ');
  const them = flagged.length === 1 ? 'it' : 'them';
  return `${countPhrase(flagged.length)} unchecked because the QA hears a hard entry where speech resumes after ${them}: ${list}`;
}

/**
 * The agent tools' sentence (`propose_cuts`, `run_auto_cut`): the line above
 * plus what Apply does with those cuts and that the reply must name them.
 * '' when nothing is flagged.
 */
export function formatQaUncheckedForAgent(items: readonly StudioProposalItem[]): string {
  const line = formatQaUncheckedLine(items);
  if (!line) return '';
  const them = items.filter((i) => i.qaFlag).length === 1 ? 'it' : 'them';
  return `${line}. Apply leaves ${them} in the video unless the user ticks ${them} — name ${them} in your reply. `;
}

function countPhrase(n: number): string {
  return n === 1 ? '1 cut starts' : `${n} cuts start`;
}

/**
 * The card's QA readout suffix (B7): the readout counts the plan's hard
 * entries, so say how many of those cuts start unchecked — Apply leaves them
 * out (" — 1 unchecked by QA"); '' when none is still unchecked.
 */
export function formatQaUncheckedSuffix(items: ReadonlyArray<Pick<StudioProposalItem, 'status' | 'qaFlag'>>): string {
  const n = items.filter((i) => i.qaFlag && i.status === 'rejected').length;
  return n > 0 ? ` — ${n} unchecked by QA` : '';
}
