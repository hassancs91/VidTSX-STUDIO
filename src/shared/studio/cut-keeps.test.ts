import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioTimeline } from '../types/studio';
import {
  cutsBetweenKeeps,
  keepsTag,
  keepsTotal,
  keepsWithWords,
  normalizeKeeps,
  sourceKeepsAfter,
  timelineKeepsForAsset,
} from './cut-keeps';

describe('keepsWithWords (B7 step 7)', () => {
  it("drops the keeps that hold no word — the step-6 run's clip heads and 0373's tail", () => {
    const words = [
      { start: 7.95, end: 8.2 },
      { start: 8.3, end: 8.6 },
      { start: 19.0, end: 19.4 },
    ];
    expect(
      keepsWithWords(
        [
          { start: 0, end: 3.62 },
          { start: 7.928, end: 20 },
        ],
        words,
      ),
    ).toEqual([{ start: 7.928, end: 20 }]);
    expect(keepsWithWords([{ start: 394.899, end: 396.246 }], [{ start: 393.36, end: 394.6 }])).toEqual([]);
  });

  it('a word straddling a keep edge belongs to the keep holding its midpoint', () => {
    const words = [{ start: 3.5, end: 3.8 }];
    const keeps = [
      { start: 0, end: 3.62 },
      { start: 3.62, end: 5 },
    ];
    expect(keepsWithWords(keeps, words)).toEqual([{ start: 3.62, end: 5 }]);
  });
});

function clip(id: string, kind: StudioClip['kind'], assetId: string, sourceIn: number, duration: number, speed?: number): StudioClip {
  return { id, kind, assetId, start: 0, duration, sourceIn, ...(speed ? { speed } : {}) } as unknown as StudioClip;
}

describe('timelineKeepsForAsset (B7)', () => {
  it("merges the asset's video and audio clips into sorted source ranges; other assets and kinds are ignored", () => {
    const timeline: StudioTimeline = {
      tracks: [
        {
          id: 'v1',
          kind: 'video',
          name: 'V1',
          // Two halves of a split clip (abut in source) + a later piece after an applied cut.
          clips: [clip('c3', 'video', 'a1', 30, 10), clip('c1', 'video', 'a1', 0, 6), clip('c2', 'video', 'a1', 6.02, 4)],
        },
        {
          id: 'a1t',
          kind: 'audio',
          name: 'A1',
          // The linked audio duplicates c1; a2 and an sfx clip of a1's id do not count.
          clips: [clip('l1', 'audio', 'a1', 0, 6), clip('x', 'audio', 'a2', 12, 5), clip('s', 'sfx', 'a1', 15, 2)],
        },
        { id: 'v2', kind: 'video', name: 'V2', clips: [clip('f', 'video', 'a1', 50, 2, 2)] },
      ],
    };
    expect(timelineKeepsForAsset(timeline, 'a1')).toEqual([
      { start: 0, end: 10.02 },
      { start: 30, end: 40 },
      { start: 50, end: 54 }, // speed 2 plays twice the source
    ]);
    expect(timelineKeepsForAsset(timeline, 'nope')).toEqual([]);
  });
});

describe('normalizeKeeps (B7)', () => {
  it('is undefined for the whole source: none, none on the timeline, or one keep covering it', () => {
    expect(normalizeKeeps(undefined, 20)).toBeUndefined();
    expect(normalizeKeeps([], 20)).toBeUndefined();
    expect(normalizeKeeps([{ start: 0.01, end: 19.97 }], 20)).toBeUndefined();
    expect(normalizeKeeps([{ start: 25, end: 30 }], 20)).toBeUndefined();
  });

  it('clamps to the source and keeps a trimmed or cut timeline', () => {
    expect(normalizeKeeps([{ start: -1, end: 6 }, { start: 10, end: 25 }], 20)).toEqual([
      { start: 0, end: 6 },
      { start: 10, end: 20 },
    ]);
    expect(normalizeKeeps([{ start: 2, end: 20 }], 20)).toEqual([{ start: 2, end: 20 }]);
  });
});

describe('cutsBetweenKeeps / keepsTotal / keepsTag (B7)', () => {
  const keeps = [
    { start: 1, end: 6 },
    { start: 10, end: 18 },
  ];

  it('the complement inside the source is what applied cuts removed', () => {
    expect(cutsBetweenKeeps(keeps, 20)).toEqual([
      { start: 0, end: 1 },
      { start: 6, end: 10 },
      { start: 18, end: 20 },
    ]);
    expect(keepsTotal(keeps)).toBe(13);
  });

  it('tags differ for different keeps and repeat for the same', () => {
    expect(keepsTag(keeps)).toBe(keepsTag([...keeps]));
    expect(keepsTag(keeps)).not.toBe(keepsTag([{ start: 1, end: 6 }]));
    expect(keepsTag(keeps)).toMatch(/^k[0-9a-z]+$/);
  });
});

describe('sourceKeepsAfter (B7 step 4b — what the renderer reports after an apply)', () => {
  const track = (clips: StudioClip[]): StudioTimeline => ({ tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }] });

  it("every asset with a media clip before or after the apply, with its keeps AFTER it ([] = none left)", () => {
    const before = track([clip('c1', 'video', 'a1', 0, 5), clip('c2', 'video', 'a2', 0, 4)]);
    // A cut removed a1's 1.2–2.9 s and the whole of a2; an insert placed a3.
    const after = track([clip('c1', 'video', 'a1', 0, 1.2), clip('c1b', 'video', 'a1', 2.9, 2.1), clip('c3', 'video', 'a3', 1, 2)]);
    expect(sourceKeepsAfter(before, after)).toEqual({
      a1: [
        { start: 0, end: 1.2 },
        { start: 2.9, end: 5 },
      ],
      a2: [],
      a3: [{ start: 1, end: 3 }],
    });
  });

  it('non-media clips name no asset', () => {
    const before = track([clip('s', 'sfx', 'a9', 0, 2)]);
    expect(sourceKeepsAfter(before, before)).toEqual({});
  });
});
