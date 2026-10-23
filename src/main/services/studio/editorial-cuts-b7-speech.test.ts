// B7 step 7 (b) — the six editorial cuts of the step-6 live run that started
// unchecked by QA (docs/studio/end-to-end/B7/HANDOFF.md, Done › Step 6 "Where
// the overlap went"): the model authored their ends in continuous speech —
// inside a word, in a 43 ms gap, or (0376) before a word whose onset starts
// 0.3 s before its token. Fixtures: the real 20 ms buckets and words around
// each end, the AUTHORED spans from the run's tool calls. Each cut must land in
// the quiet gap Hasan cut in, start checked, and leave no hard entry.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SttModelFeatures } from '@shared/presets/stt-models';
import type { CutPlanStyle } from '@shared/types/studio-cut-plan';
import { RmsEnvelope, planCuts, type PlanSpan, type PlanWord } from '../../../shared/studio/cut-planner';
import { findHardEntries } from '../../../shared/studio/cut-qa';
import { snapCutSpans } from '../../../shared/studio/cut-snap';
import { buildEditorialProposal, snapEditorialCuts, type EditorialCategory } from './editorial-cuts';

interface FixtureClip {
  assetId: string;
  bucketsPerSecond: number;
  buckets: number;
  floorDb: number;
  hasZcr: boolean;
}

interface SpeechCase {
  clip: string;
  /** The produced item end the card's QA flagged (source seconds). */
  at: number;
  /** The inter-word gap the end must land in. */
  expect: [number, number];
  /** Hasan's own cut-in there (cuts.json), when he made one. */
  hand: number | null;
  firstBucket: number;
  rmsDb: number[];
  zcr?: number[];
  words: PlanWord[];
  authored: Array<{ start: number; end: number; category: EditorialCategory; note?: string }>;
}

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../shared/studio/cut-snap-b7.fixture.json', import.meta.url)), 'utf-8'),
) as { clips: Record<string, FixtureClip>; speechCases: SpeechCase[] };

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

const NEAR_S = 1.0;

function envelopeFor(c: SpeechCase): RmsEnvelope {
  const clip = FIXTURE.clips[c.clip];
  const rms = new Array<number>(clip.buckets).fill(clip.floorDb);
  const zcr = new Array<number>(clip.buckets).fill(0);
  c.rmsDb.forEach((v, i) => (rms[c.firstBucket + i] = v));
  c.zcr?.forEach((v, i) => (zcr[c.firstBucket + i] = v));
  return new RmsEnvelope(rms, clip.bucketsPerSecond, clip.hasZcr ? zcr : undefined);
}

/** The authored span whose end the case is about (the last one ending by `at`). */
function authoredSpan(c: SpeechCase) {
  return c.authored.filter((s) => s.end <= c.at + 0.5).sort((a, b) => b.end - a.end)[0];
}

function snapCase(c: SpeechCase) {
  const envelope = envelopeFor(c);
  const duration = envelope.duration();
  const snapped = snapEditorialCuts({ spans: c.authored, words: c.words, duration, envelope, features: MEASURED, style: TIGHT });
  const proposal = buildEditorialProposal({
    assetId: FIXTURE.clips[c.clip].assetId,
    items: snapped.items,
    removedSeconds: snapped.removedSeconds,
    sourceDuration: duration,
    ...(snapped.qa ? { qa: snapped.qa } : {}),
  });
  const span = authoredSpan(c);
  const item = proposal.items.find(
    (i) => (i.sourceStart ?? Infinity) <= span.start + 1e-6 && (i.sourceEnd ?? -Infinity) > span.start,
  );
  if (!item || item.sourceEnd === undefined) throw new Error(`no item holds the authored span ${span.start}–${span.end}`);
  return { envelope, duration, proposal, item, end: item.sourceEnd };
}

/** The card applied as by default, then Auto Cut over what is left on the timeline. */
function producedSegments(c: SpeechCase): PlanSpan[] {
  const { envelope, duration, proposal } = snapCase(c);
  const cuts = proposal.items
    .flatMap((i) => (i.status === 'accepted' && i.sourceStart !== undefined && i.sourceEnd !== undefined ? [{ start: i.sourceStart, end: i.sourceEnd }] : []))
    .sort((a, b) => a.start - b.start);
  const keeps: PlanSpan[] = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start - cursor >= 0.05) keeps.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  }
  if (duration - cursor >= 0.05) keeps.push({ start: cursor, end: duration });
  return planCuts({
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
  }).segments;
}

const label = (c: SpeechCase) => `${c.clip} ${authoredSpan(c).start}–${authoredSpan(c).end}`;

describe('B7 step 7 — an authored end in continuous speech lands in the nearest quiet gap (step-6 live cases)', () => {
  it('has the six cases', () => {
    expect(FIXTURE.speechCases.map((c) => `${c.clip}@${c.at}`)).toEqual([
      '0371@33.633',
      '0371@182.37',
      '0373@30',
      '0375@18.3',
      '0375@195.1',
      '0376@119.374',
    ]);
  });

  for (const c of FIXTURE.speechCases) {
    it(`${label(c)}: the cut ends inside the gap ${c.expect[0]}–${c.expect[1]}${c.hand !== null ? `, within 0.1 s of Hasan's ${c.hand}` : ''}`, () => {
      const { end } = snapCase(c);
      expect(end).toBeGreaterThan(c.expect[0]);
      expect(end).toBeLessThan(c.expect[1]);
      if (c.hand !== null) expect(Math.abs(end - c.hand)).toBeLessThanOrEqual(0.1);
    });

    it(`${label(c)}: the card's QA sees no hard entry where speech resumes, so the cut starts checked`, () => {
      const { proposal, item, end } = snapCase(c);
      const hard = (proposal.qa?.items ?? []).filter((q) => q.kind === 'hard-entry' && Math.abs(q.sourceTime - end) <= 0.02);
      expect(hard).toEqual([]);
      expect(item.status).toBe('accepted');
      expect(item.qaFlag).toBeUndefined();
    });

    it(`${label(c)}: the produced cut has no hard entry near the join`, () => {
      const { envelope, end } = snapCase(c);
      const hard = findHardEntries(producedSegments(c), envelope).items.filter((i) => Math.abs(i.sourceTime - end) < NEAR_S);
      expect(hard).toEqual([]);
    });
  }

  it('a Transcript delete (no seek) keeps its end where the user put it — 0373 30.0 stays mid-word', () => {
    const c = FIXTURE.speechCases.find((k) => k.clip === '0373')!;
    const envelope = envelopeFor(c);
    const snapped = snapCutSpans({ spans: c.authored, words: c.words, duration: envelope.duration(), envelope, features: MEASURED, style: TIGHT });
    expect(snapped.items.find((i) => i.sourceStart <= 25.1 + 1e-6 && i.sourceEnd > 25.1)?.sourceEnd).toBe(30);
  });
});

// B7 step 9 (b) — pass 2's 0375 retake (HANDOFF Done › Step 8 "Where the overlap went" 2): the model authored
// 190.9–195.0, inside "other" (0.059 s in, 0.181 s kept), so decision 10 looks before "other" — where "to sell uh
// other" runs on with no quiet gap. Decision 11: the end may go to the other side ("take," → "before") only
// through words the item's own text names; without text, at most the straddled word + one more and ≤ 0.4 s.
describe('B7 step 9 (b) — the other side, only through words the item names (pass 2 0375 190.9–195.0)', () => {
  const c = FIXTURE.speechCases.find((k) => k.clip === '0375' && k.at === 195.1)!;
  const PASS2_NOTE =
    "First 'before starting selling the app, before starting to sell uh other take,' superseded by 'before you sell the application.' Edges estimated; needs an ear.";
  const GAP: [number, number] = [195.599, 195.839];
  const HAND = 195.799;
  const withSpan = (start: number, end: number, note: string | undefined, words: PlanWord[] = c.words) =>
    snapCase({
      ...c,
      words,
      authored: c.authored.map((s) =>
        Math.abs(s.end - 195.1) < 0.01 ? { ...s, start, end, ...(note !== undefined ? { note } : {}) } : s,
      ),
    });
  const hardAt = (r: ReturnType<typeof snapCase>) =>
    (r.proposal.qa?.items ?? []).filter((q) => q.kind === 'hard-entry' && Math.abs(q.sourceTime - r.end) <= 0.02);

  it('with its real note (it quotes "…uh other take,") the end lands after "take," near Hasan\'s 195.799, checked, the row says so', () => {
    const r = withSpan(190.9, 195.0, PASS2_NOTE);
    expect(r.end).toBeGreaterThan(GAP[0]);
    expect(r.end).toBeLessThan(GAP[1]);
    expect(Math.abs(r.end - HAND)).toBeLessThanOrEqual(0.1);
    expect(hardAt(r)).toEqual([]);
    expect(r.item.status).toBe('accepted');
    expect(r.item.qaFlag).toBeUndefined();
    expect(r.item.note).toContain('extended past "other take," to land on quiet');
  });

  it('with a note that does not name "other take," the end stays at 195.0 and the cut starts unchecked by QA', () => {
    const r = withSpan(190.9, 195.0, 'Retake of the selling line.');
    expect(r.end).toBe(195);
    expect(r.item.status).toBe('rejected');
    expect(r.item.qaFlag?.overDb).toBeGreaterThan(15);
    expect(r.item.note ?? '').not.toContain('extended past');
  });

  it("step 6's 190.8–195.1 (mostly inside \"other\") still lands there by decision 10's own side — no fallback note", () => {
    const r = withSpan(190.8, 195.1, PASS2_NOTE);
    expect(r.end).toBeGreaterThan(GAP[0]);
    expect(r.end).toBeLessThan(GAP[1]);
    expect(Math.abs(r.end - HAND)).toBeLessThanOrEqual(0.1);
    expect(r.item.status).toBe('accepted');
    expect(r.item.note ?? '').not.toContain('extended past');
  });

  it('without a note the fallback is capped: "other take," holds 0.599 s past 195.0 (> 0.4 s) → stays, unchecked', () => {
    const r = withSpan(190.9, 195.0, undefined);
    expect(r.end).toBe(195);
    expect(r.item.status).toBe('rejected');
  });

  it('without a note, two words and ≤ 0.4 s past the end ("take," token cut to 195.3: 0.30 s) → lands on quiet, named on the row', () => {
    const words = c.words.map((w) => (w.start === 195.181 ? { ...w, end: 195.3 } : w));
    const r = withSpan(190.9, 195.0, undefined, words);
    expect(r.end).toBeGreaterThan(195.3);
    expect(r.end).toBeLessThan(GAP[1]);
    expect(hardAt(r)).toEqual([]);
    expect(r.item.status).toBe('accepted');
    expect(r.item.note).toContain('extended past "other take," to land on quiet');
  });
});
