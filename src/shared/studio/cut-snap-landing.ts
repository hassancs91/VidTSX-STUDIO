// Where an authored cut's far edge lands (B7, docs/studio/end-to-end/B7/HANDOFF.md).
// The editorial pass and Transcript deletes author spans at word bounds; the
// planner's clamp (cut-planner.ts planClip: `segStart = cut.end` when the cut
// ends inside the next atom's lead-in) then treats the authored end as the end
// of the removed sound. Two hard entries came from that: a cut-in on a removed
// word's leftover release, and a cut end inside the kept word's real onset.
// This moves the end before planClip runs. Pure logic.

import type { CutPlanStyle } from '../types/studio-cut-plan';
import { QA_ENTRY_LOOKBACK_S } from './cut-qa';
import type { PlanSpan, PlanWord, RmsEnvelope } from './cut-planner';

export interface LandCutEndInput {
  /** The merged authored span (source seconds). */
  span: PlanSpan;
  /** Start of the next cut, or the audio duration when none follows. */
  nextCutStart: number;
  /** True when no keep precedes this cut (planClip opens the first atom roomier). */
  firstAtom: boolean;
  /** Transcript words, sorted by start. */
  words: PlanWord[];
  /** The snap's style after capability compensation (styleForFeatures). */
  style: CutPlanStyle;
  envelope: RmsEnvelope;
  /** The narrowest keep the snapper allows between two cuts. */
  minGap: number;
}

/**
 * `a` = the end of the last word the cut removes; `s` = the start of the next
 * kept word. The edge never sits inside the removed word's release (its soft
 * tail plus the QA's entry lookback, so the cut-in's QA window reads the
 * decayed audio) and never inside the kept word's lead-in (the head pad
 * planClip gives it). When the two collide (the sound never decays between
 * the words) the release wins, just before the kept word. An end already past
 * the release and before the lead-in is left alone. Unchanged when the cut
 * removes no word, ends mid-word, or leaves no room to land.
 */
export function landCutEnd(input: LandCutEndInput): number {
  const { span, nextCutStart, firstAtom, words, style, envelope, minGap } = input;
  const end = span.end;
  const removed = words.filter((w) => w.start >= span.start - 0.02 && w.end <= end + 0.02);
  if (removed.length === 0) return end;
  if (words.some((w) => w.start < end - 0.02 && w.end > end + 0.02)) return end; // ends mid-word
  const a = Math.max(...removed.map((w) => w.end));
  const next = words.find((w) => w.start >= end - 0.02 && w.end > end + 0.02);
  const kept = next !== undefined && next.start < nextCutStart - 0.02 ? next : undefined;
  const cap = kept ? Math.min(kept.start - 0.01, nextCutStart - minGap) : nextCutStart - minGap;
  if (cap <= a) return end;

  const fricMargin = style.fricMargin ?? 5.0;
  // The MEASURED release: walk from the word's end (floor 0), not from the
  // style's minTail — minTail is the tail a KEPT word is given, and flooring
  // here took a short clean gap for sound that never decays (B2's natural
  // style then lost its lead-in).
  const release = envelope.snapTail(a, 0, style.softMaxTail, style.softMargin, style.fricZcr, fricMargin);
  const lo = Math.min(a + release + QA_ENTRY_LOOKBACK_S, cap);
  let hi = Number.POSITIVE_INFINITY;
  if (kept) {
    // The same lead-in planClip gives the atom that starts at `kept`.
    let head = firstAtom ? Math.min(0.25, style.head * 2) : style.head;
    if (style.maxHead) {
      head = Math.max(
        head,
        envelope.snapHead(kept.start, style.head, style.maxHead, style.margin, style.fricZcr, fricMargin),
      );
    }
    hi = kept.start - head;
  }
  return Math.round(Math.max(lo, Math.min(end, hi)) * 1000) / 1000;
}
