import { describe, it, expect } from 'vitest';
import {
  QA_CLIPPED_TAIL_DB,
  QA_ENTRY_LOOKBACK_S,
  QA_ENTRY_WINDOW_S,
  QA_HARD_ENTRY_DB,
  QA_REAL_JOIN_GAP_S,
  QA_TAIL_WINDOW_S,
  findClippedTails,
  findHardEntries,
  formatCutQaLine,
  formatHardEntries,
  formatReleaseTails,
  mergeCutQa,
  qaForPlan,
  runCutQa,
  withQaAsset,
} from './cut-qa';
import { RmsEnvelope } from './rms-envelope';
import type { CutPlanStyle } from '@shared/types/studio-cut-plan';

const BPS = 50; // the waveform cache's 20 ms buckets
const FLOOR = -60;

/** `FLOOR` dB everywhere except the spans, each at FLOOR + its dB over. */
function envelope(durationSec: number, hot: Array<[number, number, number]>): RmsEnvelope {
  const buckets = Array.from({ length: Math.round(durationSec * BPS) }, (_, i) => {
    const t = i / BPS;
    const span = hot.find(([s, e]) => t >= s - 1e-9 && t < e - 1e-9);
    return span ? FLOOR + span[2] : FLOOR;
  });
  return new RmsEnvelope(buckets, BPS);
}

/** Hasan's fitted tight's tail knobs (punchy landings everywhere but the last atom). */
const STYLE: CutPlanStyle = {
  internalGap: 0.4,
  head: 0.15,
  minTail: 0.08,
  maxTail: 0.7,
  margin: 12,
  softGap: 99,
  softMaxTail: 0.6,
  softMargin: 6,
};

describe('cut QA constants', () => {
  it('are analyze_cut’s thresholds and windows', () => {
    expect([QA_HARD_ENTRY_DB, QA_REAL_JOIN_GAP_S, QA_ENTRY_LOOKBACK_S, QA_ENTRY_WINDOW_S]).toEqual([
      15, 0.75, 0.06, 0.05,
    ]);
    expect([QA_CLIPPED_TAIL_DB, QA_TAIL_WINDOW_S]).toEqual([6, 0.05]);
  });
});

describe('findHardEntries', () => {
  it('flags a cut-in whose 50 ms window 60 ms before reads +16 dB, not +14', () => {
    const hot = findHardEntries([{ start: 2, end: 3 }], envelope(10, [[1.9, 2.0, 16]]));
    expect(hot.joinsChecked).toBe(1);
    expect(hot.items).toEqual([{ kind: 'hard-entry', sourceTime: 2, overDb: 16 }]);
    const warm = findHardEntries([{ start: 2, end: 3 }], envelope(10, [[1.9, 2.0, 14]]));
    expect(warm.items).toEqual([]);
  });

  it('reads the window before the cut-in, not the speech after it', () => {
    // Loud speech from the cut-in on, quiet before: a clean entry.
    const r = findHardEntries([{ start: 2, end: 3 }], envelope(10, [[2.0, 3.0, 30]]));
    expect(r.items).toEqual([]);
  });

  it('skips compressed pauses (≤ 0.75 s) and checks real joins (> 0.75 s)', () => {
    const pause = findHardEntries(
      [
        { start: 1, end: 2 },
        { start: 2.6, end: 3.5 },
      ],
      envelope(10, [[2.5, 2.6, 20]]),
    );
    expect(pause.joinsChecked).toBe(1); // only the first segment
    expect(pause.items).toEqual([]);
    const join = findHardEntries(
      [
        { start: 1, end: 2 },
        { start: 2.8, end: 3.5 },
      ],
      envelope(10, [[2.7, 2.8, 20]]),
    );
    expect(join.joinsChecked).toBe(2);
    expect(join.items.map((x) => x.sourceTime)).toEqual([2.8]);
  });

  it('clamps the window at the start of the source', () => {
    const r = findHardEntries([{ start: 0.03, end: 1 }], envelope(10, [[0, 0.06, 20]]));
    expect(r.items).toEqual([{ kind: 'hard-entry', sourceTime: 0.03, overDb: 20 }]);
  });
});

describe('findClippedTails', () => {
  const atoms = [
    { start: 2, end: 3 },
    { start: 5, end: 6 },
  ];

  it('flags a tail that lands +7 dB over the floor, not +5', () => {
    // margin 12 stops the walk at minTail (0.08 s) on a +7 release: it lands in it.
    const loud = findClippedTails(atoms, STYLE, envelope(10, [[3.0, 3.2, 7]]));
    expect(loud.atomsChecked).toBe(2);
    expect(loud.items).toEqual([{ kind: 'clipped-tail', sourceTime: 3.08, wordEnd: 3, overDb: 7 }]);
    const soft = findClippedTails(atoms, STYLE, envelope(10, [[3.0, 3.2, 5]]));
    expect(soft.items).toEqual([]);
  });

  it('gives the last atom no gap: a soft, unclamped landing', () => {
    // Both releases ring +20 dB for 0.25 s. The first atom's tail is clamped by
    // the 0.4 s gap (0.4 − head − 0.06 = 0.19 s) and lands in its release; the
    // last atom has no gap, walks on to 0.26 s and lands in silence.
    const close = [
      { start: 2, end: 3 },
      { start: 3.4, end: 4 },
    ];
    const r = findClippedTails(
      close,
      STYLE,
      envelope(10, [
        [3.0, 3.25, 20],
        [4.0, 4.25, 20],
      ]),
    );
    expect(r.atomsChecked).toBe(2);
    expect(r.items).toEqual([{ kind: 'clipped-tail', sourceTime: 3.19, wordEnd: 3, overDb: 20 }]);
  });

  it('checks every atom, not every join (two atoms inside one segment)', () => {
    const r = findClippedTails(atoms, STYLE, envelope(10, [[3.0, 3.2, 7], [6.0, 6.7, 9]]));
    // The last atom's soft walk (margin 6) runs to softMaxTail 0.6 and still reads +9.
    expect(r.items.map((x) => x.wordEnd)).toEqual([3, 6]);
    expect(r.items[1].sourceTime).toBe(6.6);
  });
});

describe('runCutQa / mergeCutQa / formatCutQaLine', () => {
  const env = envelope(10, [
    [1.9, 2.0, 18],
    [3.0, 3.2, 7],
  ]);
  const report = runCutQa({
    segments: [{ start: 2, end: 3.08 }],
    atoms: [
      { start: 2.15, end: 3 },
      { start: 5, end: 6 },
    ],
    style: STYLE,
    envelope: env,
  });

  it('counts both checks, hard entries first', () => {
    expect(report).toMatchObject({ hardEntries: 1, clippedTails: 1, joinsChecked: 1, atomsChecked: 2 });
    expect(report.items.map((x) => x.kind)).toEqual(['hard-entry', 'clipped-tail']);
  });

  it('merges clips and keeps hard entries first', () => {
    const merged = mergeCutQa([report, report]);
    expect(merged).toMatchObject({ hardEntries: 2, clippedTails: 2, joinsChecked: 2, atomsChecked: 4 });
    expect(merged.items.map((x) => x.kind)).toEqual(['hard-entry', 'hard-entry', 'clipped-tail', 'clipped-tail']);
  });

  it('reads with denominators, or "QA clean" only when both counts are 0', () => {
    expect(formatHardEntries(report)).toBe('Hard entries 1 of 1 join');
    expect(formatReleaseTails(report)).toBe('Tails on a release 1 of 2 landings');
    expect(formatCutQaLine(report)).toBe('Hard entries 1 of 1 join · tails on a release 1 of 2 landings');
    expect(formatCutQaLine({ ...report, hardEntries: 0, items: report.items.slice(1) })).toBe(
      'Hard entries 0 of 1 join · tails on a release 1 of 2 landings',
    );
    expect(formatCutQaLine(mergeCutQa([]))).toBe('QA clean');
  });
});

describe('qaForPlan / withQaAsset', () => {
  // Two keeps with a 1.2 s skip between them; the second cut-in sits right
  // after a +18 dB burst, the first keep's two words are 0.5 s apart.
  const env = envelope(10, [
    [1.0, 1.5, 25],
    [2.0, 2.4, 25],
    [3.5, 3.65, 18],
    [3.7, 4.4, 25],
  ]);
  const words = [
    { text: 'four', start: 3.7, end: 4.4 },
    { text: 'one', start: 1.0, end: 1.5 },
    { text: 'two', start: 2.0, end: 2.4 },
  ];
  const keeps = [
    { start: 0.9, end: 2.5 },
    { start: 3.6, end: 4.5 },
  ];
  const segments = [
    { start: 0.85, end: 2.48 },
    { start: 3.6, end: 4.6 },
  ];

  it("re-derives the planner's atoms from keeps + words + the style's internalGap", () => {
    const report = qaForPlan({ segments, keeps, words, style: STYLE, envelope: env });
    // internalGap 0.4 splits "one | two" (0.5 s pause) → 3 atoms; the 1.2 s skip is a real join.
    expect(report).toMatchObject({ hardEntries: 1, joinsChecked: 2, atomsChecked: 3 });
    expect(report.items[0]).toMatchObject({ kind: 'hard-entry', sourceTime: 3.6, overDb: 18 });
    // An infinite internalGap (the editorial snapper) keeps each keep one atom.
    const editorial = qaForPlan({ segments, keeps, words, style: { ...STYLE, internalGap: Infinity }, envelope: env });
    expect(editorial.atomsChecked).toBe(2);
  });

  it('stamps every item with its asset, keeping an asset already named', () => {
    const report = qaForPlan({ segments, keeps, words, style: STYLE, envelope: env });
    const stamped = withQaAsset(
      { ...report, items: [...report.items, { kind: 'clipped-tail', sourceTime: 9, overDb: 7, assetId: 'other' }] },
      'a1',
    );
    expect(stamped.items.map((x) => x.assetId)).toEqual([...report.items.map(() => 'a1'), 'other']);
    expect(report.items.every((x) => x.assetId === undefined)).toBe(true);
  });
});
