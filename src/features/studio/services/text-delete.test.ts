import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import { applyTextDelete, planTextDelete } from './text-delete';
import { buildTranscriptDoc, withSpokenSpans } from './transcript-doc';
import { TEST_NATURAL_STYLE, TEST_TIGHT_STYLE } from '@shared/studio/cut-style-test-fixtures';
import { QA_ENTRY_LOOKBACK_S, QA_ENTRY_WINDOW_S, QA_HARD_ENTRY_DB } from '@shared/studio/cut-qa';
import { ASSET, WORDS, makeEnvelope, makeTimeline, master, shots, wordSource } from './text-edit-fixtures';

const envelopes = () => new Map([['a1', makeEnvelope()]]);

function plan(
  timeline: StudioTimeline,
  pick: (text: string, index: number) => boolean,
  withEnvelope = true,
  style = TEST_NATURAL_STYLE,
) {
  const doc = buildTranscriptDoc(timeline, wordSource());
  return planTextDelete({
    timeline,
    tokens: doc.tokens.filter((t) => pick(t.text, t.index)),
    words: wordSource(),
    envelopes: withEnvelope ? envelopes() : new Map(),
    assets: [ASSET],
    style,
  });
}

const texts = (timeline: StudioTimeline) => buildTranscriptDoc(timeline, wordSource()).tokens.map((t) => t.text);

describe('planTextDelete', () => {
  it('lands the edges in the quiet around the words, not on their boundaries', () => {
    const result = plan(makeTimeline(), (text) => text === 'um');
    expect(result.blocked).toBeUndefined();
    expect(result.spans).toHaveLength(1);
    const [span] = result.spans;
    // After 'welcome' has decayed (1.70), at or before 'um' starts (1.95) …
    expect(span.from).toBeGreaterThan(1.7);
    expect(span.from).toBeLessThanOrEqual(1.95 + 1e-6);
    // … and past 'um' (2.20), leaving 'to' (2.45) its lead-in.
    expect(span.to).toBeGreaterThanOrEqual(2.2);
    expect(span.to).toBeLessThan(2.45);
    expect(result.unsnappedAssetIds).toEqual([]);
  });

  it('snaps with the style it is given (B2: the resolved project style)', () => {
    // A short 'um' (ends 2.00) leaves 0.45 s of quiet before 'to', so both
    // styles' lead-ins sit clear of its release and the style decides the edge.
    const words = WORDS.map((w) => (w.text === 'um' ? { ...w, end: 2.0 } : w));
    const planWith = (style: typeof TEST_NATURAL_STYLE) => {
      const timeline = makeTimeline();
      return planTextDelete({
        timeline,
        tokens: buildTranscriptDoc(timeline, wordSource(words)).tokens.filter((t) => t.text === 'um'),
        words: wordSource(words),
        envelopes: new Map([['a1', makeEnvelope(words)]]),
        assets: [ASSET],
        style,
      }).spans[0];
    };
    const natural = planWith(TEST_NATURAL_STYLE);
    const tight = planWith(TEST_TIGHT_STYLE);
    // Tight keeps a shorter lead-in before 'to' (head 0.11 vs 0.19), so its cut ends later …
    expect(tight.to).toBeGreaterThan(natural.to + 0.05);
    // … and never starts later (its tail floor is shorter: minTail 0.14 vs 0.26).
    expect(tight.from).toBeLessThanOrEqual(natural.from + 1e-6);
  });

  it('lands the cut-in past the removed word\'s release in a short gap, whatever the style (B7)', () => {
    // 'um' sounds to 2.22; 'to' at 2.45. Both styles' lead-ins (head + 0.08
    // feature compensation) start inside um's release + the QA's 60 ms entry
    // lookback, so both land at the first clean point instead of a hard entry.
    const env = makeEnvelope();
    for (const style of [TEST_NATURAL_STYLE, TEST_TIGHT_STYLE]) {
      const span = plan(makeTimeline(), (text) => text === 'um', true, style).spans[0];
      expect(span.to).toBeCloseTo(2.28, 3);
      expect(env.rmsDb(span.to - QA_ENTRY_LOOKBACK_S, QA_ENTRY_WINDOW_S) - env.floorDb()).toBeLessThan(QA_HARD_ENTRY_DB);
    }
  });

  it('removes the selected words and nothing else', () => {
    const timeline = makeTimeline();
    const result = plan(timeline, (text) => text === 'to' || text === 'the');
    const next = applyTextDelete(timeline, result.spans);
    expect(texts(next)).toEqual(['Hello', 'and', 'welcome', 'um', 'show.', 'Today', 'we', 'build', 'things.']);
    const [deletion] = buildTranscriptDoc(next, wordSource()).deletions;
    expect(deletion.text).toBe('to the');
  });

  it('cuts only the clip under the selection when another plays the same source', () => {
    const timeline = makeTimeline();
    // The whole source again, later on the master lane.
    timeline.tracks[1].clips.push({ id: 'dup', kind: 'video', assetId: 'a1', timelineStart: 8, duration: 8, sourceIn: 0 });
    const result = plan(timeline, (text, index) => text === 'um' && index < 11);
    expect(result.spans).toHaveLength(1);
    const next = applyTextDelete(timeline, result.spans);
    const dup = master(next).find((c) => c.id === 'dup')!;
    expect([dup.duration, dup.sourceIn]).toEqual([8, 0]);
    expect(texts(next).filter((t) => t === 'um')).toHaveLength(1);
  });

  it('turns non-adjacent words into separate cuts', () => {
    const result = plan(makeTimeline(), (text) => text === 'and' || text === 'we');
    expect(result.spans).toHaveLength(2);
    expect(result.spans[0].to).toBeLessThan(result.spans[1].from);
  });

  it('deletes the last take without letting its final word bleed into the join', () => {
    const timeline = makeTimeline();
    const result = plan(timeline, (_text, index) => index >= 7);
    const next = applyTextDelete(timeline, result.spans);
    expect(texts(next)).toEqual(['Hello', 'and', 'welcome', 'um', 'to', 'the', 'show.']);
    // Text goes, the source's trailing silence stays (tightening is Auto Cut's
    // job) — and it starts after 'things.' (5.55–6.10) has ended.
    const [head, tail] = master(next);
    expect(master(next)).toHaveLength(2);
    expect(head.duration).toBeGreaterThan(3.2);
    expect(tail.sourceIn).toBeGreaterThanOrEqual(6.1);
  });

  it('takes a sliver thinner than the shortest clip along with the span', () => {
    const timeline = makeTimeline();
    // The clip ends 0.02 s after the snapped cut would: no 20 ms orphan is left behind.
    timeline.tracks[1].clips[0].duration = 6.12;
    const result = plan(timeline, (_text, index) => index >= 7);
    const next = applyTextDelete(timeline, result.spans);
    expect(master(next)).toHaveLength(1);
  });

  it('maps a sped clip through its rate', () => {
    const timeline = makeTimeline();
    timeline.tracks[1].clips[0].speed = 2;
    timeline.tracks[1].clips[0].duration = 4;
    const result = plan(timeline, (text) => text === 'um');
    const [span] = result.spans;
    expect(span.from).toBeGreaterThan(1.7 / 2);
    expect(span.to).toBeLessThan(2.45 / 2);
    const next = applyTextDelete(timeline, result.spans);
    expect(texts(next)).toEqual(['Hello', 'and', 'welcome', 'to', 'the', 'show.', 'Today', 'we', 'build', 'things.']);
  });

  it('falls back to padded edges without an envelope, and says so', () => {
    const result = plan(makeTimeline(), (text) => text === 'um', false);
    expect(result.spans).toHaveLength(1);
    expect(result.unsnappedAssetIds).toEqual(['a1']);
  });

  it('is blocked on a locked master lane and with nothing selected', () => {
    const locked = makeTimeline();
    locked.tracks[1].locked = true;
    expect(plan(locked, (text) => text === 'um').blocked).toBe('locked');
    expect(plan(makeTimeline(), () => false).blocked).toBe('empty');
  });
});

describe('planTextDelete — counting what a delete really removes (B5)', () => {
  // AssemblyAI on video-14-raw: 0373 "a 15.654–15.780 · uh 15.780–15.820 · desk 15.847–16.168"
  // — the "uh" sits inside the pads of its neighbours, so "Remove fillers" can't cut it.
  const words = [
    { text: 'Hello', start: 0.5, end: 0.9 },
    { text: 'um', start: 1.2, end: 1.5 },
    { text: 'today', start: 1.9, end: 2.3 },
    { text: 'a', start: 3.0, end: 3.126 },
    { text: 'uh', start: 3.126, end: 3.166 },
    { text: 'desk', start: 3.193, end: 3.514 },
    { text: 'cleaner.', start: 3.514, end: 4.0 },
  ];
  const planFor = (pick: (text: string) => boolean) => {
    const timeline = makeTimeline();
    const doc = buildTranscriptDoc(timeline, wordSource(words));
    return planTextDelete({
      timeline,
      tokens: doc.tokens.filter((t) => pick(t.text)),
      words: wordSource(words),
      envelopes: new Map([['a1', makeEnvelope(words)]]),
      assets: [ASSET],
      style: TEST_TIGHT_STYLE,
    });
  };

  it('counts only the words its spans remove — a run too tight to cut is not "removed"', () => {
    const result = planFor((text) => text === 'um' || text === 'uh');
    expect(result.spans).toHaveLength(1);
    expect(result.skippedRuns).toBe(1);
    expect(result.removedTokens).toBe(1);
  });

  it('counts every word of a run it cuts', () => {
    const result = planFor((text) => text === 'Hello' || text === 'um' || text === 'today');
    expect(result.skippedRuns).toBe(0);
    expect(result.removedTokens).toBe(3);
  });

  it('removes nothing when every run is too tight', () => {
    const result = planFor((text) => text === 'uh');
    expect(result.spans).toHaveLength(0);
    expect(result.removedTokens).toBe(0);
  });
});

describe('planTextDelete — a word the engine gave no duration', () => {
  it('cuts the gap it was spoken in, and the words around it survive', () => {
    const words = withSpokenSpans([
      { text: 'The', start: 5.9, end: 6.2 },
      { text: 'idea', start: 6.34, end: 7.02 },
      { text: 'is', start: 7.82, end: 7.82 },
      { text: 'simple.', start: 7.98, end: 9.31 },
    ]);
    const timeline = makeTimeline();
    timeline.tracks[1].clips[0].duration = 10;
    const doc = buildTranscriptDoc(timeline, wordSource(words));
    const result = planTextDelete({
      timeline,
      tokens: doc.tokens.filter((t) => t.text === 'is'),
      words: wordSource(words),
      envelopes: new Map([['a1', makeEnvelope(words, 10)]]),
      assets: [ASSET],
      style: TEST_NATURAL_STYLE,
    });
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0].from).toBeGreaterThanOrEqual(7.02);
    expect(result.spans[0].to).toBeLessThanOrEqual(7.98);
    const next = applyTextDelete(timeline, result.spans);
    expect(buildTranscriptDoc(next, wordSource(words)).tokens.map((t) => t.text)).toEqual(['The', 'idea', 'simple.']);
  });
});

describe('applyTextDelete', () => {
  it('leaves the other lanes alone by default and pulls them along in ripple-all mode', () => {
    const timeline = makeTimeline();
    const { spans, removedSeconds } = plan(timeline, (text) => text === 'um');

    const perTrack = applyTextDelete(timeline, spans);
    expect(shots(perTrack)[0].timelineStart).toBe(5);
    expect(perTrack.markers?.[0].time).toBe(6);

    const all = applyTextDelete(timeline, spans, { rippleAllTracks: true });
    expect(shots(all)[0].timelineStart).toBeCloseTo(5 - removedSeconds, 6);
    expect(all.markers?.[0].time).toBeCloseTo(6 - removedSeconds, 6);
  });

  it('applies several spans in one call, each at the seconds it was planned in', () => {
    const timeline = makeTimeline();
    const result = plan(timeline, (text) => text === 'and' || text === 'we');
    const next = applyTextDelete(timeline, result.spans);
    expect(texts(next)).toEqual(['Hello', 'welcome', 'um', 'to', 'the', 'show.', 'Today', 'build', 'things.']);
    const total = master(next).reduce((sum, c) => sum + c.duration, 0);
    expect(total).toBeCloseTo(8 - result.removedSeconds, 6);
  });

  it('returns the same timeline when there is nothing to do', () => {
    const timeline = makeTimeline();
    expect(applyTextDelete(timeline, [])).toBe(timeline);
    const locked = makeTimeline();
    locked.tracks[1].locked = true;
    expect(applyTextDelete(locked, [{ from: 1, to: 2 }])).toBe(locked);
  });
});
