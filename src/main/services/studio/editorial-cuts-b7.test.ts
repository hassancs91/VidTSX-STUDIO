// B7 — the six hard entries the track-B exit found on the produced cut
// (docs/studio/end-to-end/ORCHESTRATOR.md "TRACK B EXIT"), as fixtures: the
// real transcript words, the real 20 ms RMS/ZCR buckets around each join (the
// rest of the clip padded at its measured noise floor), and the editorial
// spans the B6 assistant's cards carried. Every case must come out with no
// hard entry on the editorial card AND on the produced cut — the editorial
// apply followed by Auto Cut over what is left on the timeline.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SttModelFeatures } from '@shared/presets/stt-models';
import type { CutPlanStyle } from '@shared/types/studio-cut-plan';
import { RmsEnvelope, planCuts, type PlanSpan, type PlanWord } from '../../../shared/studio/cut-planner';
import { findHardEntries } from '../../../shared/studio/cut-qa';
import { buildEditorialProposal, snapEditorialCuts, type EditorialCategory } from './editorial-cuts';

interface FixtureClip {
  assetId: string;
  bucketsPerSecond: number;
  buckets: number;
  floorDb: number;
  hasZcr: boolean;
}

interface FixtureCase {
  clip: string;
  /** The produced cut's hard entry (source seconds). */
  at: number;
  firstBucket: number;
  rmsDb: number[];
  zcr?: number[];
  words: PlanWord[];
  spans: Array<{ start: number; end: number; category: EditorialCategory; status: string }>;
}

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../shared/studio/cut-snap-b7.fixture.json', import.meta.url)), 'utf-8'),
) as { clips: Record<string, FixtureClip>; cases: FixtureCase[] };

/** The shipped tight style — the knobs B6's run planned with (key 42f80e70), read from the file the app reads. */
const TIGHT = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../../resources/skills/studio-clean-cut/cut-style.json', import.meta.url)),
      'utf-8',
    ),
  ) as { styles: Record<string, CutPlanStyle> }
).styles.tight;

const MEASURED: SttModelFeatures = {
  wordTimestamps: true,
  approximateWordTimestamps: false,
  speakerLabels: false,
  highlights: false,
  sentiment: false,
  audioEvents: false,
  verbatimDisfluencies: true,
};

/** How far from the case's join a hard entry still counts as "this case". */
const NEAR_S = 1.0;

function envelopeFor(c: FixtureCase): RmsEnvelope {
  const clip = FIXTURE.clips[c.clip];
  const rms = new Array<number>(clip.buckets).fill(clip.floorDb);
  const zcr = new Array<number>(clip.buckets).fill(0);
  c.rmsDb.forEach((v, i) => (rms[c.firstBucket + i] = v));
  c.zcr?.forEach((v, i) => (zcr[c.firstBucket + i] = v));
  return new RmsEnvelope(rms, clip.bucketsPerSecond, clip.hasZcr ? zcr : undefined);
}

function snapCase(c: FixtureCase) {
  const envelope = envelopeFor(c);
  const duration = envelope.duration();
  const snapped = snapEditorialCuts({
    spans: c.spans.map((s) => ({ start: s.start, end: s.end, category: s.category })),
    words: c.words,
    duration,
    envelope,
    features: MEASURED,
    style: TIGHT,
  });
  const proposal = buildEditorialProposal({
    assetId: FIXTURE.clips[c.clip].assetId,
    items: snapped.items,
    removedSeconds: snapped.removedSeconds,
    sourceDuration: duration,
    ...(snapped.qa ? { qa: snapped.qa } : {}),
  });
  return { envelope, duration, snapped, proposal };
}

/** The editorial card applied as it would be by default, then Auto Cut over the timeline's keeps. */
function producedSegments(c: FixtureCase): { segments: PlanSpan[]; envelope: RmsEnvelope } {
  const { envelope, duration, proposal } = snapCase(c);
  const cuts: PlanSpan[] = proposal.items
    .flatMap((i) =>
      i.status === 'accepted' && i.sourceStart !== undefined && i.sourceEnd !== undefined
        ? [{ start: i.sourceStart, end: i.sourceEnd }]
        : [],
    )
    .sort((a, b) => a.start - b.start);
  const keeps: PlanSpan[] = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start - cursor >= 0.05) keeps.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  }
  if (duration - cursor >= 0.05) keeps.push({ start: cursor, end: duration });
  const plan = planCuts({
    assetId: 'a',
    createdAt: '2026-10-23T00:00:00.000Z',
    styleName: 'tight',
    style: TIGHT,
    duration,
    words: c.words,
    envelope,
    keeps,
    cuts,
    features: MEASURED,
  });
  return { segments: plan.segments, envelope };
}

function label(c: FixtureCase): string {
  return `${c.clip} @ ${c.at}`;
}

describe('B7 fixtures', () => {
  it('pad each clip at its own measured noise floor', () => {
    for (const c of FIXTURE.cases) {
      expect(envelopeFor(c).floorDb(), label(c)).toBeCloseTo(FIXTURE.clips[c.clip].floorDb, 2);
    }
  });
});

describe.each(FIXTURE.cases.map((c) => [label(c), c] as const))('B7 hard entry %s', (_name, c) => {
  it("leaves no hard entry on the editorial card's own QA", () => {
    const { proposal } = snapCase(c);
    const hard = (proposal.qa?.items ?? []).filter(
      (i) => i.kind === 'hard-entry' && Math.abs(i.sourceTime - c.at) < NEAR_S,
    );
    expect(hard).toEqual([]);
  });

  it('leaves no hard entry on the produced cut (editorial apply, then Auto Cut over the keeps)', () => {
    const { segments, envelope } = producedSegments(c);
    const hard = findHardEntries(segments, envelope).items.filter((i) => Math.abs(i.sourceTime - c.at) < NEAR_S);
    expect(hard).toEqual([]);
  });

  it('leaves no wordless sliver in the produced cut near the join', () => {
    const { segments } = producedSegments(c);
    const wordless = segments.filter(
      (s) =>
        Math.abs(s.start - c.at) < NEAR_S &&
        !c.words.some((w) => w.start >= s.start - 0.02 && w.end <= s.end + 0.02),
    );
    expect(wordless).toEqual([]);
  });
});

describe('B7 mechanism 1 — wordless gaps between two editorial cuts merge whatever their length', () => {
  const cases: Array<[string, number, number]> = [
    ['0366', 4.83, 5.89],
    ['0366', 12.63, 14.34],
    ['0373', 247.86, 249.35],
  ];
  it.each(cases)('%s: the gap %f–%f is inside one item', (clip, gapStart, gapEnd) => {
    const c = FIXTURE.cases.find((x) => x.clip === clip && x.at === gapStart);
    expect(c).toBeDefined();
    if (!c) return;
    const { snapped } = snapCase(c);
    expect(snapped.items.some((i) => i.sourceStart <= gapStart && i.sourceEnd >= gapEnd)).toBe(true);
  });

  it('0373 391.59: a retake and an unchecked fluff do NOT merge (the fluff would be cut by default)', () => {
    const c = FIXTURE.cases.find((x) => x.clip === '0373' && x.at === 391.59);
    expect(c).toBeDefined();
    if (!c) return;
    const { proposal } = snapCase(c);
    const fluff = proposal.items.filter((i) => i.category === 'fluff');
    expect(fluff).toHaveLength(1);
    expect(fluff[0].status).toBe('rejected');
    expect(fluff[0].text).toContain('Okay,');
  });
});

describe('B7 guards (synthetic: 50 buckets/s, −20 dB sound on a −55 dB room)', () => {
  function snapSynthetic(loud: Array<[number, number]>, words: PlanWord[], spans: Array<[number, number]>) {
    const rms = Array.from({ length: 500 }, (_, i) => (loud.some(([s, e]) => i / 50 >= s && i / 50 < e) ? -20 : -55));
    return snapEditorialCuts({
      spans: spans.map(([start, end]) => ({ start, end, category: 'retake' as const })),
      words,
      duration: 10,
      envelope: new RmsEnvelope(rms, 50),
      features: MEASURED,
      style: TIGHT,
    });
  }
  const twoRetakes: PlanWord[] = [
    { text: 'cut', start: 1.0, end: 2.0 },
    { text: 'again', start: 5.0, end: 6.0 },
    { text: 'kept.', start: 8.0, end: 9.0 },
  ];

  it('a 3 s wordless gap between two removals merges when it holds only 0.5 s of loud sound', () => {
    const snapped = snapSynthetic([[1, 2], [3.0, 3.5], [5, 6], [8, 9]], twoRetakes, [[1, 2], [5, 6]]);
    expect(snapped.items).toHaveLength(1);
  });

  it('a wordless gap holding 1.5 s of loud non-speech sound (a demo sound, laughter) is not merged — Auto Cut decides', () => {
    const snapped = snapSynthetic([[1, 2], [2.5, 4.0], [5, 6], [8, 9]], twoRetakes, [[1, 2], [5, 6]]);
    expect(snapped.items).toHaveLength(2);
    expect(snapped.items[0].sourceEnd).toBeLessThan(2.5);
    expect(snapped.items[1].sourceStart).toBeGreaterThanOrEqual(4.0);
  });

  it('a cut end the author placed well past the release (over untranscribed sound) is not pulled back', () => {
    const words: PlanWord[] = [
      { text: 'cut', start: 1.0, end: 2.0 },
      { text: 'kept.', start: 8.0, end: 9.0 },
    ];
    const snapped = snapSynthetic([[1, 2], [3, 4], [8, 9]], words, [[1, 4.5]]);
    expect(snapped.items).toHaveLength(1);
    expect(snapped.items[0].sourceEnd).toBeGreaterThanOrEqual(4.5);
  });
});
