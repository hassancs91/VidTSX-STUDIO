// B4 — learn the cut knobs from the user's joins: measurement, the Q4 gates,
// the fit, the per-join list. Hand-made envelopes: one word per "sentence",
// a release that decays at a known rate, 1.5 s pauses between sentences.

import { describe, it, expect } from 'vitest';
import { learnCutKnobs } from './cut-learn';
import { measureCutJoins, styleLeadIn, type CutLearnAsset } from './cut-learn-measure';
import { tailFor, type PlanWord } from './cut-planner';
import { RmsEnvelope } from './rms-envelope';
import type { CutPlanStyle } from '../types/studio-cut-plan';
import type { CutLearnJoinInput } from '../types/studio-cut-learn';

const BPS = 50;
const FLOOR = -60;
const SPEECH = -20;
const PAUSE = 1.5;

/** Hasan's fitted tight (cut-style.json `tight`) — the user's geometry in the positive case. */
const FITTED_TIGHT: CutPlanStyle = {
  internalGap: 0.4,
  head: 0.15,
  minTail: 0.08,
  maxTail: 0.7,
  margin: 12,
  softGap: 99,
  softMaxTail: 0.6,
  softMargin: 6,
  maxHead: 0.3,
  minSkip: 0.12,
  fricZcr: 3500,
  fricMargin: 5,
};

/** cut-style.json `natural`: no maxHead (the lead-in is `head`), softGap 1.2. */
const NATURAL: CutPlanStyle = {
  internalGap: 0.4,
  head: 0.21,
  minTail: 0.26,
  maxTail: 0.45,
  margin: 6,
  softGap: 1.2,
  softMaxTail: 0.7,
  softMargin: 3,
};

/** The pre-October tight as a project override over base tight (the stand-in's start). */
const OLD_TIGHT: CutPlanStyle = { ...FITTED_TIGHT, head: 0.11, minTail: 0.14, maxTail: 0.4, margin: 5 };

/** Decay rates (dB/s) after each sentence; 2000 = an abrupt stop. */
const RATES = [2000, 60, 80, 100, 120, 150, 200, 250, 90, 70, 110, 2000, 130];
/** Sentences whose onset starts 0.2 s before the word's ASR start. */
const EARLY = new Set([3, 7, 10]);

interface Recording {
  asset: CutLearnAsset;
  words: PlanWord[];
}

function recording(rates: number[]): Recording {
  const words: PlanWord[] = [];
  const total = 2 + (rates.length + 1) * (1 + PAUSE);
  const levels = new Array<number>(Math.round(total * BPS)).fill(FLOOR);
  const paint = (from: number, to: number, f: (t: number) => number) => {
    for (let i = 0; i < levels.length; i++) {
      const c = (i + 0.5) / BPS;
      if (c >= from && c < to) levels[i] = Math.max(levels[i], f(c));
    }
  };
  for (let k = 0; k <= rates.length; k++) {
    const start = 1 + k * (1 + PAUSE);
    const end = start + 1;
    words.push({ text: `w${k}`, start, end });
    paint(start, end, () => SPEECH);
    if (EARLY.has(k)) paint(start - 0.2, start, () => -30);
    if (k < rates.length) paint(end, end + PAUSE, (c) => Math.max(FLOOR, SPEECH - rates[k] * (c - end)));
  }
  const envelope = new RmsEnvelope(levels, BPS, new Array<number>(levels.length).fill(1200));
  return { asset: { words, envelope }, words };
}

/** Joins between sentence k and k+1, edges where `style` itself would put them. */
function joinsAt(rec: Recording, style: CutPlanStyle, count: number): CutLearnJoinInput[] {
  const { words, envelope } = rec.asset;
  return Array.from({ length: count }, (_, k) => {
    const a = words[k];
    const b = words[k + 1];
    const tail = tailFor(envelope, a.end, b.start - a.end, style).tail;
    const lead = styleLeadIn(envelope, b.start, style);
    return {
      assetId: 'A',
      tailEdge: a.end + tail,
      headEdge: b.start - lead,
      tailTouched: true,
      headTouched: true,
      source: 'trim' as const,
      ref: `j${k}`,
    };
  });
}

const assetsOf = (rec: Recording) => new Map([['A', rec.asset]]);

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
    expect(report.notes.join(' ')).toMatch(/lead-ins sit within 30 ms/);
    expect(report.notes.join(' ')).toMatch(/tails sit within 30 ms and 1 dB/);
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
