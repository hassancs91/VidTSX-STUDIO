import { describe, expect, it } from 'vitest';
import { pickStillFrames } from './shot-stills';

describe('pickStillFrames', () => {
  it('spreads across the 15-85% window, sorted and deduped', () => {
    expect(pickStillFrames(240, 3)).toEqual([36, 120, 203]);
  });

  it('single still lands mid-shot', () => {
    expect(pickStillFrames(240, 1)).toEqual([120]);
  });

  it('short shots never repeat or overflow frames', () => {
    const frames = pickStillFrames(2, 3);
    expect(frames).toEqual([...new Set(frames)]);
    expect(Math.max(...frames)).toBeLessThanOrEqual(1);
    expect(pickStillFrames(0, 3)).toEqual([0]);
  });
});
