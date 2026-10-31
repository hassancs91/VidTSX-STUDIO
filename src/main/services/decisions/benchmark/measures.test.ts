// The tree's port of D1's measures (D:\repos\VidTSX-STUDIO\.vidtsx-temp\decisions\D1\measures.cjs — its DEFINITIONS header): the edge
// cases the replay's 40 / 40 sets never reach, pinned so the port stays exact (bins, ties, off-list keys, missing answers, quantiles).

import { describe, expect, it } from 'vitest';
import { binOf, binaryMeasures, choiceMeasures, normalise, quantile, reliability, topOf } from './measures';

describe('D1 measures — the definitions', () => {
  it('10 equal-width bins; p = 1.0 is the top bin; 0.7 lands in [0.7, 0.8) despite float error', () => {
    expect([0, 0.05, 0.1, 0.7, 0.9, 0.999, 1].map(binOf)).toEqual([0, 0, 1, 7, 9, 9, 9]);
  });

  it('ECE = Σ (n_b / N) · |mean p_b − freq_b|', () => {
    const { ece, table } = reliability([
      { p: 0.95, y: 1 },
      { p: 0.95, y: 0 },
      { p: 0.15, y: 0 },
      { p: 0.15, y: 0 },
    ]);
    expect(ece).toBeCloseTo(0.5 * Math.abs(0.95 - 0.5) + 0.5 * 0.15, 12);
    expect(table[9]).toMatchObject({ range: '0.9–1.0', n: 2, freq: 0.5 });
    expect(table[1]).toMatchObject({ range: '0.1–0.2', n: 2, freq: 0 });
  });

  it('noul: accuracy over all questions (a missing answer is wrong), Brier / ECE over the answered only', () => {
    const m = binaryMeasures([
      { qid: 'a', y: true, p: 0.9 },
      { qid: 'b', y: false, p: 0.6 },
      { qid: 'c', y: true, p: undefined },
    ]);
    expect(m).toMatchObject({ n: 3, answered: 2, missing: 1, right: 1 });
    expect(m.accuracy).toBeCloseTo(1 / 3, 12);
    expect(m.brier).toBeCloseTo((0.01 + 0.36) / 2, 12);
    expect(m.selective.map((s) => [s.tau, s.acted])).toEqual([[0.5, 2], [0.7, 1], [0.9, 1]]);
  });

  it('choice: top = highest p, ties → the first in the row’s option order, off-list keys after; an off-list top is counted', () => {
    expect(topOf({ b: 0.5, a: 0.5 }, ['a', 'b'])).toEqual({ id: 'a', p: 0.5, offList: false });
    expect(topOf({ zz: 0.5, b: 0.5 }, ['a', 'b'])).toEqual({ id: 'b', p: 0.5, offList: false });
    const m = choiceMeasures([
      { id: 'r1', optionIds: ['a', 'b'], allowed: ['a'], probs: { a: 0.8, b: 0.2 } },
      { id: 'r2', optionIds: ['a', 'b'], allowed: ['b'], probs: { zz: 0.9, b: 0.1 } },
      { id: 'r3', optionIds: ['a', 'b'], allowed: ['a'], probs: undefined },
    ]);
    expect(m).toMatchObject({ n: 3, answered: 2, missing: 1, offList: 1, right: 1 });
    // top-label Brier: (0.8 − 1)² and (0.9 − 0)²; multiclass: (0.8 − 1)² + 0.2² and (0.1 − 1)² + 0.9²
    expect(m.brier).toBeCloseTo((0.04 + 0.81) / 2, 12);
    expect(m.brierMulticlass).toBeCloseTo((0.04 + 0.04 + 0.81 + 0.81) / 2, 12);
  });

  it('normalise renormalises over the finite, non-negative keys and reports the raw sum', () => {
    expect(normalise({ a: 2, b: 2, c: -1, d: Number.NaN })).toEqual({ probs: { a: 0.5, b: 0.5 }, sum: 4 });
    expect(normalise({})).toEqual({ probs: {}, sum: 0 });
  });

  it('nearest-rank quantiles: sorted[ceil(p·n) − 1]', () => {
    expect(quantile([300, 100, 200], 0.5)).toBe(200);
    expect(quantile([300, 100, 200], 0.95)).toBe(300);
    expect(quantile([499], 0.95)).toBe(499);
    expect(quantile([], 0.95)).toBeNull();
  });
});
