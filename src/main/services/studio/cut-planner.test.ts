import { describe, it, expect } from 'vitest';
import {
  NATURAL_STYLE,
  RmsEnvelope,
  TIGHT_STYLE,
  internalPauses,
  planClip,
  planCuts,
  splitAtoms,
  styleForFeatures,
  tailFor,
} from './cut-planner';
import type { PlanWord } from './cut-planner';
import type { SttModelFeatures } from '@shared/presets/stt-models';

const BPS = 50; // matches the waveform cache's PEAKS_PER_SECOND

/** Synthetic envelope: `loud` dB inside the given spans, `quiet` elsewhere. */
function makeEnvelope(
  durationSec: number,
  loudSpans: Array<[number, number]>,
  { loud = -20, quiet = -55 } = {},
): RmsEnvelope {
  const buckets = Array.from({ length: Math.round(durationSec * BPS) }, (_, i) => {
    const t = i / BPS;
    return loudSpans.some(([s, e]) => t >= s && t < e) ? loud : quiet;
  });
  return new RmsEnvelope(buckets, BPS);
}

function word(text: string, start: number, end: number): PlanWord {
  return { text, start, end };
}

const ALL_FEATURES: SttModelFeatures = {
  wordTimestamps: true,
  approximateWordTimestamps: false,
  speakerLabels: true,
  highlights: true,
  sentiment: true,
  audioEvents: false,
  verbatimDisfluencies: true,
};

describe('RmsEnvelope', () => {
  it('reads the level of the buckets under the window', () => {
    const env = makeEnvelope(2, [[0, 1]]);
    expect(env.rmsDb(0.5)).toBeCloseTo(-20, 0);
    expect(env.rmsDb(1.5)).toBeCloseTo(-55, 0);
  });

  it('returns silence for windows outside the envelope', () => {
    const env = makeEnvelope(2, [[0, 2]]);
    expect(env.rmsDb(100)).toBe(-120);
    expect(env.rmsDb(-5)).toBe(-120);
  });

  it('mixed windows average POWER, so a loud bucket dominates', () => {
    const env = makeEnvelope(2, [[0, 1]]);
    // Window straddling the loud→quiet edge: closer to -20 than to the
    // arithmetic midpoint -37.5, because power (not dB) is averaged.
    const db = env.rmsDb(0.98, 0.1);
    expect(db).toBeGreaterThan(-28);
    expect(db).toBeLessThan(-20);
  });

  it('noise floor is the 10th percentile of bucket levels', () => {
    // 80% loud, 20% quiet — the floor must find the quiet minority.
    const env = makeEnvelope(10, [[0, 8]]);
    expect(env.floorDb()).toBe(-55);
  });

  describe('snapTail', () => {
    it('returns minTail when the word ends cleanly', () => {
      const env = makeEnvelope(5, [[0.2, 0.9]]);
      expect(env.snapTail(0.9, 0.14, 0.4, 5)).toBe(0.14);
    });

    it('walks out to cover a long release', () => {
      // Audio stays hot until 1.25 s — 0.35 s of release after the word end.
      const env = makeEnvelope(5, [[0.2, 1.25]]);
      expect(env.snapTail(0.9, 0.14, 0.4, 5)).toBeCloseTo(0.36, 3);
    });

    it('caps at maxTail when the audio never decays', () => {
      // Quiet lead-in so the derived floor stays low; hot from the word on.
      const env = makeEnvelope(5, [[0.9, 5]]);
      expect(env.snapTail(0.9, 0.14, 0.4, 5)).toBe(0.4);
    });
  });
});

describe('splitAtoms', () => {
  const keeps = [{ start: 0, end: 10 }];

  it('keeps with no words become one atom as-is', () => {
    expect(splitAtoms(keeps, [], 0.4)).toEqual([{ start: 0, end: 10 }]);
  });

  it('splits at pauses ≥ internalGap and holds through smaller ones', () => {
    const words = [
      word('a', 0.2, 0.5),
      word('b', 0.8, 1.0), // 0.3 gap — held
      word('c', 1.5, 2.0), // 0.5 gap — split
    ];
    expect(splitAtoms(keeps, words, 0.4)).toEqual([
      { start: 0.2, end: 1.0 },
      { start: 1.5, end: 2.0 },
    ]);
  });

  it('only counts words inside the keep (with the 0.02 s tolerance)', () => {
    const words = [word('outside', 4.0, 4.5), word('edge', 5.985, 6.4), word('in', 6.6, 7.0)];
    const atoms = splitAtoms([{ start: 6.0, end: 8.0 }], words, 0.4);
    expect(atoms).toEqual([{ start: 5.985, end: 7.0 }]);
  });
});

describe('tailFor', () => {
  const env = makeEnvelope(10, [[0.2, 0.9]]);

  it('no following gap = section end = soft landing', () => {
    const { soft } = tailFor(env, 0.9, null, TIGHT_STYLE);
    expect(soft).toBe(true);
  });

  it('large following gap lands soft, small gap lands punchy', () => {
    expect(tailFor(env, 0.9, 2.0, TIGHT_STYLE).soft).toBe(true);
    expect(tailFor(env, 0.9, 0.8, TIGHT_STYLE).soft).toBe(false);
  });

  it('never crosses into the next atom lead-in', () => {
    // Hot audio all the way: snap wants maxTail, but the next atom starts
    // 0.3 s away and needs its 0.11 s head + 0.06 s clearance.
    const hot = makeEnvelope(10, [[0, 10]]);
    const { tail } = tailFor(hot, 0.9, 0.3, TIGHT_STYLE);
    expect(tail).toBeCloseTo(0.3 - TIGHT_STYLE.head - 0.06, 3);
  });

  it('keeps at least half of minTail even for tiny gaps', () => {
    const hot = makeEnvelope(10, [[0, 10]]);
    const { tail } = tailFor(hot, 0.9, 0.1, TIGHT_STYLE);
    expect(tail).toBeCloseTo(TIGHT_STYLE.minTail * 0.5, 3);
  });
});

describe('planClip', () => {
  const keeps = [{ start: 0, end: 5 }];
  const words = [
    word('hello', 0.2, 0.5),
    word('there', 0.55, 0.9),
    word('next', 3.0, 3.3),
    word('section', 3.35, 3.8),
  ];
  const env = makeEnvelope(5, [
    [0.2, 0.9],
    [3.0, 3.8],
  ]);

  it('compresses the pause between atoms and pads head/tail', () => {
    const segments = planClip(keeps, words, TIGHT_STYLE, env);
    expect(segments).toEqual([
      // First atom: roomier open (min(0.25, head·2) = 0.22, clamped at 0),
      // clean word end → minTail. 2.1 s gap ≥ softGap → soft landing.
      { start: 0, end: 1.04, speechStart: 0.2, speechEnd: 0.9, soft: true },
      // Second atom: normal head, no following atom → soft.
      { start: 2.89, end: 3.94, speechStart: 3.0, speechEnd: 3.8, soft: true },
    ]);
    // The 2.1 s pause is compressed out: nothing keeps [1.04, 2.89].
    expect(segments[0].end).toBeLessThan(segments[1].start);
  });

  it('a tail never rides into an explicitly cut span, even over cut SPEECH', () => {
    // The material right after the kept atom is cut speech, not silence — the
    // RMS walk alone would sail through it (the documented cutlib failure
    // mode: 0.70 s of a cut phrase survived into the render this way).
    const hotThroughCut = makeEnvelope(5, [[0.2, 2.0]]);
    const segments = planClip(
      [{ start: 0, end: 1.0 }],
      [word('keep', 0.2, 0.9), word('cutme', 1.1, 1.9)],
      TIGHT_STYLE,
      hotThroughCut,
      [{ start: 1.0, end: 2.0 }],
    );
    expect(segments).toHaveLength(1);
    expect(segments[0].end).toBe(1.0);
  });

  it('a lead-in never crosses back into a cut span', () => {
    const segments = planClip(keeps, words, TIGHT_STYLE, env, [{ start: 1.0, end: 2.95 }]);
    expect(segments[1].start).toBe(2.95);
  });
});

describe('internalPauses', () => {
  it('reports dead air inside kept speech with its neighbours', () => {
    const words = [word('so', 0.2, 0.4), word('anyway', 2.6, 3.0), word('right', 3.1, 3.4)];
    const pauses = internalPauses([{ start: 0, end: 5 }], words, 0.4);
    expect(pauses).toEqual([{ at: 0.4, gap: 2.2, before: 'so', after: 'anyway' }]);
  });
});

describe('styleForFeatures', () => {
  it('measured timing uses the style untouched', () => {
    expect(styleForFeatures(TIGHT_STYLE, ALL_FEATURES)).toEqual(TIGHT_STYLE);
  });

  it('approximate (or unknown) timing widens the pads, never refuses', () => {
    const widened = styleForFeatures(TIGHT_STYLE, {
      ...ALL_FEATURES,
      wordTimestamps: false,
      approximateWordTimestamps: true,
    });
    expect(widened.head).toBeCloseTo(TIGHT_STYLE.head + 0.08, 3);
    expect(widened.minTail).toBeCloseTo(TIGHT_STYLE.minTail + 0.06, 3);
    expect(widened.maxTail).toBeCloseTo(TIGHT_STYLE.maxTail + 0.2, 3);
    expect(widened.softMaxTail).toBeCloseTo(TIGHT_STYLE.softMaxTail + 0.2, 3);
    expect(styleForFeatures(TIGHT_STYLE, undefined).head).toBeCloseTo(0.19, 3);
    // The dB knobs and gap thresholds stay put.
    expect(widened.internalGap).toBe(TIGHT_STYLE.internalGap);
    expect(widened.margin).toBe(TIGHT_STYLE.margin);
  });
});

describe('planCuts (end to end)', () => {
  const words = [
    word('hello', 0.2, 0.5),
    word('there', 0.55, 0.9),
    word('next', 3.0, 3.3),
    word('section', 3.35, 3.8),
  ];
  const env = makeEnvelope(5, [
    [0.2, 0.9],
    [3.0, 3.8],
  ]);

  const base = {
    assetId: 'asset-1',
    createdAt: '2026-08-08T00:00:00.000Z',
    styleName: 'tight' as const,
    duration: 5,
    words,
    envelope: env,
    sttModelId: 'assemblyai/universal',
    features: ALL_FEATURES,
  };

  it('produces segments, honest stats, and no caveats for a fully-capable engine', () => {
    const plan = planCuts(base);
    expect(plan.segments).toHaveLength(2);
    expect(plan.style).toEqual(TIGHT_STYLE);
    expect(plan.stats).toEqual({
      sourceDuration: 5,
      keptDuration: 2.09,
      removedDuration: 2.91,
      atomCount: 2,
      wordCount: 4,
      internalPauseCount: 1,
      noiseFloorDb: -55,
    });
    expect(plan.internalPauses[0]).toMatchObject({ at: 0.9, before: 'there', after: 'next' });
    expect(plan.qaNotes).toEqual([]);
  });

  it('a floor-capability engine still yields a valid plan, with caveats stated', () => {
    // Whisper fallback shape: approximate timing, nothing else.
    const plan = planCuts({
      ...base,
      sttModelId: 'local-whisper/base',
      features: {
        wordTimestamps: false,
        approximateWordTimestamps: true,
        speakerLabels: false,
        highlights: false,
        sentiment: false,
        audioEvents: false,
        verbatimDisfluencies: false,
      },
    });
    expect(plan.segments.length).toBeGreaterThan(0);
    expect(plan.style.head).toBeCloseTo(TIGHT_STYLE.head + 0.08, 3);
    expect(plan.qaNotes).toHaveLength(2);
    expect(plan.qaNotes[0]).toMatch(/not verbatim/);
    expect(plan.qaNotes[1]).toMatch(/approximate/);
  });

  it('unknown features (no snapshot recorded) get the caveats too', () => {
    const plan = planCuts({ ...base, features: undefined });
    expect(plan.qaNotes).toHaveLength(2);
  });

  it('natural style pads more generously than tight', () => {
    const tight = planCuts(base);
    const natural = planCuts({ ...base, styleName: 'natural' });
    expect(natural.style).toEqual(NATURAL_STYLE);
    expect(natural.stats.keptDuration).toBeGreaterThan(tight.stats.keptDuration);
  });

  it('words arriving out of order are sorted before planning', () => {
    const shuffled = [...words].reverse();
    expect(planCuts({ ...base, words: shuffled }).segments).toEqual(planCuts(base).segments);
  });
});
