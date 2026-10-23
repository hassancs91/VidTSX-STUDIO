// Where an authored cut's far edge lands (B7, docs/studio/end-to-end/B7/HANDOFF.md).
// The editorial pass and Transcript deletes author spans at word bounds; the
// planner's clamp (cut-planner.ts planClip: `segStart = cut.end` when the cut
// ends inside the next atom's lead-in) then treats the authored end as the end
// of the removed sound. Two hard entries came from that: a cut-in on a removed
// word's leftover release, and a cut end inside the kept word's real onset.
// This moves the end before planClip runs. Pure logic.

import type { CutPlanStyle } from '../types/studio-cut-plan';
import { QA_ENTRY_LOOKBACK_S, QA_ENTRY_WINDOW_S, QA_HARD_ENTRY_DB } from './cut-qa';
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
  /**
   * B7 step 7 (the editorial pass): an end authored in continuous speech —
   * inside a word, or in a gap too short for a quiet cut-in — first moves to
   * the nearest quiet inter-word gap (endOutOfSpeech). Off for Transcript
   * deletes: there the user picked the words.
   */
  seekQuietGap?: boolean;
}

/** How far from the authored end the quiet-gap search looks, either way. */
export const QUIET_GAP_SEEK_S = 1.5;

/**
 * `a` = the end of the last word the cut removes; `s` = the start of the next
 * kept word. The edge never sits inside the removed word's release (its soft
 * tail plus the QA's entry lookback, so the cut-in's QA window reads the
 * decayed audio) and never inside the kept word's lead-in (the head pad
 * planClip gives it). When the two collide (the sound never decays between
 * the words) the release wins, just before the kept word's walked onset (B7
 * step 7: its audio can start before its token). An end already past the
 * release and before the lead-in is left alone. Unchanged when the cut removes
 * no word, ends mid-word, or leaves no room to land.
 */
export function landCutEnd(input: LandCutEndInput): number {
  return landAt(input, input.seekQuietGap ? endOutOfSpeech(input) : input.span.end);
}

function landAt(input: LandCutEndInput, end: number): number {
  const { span, nextCutStart, firstAtom, words, style, envelope, minGap } = input;
  const removed = words.filter((w) => w.start >= span.start - 0.02 && w.end <= end + 0.02);
  if (removed.length === 0) return end;
  if (words.some((w) => w.start < end - 0.02 && w.end > end + 0.02)) return end; // ends mid-word
  const a = Math.max(...removed.map((w) => w.end));
  const next = words.find((w) => w.start >= end - 0.02 && w.end > end + 0.02);
  const kept = next !== undefined && next.start < nextCutStart - 0.02 ? next : undefined;
  let cap = kept ? Math.min(kept.start - 0.01, nextCutStart - minGap) : nextCutStart - minGap;
  const fricMargin = style.fricMargin ?? 5.0;
  if (kept && style.maxHead) {
    // The kept word's audio onset by the same walk snapHead does (head 0 →
    // the walk itself; a walk that reached maxHead starts at maxHead).
    const walk = envelope.snapHead(kept.start, 0, style.maxHead, style.margin, style.fricZcr, fricMargin);
    const onset = walk >= style.maxHead - 1e-6 ? kept.start - style.maxHead : kept.start - walk + 0.03;
    if (onset - 0.01 > a) cap = Math.min(cap, onset - 0.01);
  }
  if (cap <= a) return end;

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

/**
 * B7 step 7: the end to land from. Unchanged unless the authored end lies
 * inside a word or in a gap shorter than the lead-in + the QA's lookback; then
 * the far word of the nearest inter-word gap (within QUIET_GAP_SEEK_S) that is
 * long enough and whose landed cut-in reads at most QA_HARD_ENTRY_DB over the
 * floor. A straddled word goes with the side that holds most of it (decision
 * 10: mostly inside the span → the gaps after it; mostly kept → before it).
 * The cut keeps removing at least one whole word and stays clear of the next.
 */
function endOutOfSpeech(input: LandCutEndInput): number {
  const { span, nextCutStart, words, style, envelope, minGap } = input;
  const e = span.end;
  const minLen = style.head + QA_ENTRY_LOOKBACK_S;
  const inWord = words.find((w) => w.start < e - 0.02 && w.end > e + 0.02);
  if (!inWord) {
    const prev = [...words].reverse().find((w) => w.end <= e + 0.02);
    const next = words.find((w) => w.start >= e - 0.02);
    if (!prev || !next || prev.start < span.start - 0.02 || next.start - prev.end >= minLen) return e;
  }
  const side = inWord ? (e - inWord.start > inWord.end - e ? 'after' : 'before') : undefined;
  const bar = envelope.floorDb() + QA_HARD_ENTRY_DB;
  let best: { end: number; dist: number } | undefined;
  for (let i = 0; i + 1 < words.length; i++) {
    const g0 = words[i].end;
    const g1 = words[i + 1].start;
    if (g1 - g0 < minLen || words[i].start < span.start - 0.02 || g0 >= nextCutStart - minGap) continue;
    const dir = g1 <= e + 0.02 ? 'before' : g0 >= e - 0.02 ? 'after' : undefined;
    if (!dir || (side && dir !== side)) continue;
    const dist = dir === 'before' ? e - g1 : g0 - e;
    if (dist > QUIET_GAP_SEEK_S || (best && dist >= best.dist)) continue;
    const landed = landAt(input, g1);
    if (envelope.rmsDb(Math.max(landed - QA_ENTRY_LOOKBACK_S, 0), QA_ENTRY_WINDOW_S) > bar) continue;
    best = { end: g1, dist };
  }
  return best ? best.end : e;
}
