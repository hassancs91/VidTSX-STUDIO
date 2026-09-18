import { describe, it, expect } from 'vitest';
import { deriveCaptionSegments } from '@shared/studio';
import type { StudioTimeline } from '@shared/types/studio';
import { buildTranscriptDoc, tokenIndexAt, withSpokenSpans } from './transcript-doc';
import { WORDS, makeTimeline, wordSource } from './text-edit-fixtures';

const texts = (timeline: StudioTimeline) => buildTranscriptDoc(timeline, wordSource()).tokens.map((t) => t.text);

/** c1 plays 0 → 1.85 of the source, c2 picks up at 2.3: 'um' is cut out at the join. */
function withUmCut(): StudioTimeline {
  const timeline = makeTimeline();
  timeline.tracks[1].clips = [
    { id: 'c1', kind: 'video', assetId: 'a1', timelineStart: 0, duration: 1.85, sourceIn: 0 },
    { id: 'c2', kind: 'video', assetId: 'a1', timelineStart: 1.85, duration: 5.7, sourceIn: 2.3 },
  ];
  return timeline;
}

describe('buildTranscriptDoc — tokens', () => {
  it('plays exactly the words the captions derive, at the same timeline seconds', () => {
    const timeline = withUmCut();
    timeline.tracks[1].clips[1].speed = 2; // sped pieces map through the same maths
    timeline.tracks[1].clips[1].duration = 2.85;
    const doc = buildTranscriptDoc(timeline, wordSource());
    const captions = deriveCaptionSegments(timeline, wordSource()).flatMap((s) => s.words);
    expect(doc.tokens.map((t) => [t.text, t.start, t.end])).toEqual(captions.map((c) => [c.text, c.start, c.end]));
  });

  it('keeps the source times and marks fillers', () => {
    const doc = buildTranscriptDoc(makeTimeline(), wordSource());
    expect(doc.tokens).toHaveLength(WORDS.length);
    const um = doc.tokens[3];
    expect([um.text, um.sourceStart, um.sourceEnd, um.filler, um.clipId]).toEqual(['um', 1.95, 2.2, true, 'c1']);
    expect(doc.fillerCount).toBe(1);
    expect(doc.tokens.map((t) => t.index)).toEqual(WORDS.map((_, i) => i));
  });

  it('is empty without a master lane or without words', () => {
    expect(buildTranscriptDoc({ tracks: [] }, wordSource()).tokens).toEqual([]);
    expect(buildTranscriptDoc(makeTimeline(), new Map()).tokens).toEqual([]);
  });
});

describe('buildTranscriptDoc — deletions', () => {
  it('reads the text cut out at a join of one source', () => {
    const doc = buildTranscriptDoc(withUmCut(), wordSource());
    expect(texts(withUmCut())).not.toContain('um');
    expect(doc.deletions).toHaveLength(1);
    const [deletion] = doc.deletions;
    expect([deletion.text, deletion.wordCount, deletion.beforeClipId, deletion.afterClipId]).toEqual(['um', 1, 'c1', 'c2']);
    expect(deletion.at).toBe(1.85);
    expect(deletion.seconds).toBeCloseTo(0.45, 3);
  });

  it('reads a restore in timeline seconds on a sped join', () => {
    const timeline = withUmCut();
    for (const clip of timeline.tracks[1].clips) clip.speed = 2;
    timeline.tracks[1].clips[0].duration = 0.925; // 1.85 s of source at 2×
    timeline.tracks[1].clips[1].timelineStart = 0.925;
    const [deletion] = buildTranscriptDoc(timeline, wordSource()).deletions;
    expect(deletion.seconds).toBeCloseTo(0.225, 3);
  });

  it('ignores a tightened pause — a gap with no words in it', () => {
    const timeline = makeTimeline();
    timeline.tracks[1].clips = [
      { id: 'c1', kind: 'video', assetId: 'a1', timelineStart: 0, duration: 3.4, sourceIn: 0 },
      { id: 'c2', kind: 'video', assetId: 'a1', timelineStart: 3.4, duration: 3.7, sourceIn: 4.3 },
    ];
    expect(buildTranscriptDoc(timeline, wordSource()).deletions).toEqual([]);
  });

  it('only reads a join: not across a timeline gap, another source, or a speed change', () => {
    const apart = withUmCut();
    apart.tracks[1].clips[1].timelineStart = 4;
    expect(buildTranscriptDoc(apart, wordSource()).deletions).toEqual([]);

    const otherSource = withUmCut();
    otherSource.tracks[1].clips[1].assetId = 'a2';
    expect(buildTranscriptDoc(otherSource, wordSource()).deletions).toEqual([]);

    const otherSpeed = withUmCut();
    otherSpeed.tracks[1].clips[1].speed = 2;
    expect(buildTranscriptDoc(otherSpeed, wordSource()).deletions).toEqual([]);
  });
});

describe('buildTranscriptDoc — paragraphs', () => {
  it('breaks at the takes of the original transcript', () => {
    const doc = buildTranscriptDoc(makeTimeline(), wordSource());
    const paragraphs = doc.paragraphs.map((p) => p.items.map((i) => (i.kind === 'word' ? i.token.text : '¶')));
    expect(paragraphs).toEqual([
      ['Hello', 'and', 'welcome', 'um', 'to', 'the', 'show.'],
      ['Today', 'we', 'build', 'things.'],
    ]);
    expect(doc.paragraphs[1].start).toBe(4.5);
  });

  it('does not reflow around a deletion, and puts the pill before the word after the join', () => {
    const doc = buildTranscriptDoc(withUmCut(), wordSource());
    const paragraphs = doc.paragraphs.map((p) => p.items.map((i) => (i.kind === 'word' ? i.token.text : '¶')));
    expect(paragraphs).toEqual([
      ['Hello', 'and', 'welcome', '¶', 'to', 'the', 'show.'],
      ['Today', 'we', 'build', 'things.'],
    ]);
  });

  it('ends an endless take at a sentence end', () => {
    const words = Array.from({ length: 200 }, (_, i) => ({
      text: i % 10 === 9 ? `w${i}.` : `w${i}`,
      start: i * 0.3,
      end: i * 0.3 + 0.25,
    }));
    const timeline = makeTimeline();
    timeline.tracks[1].clips[0].duration = 60;
    const doc = buildTranscriptDoc(timeline, wordSource(words));
    expect(doc.paragraphs.length).toBeGreaterThan(1);
    for (const paragraph of doc.paragraphs.slice(0, -1)) {
      const last = paragraph.items[paragraph.items.length - 1];
      expect(last.kind === 'word' && last.token.text.endsWith('.')).toBe(true);
    }
  });
});

describe('tokenIndexAt', () => {
  it('finds the word playing, holds the last one through a pause, and is -1 before the first', () => {
    const { tokens } = buildTranscriptDoc(makeTimeline(), wordSource());
    expect(tokenIndexAt(tokens, 0.2)).toBe(-1);
    expect(tokenIndexAt(tokens, 0.5)).toBe(0);
    expect(tokenIndexAt(tokens, 1.3)).toBe(2);
    expect(tokenIndexAt(tokens, 3.9)).toBe(6);
    expect(tokenIndexAt(tokens, 99)).toBe(tokens.length - 1);
  });
});

describe('withSpokenSpans', () => {
  // whisper.cpp, verbatim from a real transcript: "is" has no duration and is
  // stamped where "simple." is about to begin.
  const whisper = [
    { text: 'idea', start: 6.34, end: 7.02 },
    { text: 'is', start: 7.82, end: 7.82 },
    { text: 'simple.', start: 7.98, end: 9.31 },
  ];

  it('gives a durationless word the gap before its stamp', () => {
    expect(withSpokenSpans(whisper)).toEqual([
      { text: 'idea', start: 6.34, end: 7.02 },
      { text: 'is', start: 7.02, end: 7.82 },
      { text: 'simple.', start: 7.98, end: 9.31 },
    ]);
  });

  it('treats a 20 ms stamp the same way — nobody says a word that fast', () => {
    const nearZero = [
      { text: 'split', start: 16.8, end: 17.11 },
      { text: 'the', start: 18.05, end: 18.07 },
      { text: 'speech', start: 18.07, end: 19.02 },
    ];
    expect(withSpokenSpans(nearZero)[1]).toEqual({ text: 'the', start: 17.11, end: 18.07 });
  });

  it('claims at most a second of silence, and leaves timed words as they are', () => {
    const afterPause = [
      { text: 'Right.', start: 1, end: 1.4 },
      { text: 'so', start: 9, end: 9 },
    ];
    expect(withSpokenSpans(afterPause)[1]).toEqual({ text: 'so', start: 8, end: 9 });
    expect(withSpokenSpans(afterPause)[0]).toBe(afterPause[0]);
  });

  it('keeps such a word in the document — text with words missing cannot be edited', () => {
    const timeline = makeTimeline();
    timeline.tracks[1].clips[0].duration = 10; // past the end of 'simple.', so nothing is clamped
    expect(buildTranscriptDoc(timeline, wordSource(whisper)).tokens.map((t) => t.text)).toEqual(['idea', 'is', 'simple.']);
    const doc = buildTranscriptDoc(timeline, wordSource(withSpokenSpans(whisper)));
    expect(doc.tokens.map((t) => [t.text, t.start, t.end])).toEqual([
      ['idea', 6.34, 7.02],
      ['is', 7.02, 7.82],
      ['simple.', 7.98, 9.31],
    ]);
  });
});
