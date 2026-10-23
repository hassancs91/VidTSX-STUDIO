import { describe, expect, it } from 'vitest';
import type { StudioClip, StudioTimeline } from '../types/studio';
import { cutsBetweenKeeps, keepsTag, keepsTotal, normalizeKeeps, timelineKeepsForAsset } from './cut-keeps';

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
