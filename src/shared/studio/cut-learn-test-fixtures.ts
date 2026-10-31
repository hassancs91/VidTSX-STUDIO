// B4 test fixtures — hand-made recordings for learning the cut knobs: one
// word per "sentence", a release that decays at a known rate, 1.5 s pauses.
// Shared by the pure tests (cut-learn.test.ts) and the tool-handler test
// (agent-tools/preset-tools.test.ts). Not imported by app code.

import { styleLeadIn, type CutLearnAsset } from './cut-learn-measure';
import { tailFor, type PlanWord } from './cut-planner';
import { RmsEnvelope } from './rms-envelope';
import type { CutPlanStyle } from '../types/studio-cut-plan';
import type { CutLearnJoinInput } from '../types/studio-cut-learn';

export const BPS = 50;
export const FLOOR = -60;
export const SPEECH = -20;
export const PAUSE = 1.5;

/** Hasan's fitted tight (cut-style.json `tight`) — the user's geometry in the positive case. */
export const FITTED_TIGHT: CutPlanStyle = {
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
export const NATURAL: CutPlanStyle = {
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
export const OLD_TIGHT: CutPlanStyle = { ...FITTED_TIGHT, head: 0.11, minTail: 0.14, maxTail: 0.4, margin: 5 };

/** Decay rates (dB/s) after each sentence; 2000 = an abrupt stop. */
export const RATES = [2000, 60, 80, 100, 120, 150, 200, 250, 90, 70, 110, 2000, 130];
/** Sentences whose onset starts 0.2 s before the word's ASR start. */
export const EARLY = new Set([3, 7, 10]);

export interface Recording {
  asset: CutLearnAsset;
  words: PlanWord[];
  /** The envelope's raw buckets (dB, BPS per second) — what a v3 waveform file holds. */
  levels: number[];
  zcr: number[];
}

export function recording(rates: number[]): Recording {
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
  const zcr = new Array<number>(levels.length).fill(1200);
  const envelope = new RmsEnvelope(levels, BPS, zcr);
  return { asset: { words, envelope }, words, levels, zcr };
}

/** Joins between sentence k and k+1, edges where `style` itself would put them. */
export function joinsAt(rec: Recording, style: CutPlanStyle, count: number): CutLearnJoinInput[] {
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

export const assetsOf = (rec: Recording) => new Map([['A', rec.asset]]);
