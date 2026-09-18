// Edge snapping for authored cuts: someone decides WHAT to remove as word-time
// spans (the agent's editorial pass, or the user selecting text in the
// Transcript panel); this module decides exactly WHERE the edges land. Edges
// are snapped with the same planner the mechanical pass uses — head pads, RMS
// tails, and the clamp that stops a tail riding into cut speech — but with
// pause compression disabled (internalGap = ∞): silence removal is Auto Cut's
// job. Pure logic, generic over the caller's category vocabulary.

import type { SttModelFeatures } from '../presets/stt-models';
import type { CutPlanStyleName } from '../types/studio-cut-plan';
import {
  CUT_PLAN_STYLES,
  planClip,
  styleForFeatures,
  type PlanSpan,
  type PlanWord,
  type RmsEnvelope,
} from './cut-planner';

export interface CutSpanInput<C extends string> {
  start: number;
  end: number;
  category: C;
  /** Why this span goes — shown in the review row. */
  note?: string;
}

/** A snapped cut, in source seconds. */
export interface SnappedCut<C extends string> {
  sourceStart: number;
  sourceEnd: number;
  category: C;
  note?: string;
  /** Transcript words swallowed by the snapped span. */
  text: string;
}

export interface SnapCutSpansInput<C extends string> {
  spans: CutSpanInput<C>[];
  words: PlanWord[];
  /** Measured audio duration (envelope) — authoritative over the transcript. */
  duration: number;
  envelope: RmsEnvelope;
  features?: SttModelFeatures;
  /** Edge style; 'natural' default — authored joins should breathe. */
  styleName?: CutPlanStyleName;
}

export interface SnapCutSpansResult<C extends string> {
  items: SnappedCut<C>[];
  removedSeconds: number;
  /** Honest QA readout: merges, clamps, drops. */
  notes: string[];
}

const MIN_CUT_SPAN = 0.05;
/** A wordless keep this short between two cuts is dead air — merge through it. */
const MERGE_SILENT_KEEP_MAX = 1.0;

interface MergedSpan<C extends string> extends PlanSpan {
  categories: Map<C, number>;
  notes: string[];
}

function dominantCategory<C extends string>(span: MergedSpan<C>): C {
  let best: C | undefined;
  let bestLen = -1;
  for (const [cat, len] of span.categories) {
    if (len > bestLen) {
      best = cat;
      bestLen = len;
    }
  }
  // A merged span always carries the category of the span that created it.
  return best as C;
}

function mergeInto<C extends string>(target: MergedSpan<C>, source: MergedSpan<C>): void {
  target.start = Math.min(target.start, source.start);
  target.end = Math.max(target.end, source.end);
  for (const [cat, len] of source.categories) {
    target.categories.set(cat, (target.categories.get(cat) ?? 0) + len);
  }
  target.notes.push(...source.notes);
}

function hasWordsBetween(words: PlanWord[], a: number, b: number): boolean {
  return words.some((w) => w.start >= a - 0.02 && w.end <= b + 0.02);
}

/**
 * Validate, merge, and snap authored spans against the real audio.
 * Returned items are sorted and non-overlapping; each maps 1:1 onto a gap
 * between kept segments, so the edges are exactly what an apply removes.
 */
export function snapCutSpans<C extends string>(input: SnapCutSpansInput<C>): SnapCutSpansResult<C> {
  const notes: string[] = [];
  const words = [...input.words].sort((a, b) => a.start - b.start);

  // 1. Clamp to the measured audio and drop degenerate spans.
  const clamped: MergedSpan<C>[] = [];
  let dropped = 0;
  for (const span of input.spans) {
    const start = Math.max(0, Math.min(span.start, input.duration));
    const end = Math.max(0, Math.min(span.end, input.duration));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < MIN_CUT_SPAN) {
      dropped++;
      continue;
    }
    clamped.push({
      start,
      end,
      categories: new Map([[span.category, end - start]]),
      notes: span.note ? [span.note] : [],
    });
  }
  if (dropped > 0) notes.push(`${dropped} span${dropped === 1 ? '' : 's'} dropped (empty or outside the audio)`);

  // 2. Merge overlaps, and merge through wordless slivers between cuts — an
  //    isolated silent chunk bracketed by two cuts is never worth keeping.
  clamped.sort((a, b) => a.start - b.start);
  const merged: MergedSpan<C>[] = [];
  let mergedCount = 0;
  for (const span of clamped) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const gap = span.start - prev.end;
      // A keep narrower than MIN_CUT_SPAN can't survive step 3 — merging here
      // keeps cuts and keeps strictly alternating.
      const silentSliver = gap <= MERGE_SILENT_KEEP_MAX && !hasWordsBetween(words, prev.end, span.start);
      if (gap < MIN_CUT_SPAN || silentSliver) {
        mergeInto(prev, span);
        mergedCount++;
        continue;
      }
    }
    merged.push(span);
  }
  if (mergedCount > 0) notes.push(`${mergedCount} overlapping/adjacent span${mergedCount === 1 ? '' : 's'} merged`);

  if (merged.length === 0) {
    return { items: [], removedSeconds: 0, notes };
  }

  // 3. Keeps = complement of the cuts. Keeps and cuts strictly alternate;
  //    keepIndexBefore[j] is the segment the planner emits just before cut j
  //    (or null when the cut starts at 0), so gaps map back 1:1.
  const keeps: PlanSpan[] = [];
  const keepIndexBefore: Array<number | null> = [];
  let cursor = 0;
  for (const span of merged) {
    if (span.start - cursor >= MIN_CUT_SPAN) {
      keeps.push({ start: cursor, end: span.start });
      keepIndexBefore.push(keeps.length - 1);
    } else {
      keepIndexBefore.push(keeps.length > 0 ? keeps.length - 1 : null);
    }
    cursor = Math.max(cursor, span.end);
  }
  const hasTrailingKeep = input.duration - cursor >= MIN_CUT_SPAN;
  if (hasTrailingKeep) keeps.push({ start: cursor, end: input.duration });

  // 4. Snap edges: same planner as Auto Cut, pause compression disabled.
  const base = styleForFeatures(CUT_PLAN_STYLES[input.styleName ?? 'natural'], input.features);
  const style = { ...base, internalGap: Number.POSITIVE_INFINITY };
  const cutSpans: PlanSpan[] = merged.map((m) => ({ start: m.start, end: m.end }));
  const segments = planClip(keeps, words, style, input.envelope, cutSpans);

  // 5. Each cut's snapped span runs from the end of the segment before it to
  //    the start of the segment after it (audio bounds when none exists).
  const items: SnappedCut<C>[] = [];
  let vanished = 0;
  for (let j = 0; j < merged.length; j++) {
    const before = keepIndexBefore[j];
    const after = before === null ? 0 : before + 1;
    const hasAfter = after < segments.length;
    const sourceStart = before === null ? 0 : segments[before].end;
    const sourceEnd = hasAfter ? segments[after].start : input.duration;
    if (sourceEnd - sourceStart < MIN_CUT_SPAN) {
      vanished++;
      continue;
    }
    const swallowed = words
      .filter((w) => w.start >= sourceStart - 0.02 && w.end <= sourceEnd + 0.02)
      .map((w) => w.text)
      .join(' ');
    items.push({
      sourceStart: round3(sourceStart),
      sourceEnd: round3(sourceEnd),
      category: dominantCategory(merged[j]),
      ...(merged[j].notes.length > 0 ? { note: merged[j].notes.join(' · ') } : {}),
      text: swallowed,
    });
  }
  if (vanished > 0) {
    notes.push(`${vanished} span${vanished === 1 ? '' : 's'} vanished after snapping (edges met inside the pads)`);
  }

  const removedSeconds = items.reduce((sum, i) => sum + (i.sourceEnd - i.sourceStart), 0);
  return { items, removedSeconds: round3(removedSeconds), notes };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
