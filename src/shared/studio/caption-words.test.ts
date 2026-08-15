import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioTimeline } from '../types/studio';
import {
  clipWords,
  deriveCaptionGroups,
  deriveCaptionSegments,
  groupCaptionWords,
  masterLane,
  untranscribedMasterClips,
  type SourceWord,
} from './caption-words';

const words = (...spec: Array<[string, number, number]>): SourceWord[] =>
  spec.map(([text, start, end]) => ({ text, start, end }));

function clip(over: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 'c1',
    kind: 'video',
    assetId: 'a1',
    timelineStart: 0,
    duration: 10,
    sourceIn: 0,
    ...over,
  };
}

function timeline(...tracks: StudioTimeline['tracks']): StudioTimeline {
  return { tracks };
}

describe('masterLane', () => {
  it('picks the BOTTOM-most video track with clips (new lanes stack on top)', () => {
    const tl = timeline(
      { id: 'v2', kind: 'video', name: 'V2', clips: [clip({ id: 'broll' })] },
      { id: 'v1', kind: 'video', name: 'V1', clips: [clip({ id: 'master' })] },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    );
    expect(masterLane(tl)?.id).toBe('v1');
  });

  it('falls back to the first audio lane with clips (voice-over projects)', () => {
    const tl = timeline(
      { id: 'v1', kind: 'video', name: 'V1', clips: [] },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [clip({ kind: 'audio' })] },
    );
    expect(masterLane(tl)?.id).toBe('a1');
  });

  it('returns null when nothing is on the timeline', () => {
    expect(masterLane(timeline({ id: 'v1', kind: 'video', name: 'V1', clips: [] }))).toBeNull();
  });
});

describe('clipWords — visible source window + re-base', () => {
  const source = words(['one', 0, 0.5], ['two', 1, 1.5], ['three', 2, 2.5], ['four', 3, 3.5]);

  it('keeps only words starting inside the window and re-bases to the timeline', () => {
    // Plays source 1..3, parked at timeline 10.
    const mapped = clipWords(clip({ sourceIn: 1, duration: 2, timelineStart: 10 }), source);
    expect(mapped).toEqual([
      { text: 'two', start: 10, end: 10.5 },
      { text: 'three', start: 11, end: 11.5 },
    ]);
  });

  it('clamps a word that runs past the out point', () => {
    // 'two' starts at 1.0, inside the 1.2s window, so it plays — clamped to
    // the out point rather than running past the clip.
    const mapped = clipWords(clip({ sourceIn: 0, duration: 1.2, timelineStart: 0 }), source);
    expect(mapped).toEqual([
      { text: 'one', start: 0, end: 0.5 },
      { text: 'two', start: 1, end: 1.2 },
    ]);

    const long = clipWords(
      clip({ sourceIn: 0, duration: 1.25, timelineStart: 0 }),
      words(['stretch', 1, 4]),
    );
    expect(long).toEqual([{ text: 'stretch', start: 1, end: 1.25 }]);
  });

  it('compresses timings by the clip speed', () => {
    const mapped = clipWords(clip({ sourceIn: 0, duration: 2, speed: 2 }), source);
    expect(mapped).toEqual([
      { text: 'one', start: 0, end: 0.25 },
      { text: 'two', start: 0.5, end: 0.75 },
      { text: 'three', start: 1, end: 1.25 },
      { text: 'four', start: 1.5, end: 1.75 },
    ]);
  });

  it('drops a word whose visible remainder is zero-length', () => {
    expect(clipWords(clip({ sourceIn: 0, duration: 1 }), words(['edge', 1, 2]))).toEqual([]);
  });
});

describe('deriveCaptionSegments — concat, gaps, untranscribed clips', () => {
  const source = new Map([
    ['a1', words(['alpha', 0, 0.4], ['beta', 0.5, 0.9], ['gamma', 5, 5.4])],
    ['a2', words(['delta', 0, 0.4])],
  ]);

  it('concatenates clips in timeline order and leaves gaps empty', () => {
    const tl = timeline({
      id: 'v1',
      kind: 'video',
      name: 'V1',
      clips: [
        clip({ id: 'c2', assetId: 'a2', timelineStart: 20, duration: 1, sourceIn: 0 }),
        clip({ id: 'c1', assetId: 'a1', timelineStart: 0, duration: 1, sourceIn: 0 }),
      ],
    });
    const segments = deriveCaptionSegments(tl, source);
    expect(segments.map((s) => s.clipId)).toEqual(['c1', 'c2']);
    expect(segments[0].words.map((w) => w.text)).toEqual(['alpha', 'beta']);
    // The gap between 1s and 20s simply has no words — not an error.
    expect(segments[1].words).toEqual([{ text: 'delta', start: 20, end: 20.4 }]);
  });

  it('a cut in the middle of the master drops the words it removed', () => {
    // Two halves of a1 with 1..5 cut out: 'gamma' survives, re-based.
    const tl = timeline({
      id: 'v1',
      kind: 'video',
      name: 'V1',
      clips: [
        clip({ id: 'left', timelineStart: 0, duration: 1, sourceIn: 0 }),
        clip({ id: 'right', timelineStart: 1, duration: 2, sourceIn: 5 }),
      ],
    });
    const flat = deriveCaptionSegments(tl, source).flatMap((s) => s.words);
    expect(flat).toEqual([
      { text: 'alpha', start: 0, end: 0.4 },
      { text: 'beta', start: 0.5, end: 0.9 },
      { text: 'gamma', start: 1, end: 1.4 },
    ]);
  });

  it('ignores untranscribed clips, image/tsx clips, and other lanes', () => {
    const tl = timeline(
      {
        id: 'v2',
        kind: 'video',
        name: 'V2',
        clips: [clip({ id: 'overlay', assetId: 'a1', timelineStart: 0, duration: 1 })],
      },
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          clip({ id: 'silent', assetId: 'nope', timelineStart: 0, duration: 1 }),
          clip({ id: 'still', kind: 'image', assetId: 'a1', timelineStart: 1, duration: 1 }),
          clip({ id: 'spoken', assetId: 'a2', timelineStart: 2, duration: 1 }),
        ],
      },
    );
    expect(deriveCaptionSegments(tl, source).map((s) => s.clipId)).toEqual(['spoken']);
    expect(untranscribedMasterClips(tl, source).map((c) => c.id)).toEqual(['silent']);
  });
});

describe('groupCaptionWords', () => {
  const seg = (...w: Array<[string, number, number]>) => [
    { clipId: 'c1', words: words(...w) },
  ];

  it('breaks at wordsPerGroup', () => {
    const groups = groupCaptionWords(
      seg(['a', 0, 0.2], ['b', 0.2, 0.4], ['c', 0.4, 0.6], ['d', 0.6, 0.8]),
      2,
    );
    expect(groups.map((g) => g.words.map((w) => w.text))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(groups[0]).toMatchObject({ start: 0, end: 0.4 });
  });

  it('breaks early on punctuation', () => {
    const groups = groupCaptionWords(seg(['hey.', 0, 0.2], ['there', 0.2, 0.4]), 4);
    expect(groups.map((g) => g.words.length)).toEqual([1, 1]);
  });

  it('breaks on a speech pause longer than 0.6s', () => {
    const groups = groupCaptionWords(seg(['a', 0, 0.2], ['b', 1.5, 1.7], ['c', 1.7, 1.9]), 4);
    expect(groups.map((g) => g.words.map((w) => w.text))).toEqual([['a'], ['b', 'c']]);
  });

  it('never groups across a clip boundary', () => {
    const groups = groupCaptionWords(
      [
        { clipId: 'c1', words: words(['a', 0, 0.2]) },
        { clipId: 'c2', words: words(['b', 0.2, 0.4]) },
      ],
      4,
    );
    expect(groups.map((g) => g.words.map((w) => w.text))).toEqual([['a'], ['b']]);
  });

  it('clamps wordsPerGroup into 1..6', () => {
    const stream = seg(['a', 0, 0.1], ['b', 0.1, 0.2], ['c', 0.2, 0.3]);
    expect(groupCaptionWords(stream, 0).map((g) => g.words.length)).toEqual([1, 1, 1]);
    expect(groupCaptionWords(stream, 99)[0].words.length).toBe(3);
  });
});

describe('deriveCaptionGroups', () => {
  it('composes derivation and grouping', () => {
    const tl = timeline({
      id: 'v1',
      kind: 'video',
      name: 'V1',
      clips: [clip({ duration: 2 })],
    });
    const source = new Map([['a1', words(['one', 0, 0.4], ['two', 0.4, 0.8])]]);
    expect(deriveCaptionGroups(tl, source, 1)).toEqual([
      { start: 0, end: 0.4, words: [{ text: 'one', start: 0, end: 0.4 }] },
      { start: 0.4, end: 0.8, words: [{ text: 'two', start: 0.4, end: 0.8 }] },
    ]);
  });

  it('is empty when nothing is transcribed', () => {
    const tl = timeline({ id: 'v1', kind: 'video', name: 'V1', clips: [clip()] });
    expect(deriveCaptionGroups(tl, new Map(), 3)).toEqual([]);
  });
});
