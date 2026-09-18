import { describe, it, expect } from 'vitest';
import { RmsEnvelope, type PlanWord } from '../../../shared/studio/cut-planner';
import {
  buildEditorialProposal,
  snapEditorialCuts,
  type EditorialSpanInput,
} from './editorial-cuts';
import type { SttModelFeatures } from '@shared/presets/stt-models';

const BPS = 50;

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

const MEASURED: SttModelFeatures = {
  wordTimestamps: true,
  approximateWordTimestamps: false,
  speakerLabels: false,
  highlights: false,
  sentiment: false,
  audioEvents: false,
  verbatimDisfluencies: true,
};

/** Keep [0..2], retake [3..5], keep [6..8]; speech hot under every word. */
function retakeFixture() {
  const words = [
    word('Keep', 0.2, 1.0),
    word('this.', 1.2, 2.0),
    word('Cut', 3.0, 4.0),
    word('that.', 4.2, 5.0),
    word('Keep', 6.0, 7.0),
    word('too.', 7.2, 8.0),
  ];
  const envelope = makeEnvelope(9, [
    [0.2, 2.0],
    [3.0, 5.0],
    [6.0, 8.0],
  ]);
  return { words, envelope };
}

describe('snapEditorialCuts', () => {
  it('snaps a retake span outward into the surrounding silence', () => {
    const { words, envelope } = retakeFixture();
    const spans: EditorialSpanInput[] = [
      { start: 3.0, end: 5.0, category: 'retake', note: 'superseded by the take at 6.0' },
    ];
    const result = snapEditorialCuts({ spans, words, duration: 9, envelope, features: MEASURED });

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    // Start lands after the previous word's decay tail (in the pause), not
    // hard on the agent's boundary; end backs off by the next atom's lead-in.
    expect(item.sourceStart).toBeGreaterThan(2.0);
    expect(item.sourceStart).toBeLessThan(3.0);
    expect(item.sourceEnd).toBeGreaterThan(5.0);
    expect(item.sourceEnd).toBeLessThan(6.0);
    expect(item.category).toBe('retake');
    expect(item.note).toBe('superseded by the take at 6.0');
    expect(item.text).toBe('Cut that.');
    expect(result.removedSeconds).toBeCloseTo(item.sourceEnd - item.sourceStart, 3);
  });

  it('never lets a keep tail ride into cut speech (clamp at the cut start)', () => {
    // Speech is continuous 0.2..5.0; the cut starts right after the kept word.
    const words = [word('keep.', 0.2, 2.0), word('cut', 2.05, 4.9), word('after', 6.0, 7.0)];
    const envelope = makeEnvelope(8, [
      [0.2, 5.0],
      [6.0, 7.0],
    ]);
    const result = snapEditorialCuts({
      spans: [{ start: 2.05, end: 5.0, category: 'false_start', note: 'restarts at 6.0' }],
      words,
      duration: 8,
      envelope,
      features: MEASURED,
    });
    expect(result.items).toHaveLength(1);
    // The decay tail would walk 0.95 s into the cut speech — the clamp stops
    // it exactly at the span start.
    expect(result.items[0].sourceStart).toBeCloseTo(2.05, 3);
  });

  it('merges overlapping spans, keeping the dominant category and both notes', () => {
    const { words, envelope } = retakeFixture();
    const result = snapEditorialCuts({
      spans: [
        { start: 3.0, end: 4.5, category: 'retake', note: 'first' },
        { start: 4.0, end: 5.0, category: 'filler', note: 'second' },
      ],
      words,
      duration: 9,
      envelope,
      features: MEASURED,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('retake');
    expect(result.items[0].note).toBe('first · second');
    expect(result.notes.some((n) => n.includes('merged'))).toBe(true);
  });

  it('merges through a short wordless sliver between two cuts', () => {
    const { words, envelope } = retakeFixture();
    const result = snapEditorialCuts({
      spans: [
        { start: 3.0, end: 4.05, category: 'retake', note: 'a' },
        { start: 4.15, end: 5.0, category: 'retake', note: 'b' },
      ],
      words: words.filter((w) => w.text !== 'that.'), // nothing spoken in the sliver
      duration: 9,
      envelope,
      features: MEASURED,
    });
    expect(result.items).toHaveLength(1);
  });

  it('keeps cuts separate when spoken words sit between them', () => {
    const words = [
      word('a', 0.2, 1.0),
      word('cut1', 2.0, 2.8),
      word('kept', 3.5, 4.3),
      word('cut2', 5.0, 5.8),
      word('z', 7.0, 7.8),
    ];
    const envelope = makeEnvelope(9, [
      [0.2, 1.0],
      [2.0, 2.8],
      [3.5, 4.3],
      [5.0, 5.8],
      [7.0, 7.8],
    ]);
    const result = snapEditorialCuts({
      spans: [
        { start: 2.0, end: 2.8, category: 'filler', note: 'x' },
        { start: 5.0, end: 5.8, category: 'filler', note: 'y' },
      ],
      words,
      duration: 9,
      envelope,
      features: MEASURED,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].sourceEnd).toBeLessThan(result.items[1].sourceStart);
  });

  it('clamps to the audio and drops spans fully outside it', () => {
    const { words, envelope } = retakeFixture();
    const result = snapEditorialCuts({
      spans: [
        { start: 20, end: 25, category: 'retake', note: 'ghost' },
        { start: 3.0, end: 5.0, category: 'retake', note: 'real' },
      ],
      words,
      duration: 9,
      envelope,
      features: MEASURED,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].note).toBe('real');
    expect(result.notes.some((n) => n.includes('dropped'))).toBe(true);
  });

  it('a cut at the very start snaps its start to 0', () => {
    const { words, envelope } = retakeFixture();
    const result = snapEditorialCuts({
      spans: [{ start: 0, end: 2.5, category: 'false_start', note: 'abandoned open' }],
      words,
      duration: 9,
      envelope,
      features: MEASURED,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].sourceStart).toBe(0);
    // End backs off before the next kept word (3.0) by the lead-in pad.
    expect(result.items[0].sourceEnd).toBeGreaterThan(2.5);
    expect(result.items[0].sourceEnd).toBeLessThan(3.0);
  });

  it('returns empty for no usable spans', () => {
    const { words, envelope } = retakeFixture();
    const result = snapEditorialCuts({
      spans: [{ start: 5, end: 5.01, category: 'filler', note: 'too small' }],
      words,
      duration: 9,
      envelope,
      features: MEASURED,
    });
    expect(result.items).toEqual([]);
    expect(result.removedSeconds).toBe(0);
  });
});

describe('buildEditorialProposal', () => {
  const items = [
    { sourceStart: 1, sourceEnd: 2, category: 'retake' as const, note: 'why', text: 'a b' },
    { sourceStart: 4, sourceEnd: 5, category: 'fluff' as const, note: 'aside', text: 'c' },
  ];

  it('wraps items as a proposed cut-plan with veto-based statuses', () => {
    const proposal = buildEditorialProposal({
      assetId: 'asset-1',
      items,
      removedSeconds: 2,
      sourceDuration: 40,
      engine: 'assemblyai',
      summary: 'One retake, one aside.',
    });
    expect(proposal.kind).toBe('cut-plan');
    expect(proposal.status).toBe('proposed');
    expect(proposal.items).toHaveLength(2);
    // Retakes start accepted (veto-based); fluff starts unchecked (opt-in).
    expect(proposal.items[0]).toMatchObject({
      status: 'accepted',
      assetId: 'asset-1',
      sourceStart: 1,
      sourceEnd: 2,
      category: 'retake',
      text: 'a b',
      note: 'why',
    });
    expect(proposal.items[1].status).toBe('rejected');
    expect(proposal.items[1].category).toBe('fluff');
  });

  it('writes an honest headline plus the summary and fluff hint', () => {
    const proposal = buildEditorialProposal({
      assetId: 'a',
      items,
      removedSeconds: 2,
      sourceDuration: 40,
      engine: 'assemblyai',
      summary: 'One retake, one aside.',
      qaNotes: ['1 span merged'],
    });
    const lines = (proposal.agentNote ?? '').split('\n');
    expect(lines[0]).toBe('Editorial cut · assemblyai · −2.0 s of 40.0 s');
    expect(lines[1]).toBe('One retake, one aside.');
    expect(lines.some((l) => l.includes('fluff suggestion'))).toBe(true);
    expect(lines).toContain('1 span merged');
  });

  it('gives every item a unique id', () => {
    const proposal = buildEditorialProposal({
      assetId: 'a',
      items,
      removedSeconds: 2,
      sourceDuration: 40,
    });
    const ids = new Set(proposal.items.map((i) => i.id));
    expect(ids.size).toBe(proposal.items.length);
  });
});
