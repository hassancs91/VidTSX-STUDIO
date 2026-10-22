// planClip with cutlib's opt-in style keys (max_head, min_skip, fric_zcr,
// fric_margin) — the cases tools/cutlib.py's plan_clip docstring records.

import { describe, it, expect } from 'vitest';
import { TIGHT_STYLE, planClip, styleForFeatures } from './cut-planner';
import { mergeShortSkips } from './cut-skip-merge';
import type { PlanWord } from './cut-planner';
import { RmsEnvelope } from './rms-envelope';
import type { CutPlanSegment, CutPlanStyle } from '../types/studio-cut-plan';

const BPS = 50;
const FLOOR = -60;

/** Hasan's fitted tight for video-14 (cuts.json `styles.tight`). */
const FITTED_TIGHT: CutPlanStyle = {
  internalGap: 0.4,
  minTail: 0.08,
  maxTail: 0.7,
  head: 0.15,
  maxHead: 0.3,
  minSkip: 0.12,
  margin: 12,
  softGap: 99,
  softMaxTail: 0.6,
  softMargin: 6,
  fricZcr: 3500,
  fricMargin: 5,
};

function envelope(durationSec: number, loud: Array<[number, number]>, db = -22): RmsEnvelope {
  const n = Math.round(durationSec * BPS);
  const levels = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / BPS;
    return loud.some(([s, e]) => t >= s && t < e) ? db : FLOOR;
  });
  return new RmsEnvelope(levels, BPS, new Array<number>(n).fill(1200));
}

const w = (text: string, start: number, end: number): PlanWord => ({ text, start, end });

function seg(start: number, end: number, soft = false): CutPlanSegment {
  return { start, end, speechStart: start + 0.1, speechEnd: end - 0.1, soft };
}

describe('planClip — max_head', () => {
  // "Every" token at 2.00, audio from 1.84; a second atom after a long pause.
  const words = [w('Every', 2.0, 2.3), w('day', 2.32, 2.5), w('Then', 4.0, 4.3)];
  const env = envelope(6, [
    [1.84, 2.5],
    [4.0, 4.3],
  ]);
  const keeps = [{ start: 1.5, end: 4.5 }];

  it('without max_head the lead-in is the fixed head', () => {
    const { maxHead: _drop, ...noHead } = FITTED_TIGHT;
    const segs = planClip(keeps, words, { ...noHead, minSkip: undefined }, env);
    expect(segs[1].start).toBeCloseTo(4.0 - 0.15, 3);
  });

  it('with max_head it reaches the real onset (+30 ms), never under head', () => {
    const segs = planClip(keeps, words, FITTED_TIGHT, env);
    // First atom: open head = max(min(0.25, 2 × head), snapHead 0.19) = 0.25.
    expect(segs[0].start).toBeCloseTo(2.0 - 0.25, 3);
    // Second atom: a clean onset at its token → head.
    expect(segs[1].start).toBeCloseTo(4.0 - 0.15, 3);
  });

  it('a snapped lead-in later in the clip reaches back past head', () => {
    const later = [w('So', 1.0, 1.3), w('Every', 3.0, 3.3)];
    const env2 = envelope(5, [
      [1.0, 1.3],
      [2.84, 3.3],
    ]);
    const segs = planClip([{ start: 0.5, end: 4 }], later, FITTED_TIGHT, env2);
    expect(segs[1].start).toBeCloseTo(3.0 - 0.19, 3);
  });
});

describe('planClip — min_skip ("whyyy": a 50 ms token over a 0.4 s vowel)', () => {
  // The ASR stamps "why" 1.00–1.05 but the vowel runs to 1.40; "do" at 1.50.
  // The 0.45 s fake pause splits atoms; the tail walks the vowel but the gap
  // clamp stops it at 1.05 + (0.45 − head − 0.06) = 1.29, and "do" opens at
  // 1.50 − head = 1.35: a 60 ms hole.
  const words = [w('So', 0.6, 0.9), w('why', 1.0, 1.05), w('do', 1.5, 1.6)];
  const env = envelope(3, [
    [0.6, 0.9],
    [1.0, 1.4],
    [1.5, 1.6],
  ]);
  const keeps = [{ start: 0.5, end: 2 }];

  it('without min_skip the hole stays (two segments, 60 ms apart)', () => {
    const style: CutPlanStyle = { ...FITTED_TIGHT, minSkip: undefined, maxHead: undefined };
    const segs = planClip(keeps, words, style, env);
    expect(segs).toHaveLength(2);
    expect(segs[1].start - segs[0].end).toBeCloseTo(0.06, 3);
  });

  it('with min_skip 0.12 the two segments merge', () => {
    const segs = planClip(keeps, words, FITTED_TIGHT, env);
    expect(segs).toHaveLength(1);
    expect(segs[0].speechStart).toBeCloseTo(0.6, 3);
    expect(segs[0].speechEnd).toBeCloseTo(1.6, 3);
  });

  it('an explicit cut between them blocks the merge', () => {
    const segs = planClip(keeps, words, FITTED_TIGHT, env, [{ start: 1.3, end: 1.34 }]);
    expect(segs).toHaveLength(2);
  });
});

describe('mergeShortSkips', () => {
  it('merges overlaps even at min_skip 0 (max_head set alone)', () => {
    const merged = mergeShortSkips([seg(1, 2), seg(1.9, 3, true)], 0);
    expect(merged).toEqual([{ start: 1, end: 3, speechStart: 1.1, speechEnd: 2.9, soft: true }]);
  });

  it('keeps a skip at or over min_skip', () => {
    expect(mergeShortSkips([seg(1, 2), seg(2.12, 3)], 0.12)).toHaveLength(2);
    expect(mergeShortSkips([seg(1, 2), seg(2.11, 3)], 0.12)).toHaveLength(1);
  });

  it('a later segment inside the previous keeps the previous end and landing', () => {
    const merged = mergeShortSkips([seg(1, 3, true), seg(1.5, 2)], 0.12);
    expect(merged).toEqual([{ start: 1, end: 3, speechStart: 1.1, speechEnd: 2.9, soft: true }]);
  });
});

describe('the old styles are untouched by the new knobs', () => {
  it('TIGHT_STYLE sets none of them (B2 moves the defaults)', () => {
    expect(TIGHT_STYLE.maxHead).toBeUndefined();
    expect(TIGHT_STYLE.minSkip).toBeUndefined();
    expect(TIGHT_STYLE.fricZcr).toBeUndefined();
  });

  it('approximate word timing widens max_head with head', () => {
    const widened = styleForFeatures(FITTED_TIGHT, undefined);
    expect(widened.head).toBeCloseTo(0.23, 6);
    expect(widened.maxHead).toBeCloseTo(0.38, 6);
    expect(styleForFeatures(TIGHT_STYLE, undefined).maxHead).toBeUndefined();
  });
});
