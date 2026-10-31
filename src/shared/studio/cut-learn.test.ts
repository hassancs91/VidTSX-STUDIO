// B4 — learn the cut knobs from the user's joins: measurement, the Q4 gates,
// the fit, the per-join list. Hand-made envelopes: one word per "sentence",
// a release that decays at a known rate, 1.5 s pauses between sentences.

import { describe, it, expect } from 'vitest';
import { learnCutKnobs } from './cut-learn';
import { measureCutJoins, styleLeadIn } from './cut-learn-measure';
import { tailFor } from './cut-planner';
import type { CutLearnJoinInput } from '../types/studio-cut-learn';
import { FITTED_TIGHT, NATURAL, OLD_TIGHT, RATES, assetsOf, joinsAt, recording } from './cut-learn-test-fixtures';

describe('measureCutJoins', () => {
  it('measures lead-in, tail and the tail level over the floor at a touched join', () => {
    const rec = recording([100]);
    const { rows, tails, heads } = measureCutJoins(
      [{ assetId: 'A', tailEdge: 2.3, headEdge: 3.4, tailTouched: true, headTouched: true, source: 'trim', ref: 'x' }],
      assetsOf(rec),
      FITTED_TIGHT,
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toMatchObject({ lastWord: 'w0', nextWord: 'w1', tail: 0.3, leadIn: 0.1, ref: 'x' });
    // The 50 ms window from 2.3 s reads the release at −50 … −55 dB (power
    // mean ≈ −52.4) → 7.6 dB over the −60 floor.
    expect(row.tailDb).toBe(7.6);
    // The style's own edges at this join (the same rules the planner runs).
    expect(row.styleTail).toBe(tailFor(rec.asset.envelope, 2, 1.5, FITTED_TIGHT).tail);
    expect(row.styleLeadIn).toBe(0.15);
    expect(row.styleSoft).toBe(false);
    expect(tails).toHaveLength(1);
    expect(heads).toHaveLength(1);
  });

  it('measures only the touched edges; untouched joins and unknown clips teach nothing', () => {
    const rec = recording([100, 100]);
    const { rows, tails, heads } = measureCutJoins(
      [
        { assetId: 'A', tailEdge: 2.3, headEdge: 3.4, tailTouched: true, headTouched: false, source: 'trim' },
        { assetId: 'A', tailEdge: 4.8, headEdge: 5.9, tailTouched: false, headTouched: false, source: 'trim' },
        { assetId: 'B', tailEdge: 1, tailTouched: true, headTouched: false, source: 'trim' },
      ],
      assetsOf(rec),
      FITTED_TIGHT,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].tail).toBe(0.3);
    expect(rows[0].leadIn).toBeUndefined();
    expect(rows[1].skipped).toMatch(/no words or waveform/);
    expect(tails).toHaveLength(1);
    expect(heads).toHaveLength(0);
  });

  it('skips an edge far from any word (not a landing)', () => {
    const rec = recording([100]);
    const { rows, tails } = measureCutJoins(
      // w1 ends at 4.5 s; an end edge 1.7 s later sits in the room tone.
      [{ assetId: 'A', tailEdge: 6.2, tailTouched: true, headTouched: false, source: 'trim' }],
      assetsOf(rec),
      FITTED_TIGHT,
    );
    expect(rows[0].skipped).toMatch(/not a landing/);
    expect(tails).toHaveLength(0);
  });
});

describe('learnCutKnobs', () => {
  it('recovers the fitted tight from joins trimmed to its geometry (start: the old tight)', () => {
    const rec = recording(RATES);
    const report = learnCutKnobs(joinsAt(rec, FITTED_TIGHT, RATES.length), assetsOf(rec), OLD_TIGHT);
    expect(report.joins).toBe(13);
    expect(report.headEdges).toBe(13);
    expect(report.tailEdges).toBe(13);
    expect(report.fitted.head).toBe(0.15);
    expect(report.fitted.minTail).toBe(0.08);
    expect(Math.abs((report.fitted.margin as number) - 12)).toBeLessThanOrEqual(1);
    const byKnob = new Map(report.changes.map((c) => [c.knob, c]));
    expect(byKnob.get('head')).toMatchObject({ from: 0.11, to: 0.15, samples: 13 });
    expect(byKnob.get('minTail')).toMatchObject({ from: 0.14, to: 0.08 });
    expect(Math.abs((byKnob.get('margin')?.to as number) - 12)).toBeLessThanOrEqual(1);
    // maxTail is only known up to the longest tail kept (~0.47 s): the cap
    // nearest the current 0.4 that reproduces every tail.
    expect(byKnob.get('maxTail')?.to).toBe(0.5);
    expect(report.medians.leadIn).toBe(0.15);
    expect(report.medians.styleLeadIn).toBe(0.11);
    expect(report.joinsList).toHaveLength(13);
  });

  it('proposes nothing when the joins sit where the current style puts them', () => {
    const rec = recording(RATES);
    const report = learnCutKnobs(joinsAt(rec, OLD_TIGHT, RATES.length), assetsOf(rec), OLD_TIGHT);
    expect(report.joins).toBe(13);
    expect(report.changes).toEqual([]);
    expect(report.fitted).toEqual({ head: 0.11, minTail: 0.14, maxTail: 0.4, margin: 5 });
    expect(report.notes.join(' ')).toMatch(/lead-ins fit head 0\.11 s, within 30 ms of the current 0\.11 s/);
    expect(report.notes.join(' ')).toMatch(/tails fit within 30 ms and 1 dB of the current tail knobs/);
  });

  // Verifier round 1: with jitter the MEDIAN offset from the style's lead-ins
  // falls under 30 ms (joins where the onset rule gives both styles the same
  // lead-in add zeros) while the fit still reads the user's head — the gate is
  // on |fitted − current| now. 24 joins, ±40 ms uniform on both edges, 40 seeds.
  // The fit lands in 0.15 ± 0.03 in every seed; it is PROPOSED whenever it sits
  // more than 30 ms from the current 0.11, i.e. at 0.15 or above on the 10 ms
  // grid (Q4's "> 30 ms") — 32 of the 40 seeds (the rest fit 0.13 / 0.14).
  // Under the old median-offset gate the same seeds proposed far fewer.
  it('±40 ms jitter on fitted-tight edges: the head fit stays in 0.15 ± 0.03 and is proposed whenever it moved > 30 ms', () => {
    const rec = recording([...RATES, ...RATES.slice(0, 11)]);
    const exact = joinsAt(rec, FITTED_TIGHT, 24);
    let proposed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const report = learnCutKnobs(jitter(exact, seed, 0.04), assetsOf(rec), OLD_TIGHT);
      expect(report.headEdges, `seed ${seed}`).toBe(24);
      const fit = report.fitted.head as number;
      expect(Math.abs(fit - 0.15), `seed ${seed}: fitted head ${fit}`).toBeLessThanOrEqual(0.03 + 1e-9);
      const head = report.changes.find((c) => c.knob === 'head');
      expect(head !== undefined, `seed ${seed}: fitted head ${fit}`).toBe(Math.abs(fit - 0.11) > 0.03 + 1e-9);
      if (head) proposed++;
    }
    expect(proposed).toBe(32);
  }, 60_000); // 40 full fits: ~0.4 s alone, > 5 s under the full suite's load

  it('±20 ms jitter on the current style\'s own edges: never proposes a head', () => {
    const rec = recording([...RATES, ...RATES.slice(0, 11)]);
    const exact = joinsAt(rec, OLD_TIGHT, 24);
    for (let seed = 1; seed <= 8; seed++) {
      const report = learnCutKnobs(jitter(exact, seed, 0.02), assetsOf(rec), OLD_TIGHT);
      expect(report.changes.find((c) => c.knob === 'head'), `seed ${seed}`).toBeUndefined();
    }
  });

  it('never lowers maxTail: tails all shorter than the current cap leave it alone (ruling 8)', () => {
    const rec = recording(RATES);
    // The user clips every slow release at 0.15 s — a lower cap would fit best,
    // but the cap is a lower bound: other knobs move, maxTail does not.
    const user = joinsAt(rec, { ...FITTED_TIGHT, maxTail: 0.15 }, RATES.length);
    const report = learnCutKnobs(user, assetsOf(rec), FITTED_TIGHT);
    expect(report.tailEdges).toBe(13);
    expect(report.joinsList.every((j) => (j.tail as number) <= 0.15 + 1e-6)).toBe(true);
    expect(report.changes.length).toBeGreaterThan(0);
    expect(report.changes.find((c) => c.knob === 'maxTail')).toBeUndefined();
    expect(report.fitted.maxTail).toBe(0.7);
  });

  it('proposes nothing under 10 touched joins and says how many it saw', () => {
    const rec = recording(RATES);
    const report = learnCutKnobs(joinsAt(rec, FITTED_TIGHT, 9), assetsOf(rec), OLD_TIGHT);
    expect(report.joins).toBe(9);
    expect(report.changes).toEqual([]);
    expect(report.fitted).toEqual({});
    expect(report.notes[0]).toBe(
      'Learned from 9 joins — at least 10 touched joins are needed before the cut knobs change.',
    );
  });

  it('moves a time knob only when the user differs by MORE than 30 ms (lead-in = the median without maxHead)', () => {
    const rec = recording(RATES);
    const leadIns = (delta: number): CutLearnJoinInput[] =>
      rec.words.slice(1, 13).map((w, k) => ({
        assetId: 'A',
        headEdge: w.start - (NATURAL.head + delta),
        tailTouched: false,
        headTouched: true,
        source: 'proposal' as const,
        ref: `h${k}`,
      }));
    const at30 = learnCutKnobs(leadIns(0.03), assetsOf(rec), NATURAL);
    expect(at30.headEdges).toBe(12);
    expect(at30.changes).toEqual([]);
    const at40 = learnCutKnobs(leadIns(0.04), assetsOf(rec), NATURAL);
    expect(at40.changes).toEqual([
      { knob: 'head', from: NATURAL.head, to: Math.round((NATURAL.head + 0.04) * 100) / 100, samples: 12 },
    ]);
  });

  it('says when the style lands the learned tails soft (margin does not reach them)', () => {
    const rec = recording(RATES);
    // natural: softGap 1.2 < the 1.5 s pauses → every join lands soft.
    const report = learnCutKnobs(joinsAt(rec, FITTED_TIGHT, RATES.length), assetsOf(rec), NATURAL);
    expect(report.notes.join(' ')).toMatch(/13 of 13 tails land soft under this style \(gap ≥ 1\.2 s\)/);
  });
});

/** Both edges of every join moved by a seeded uniform ±amp (s). */
function jitter(joins: CutLearnJoinInput[], seed: number, amp: number): CutLearnJoinInput[] {
  const rand = seeded(seed);
  return joins.map((j) => ({
    ...j,
    tailEdge: (j.tailEdge as number) + (rand() * 2 - 1) * amp,
    headEdge: (j.headEdge as number) + (rand() * 2 - 1) * amp,
  }));
}

/** mulberry32 — a seeded uniform [0, 1) for reproducible jitter. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
