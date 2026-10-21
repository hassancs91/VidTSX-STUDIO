import { describe, expect, it } from 'vitest';
import { SWEEP_MAX_FRAMES, SWEEP_PAGE_TILES, sweepFrames, sweepSource } from './number-sweep';
import { FRAME_TEXT_ATTR } from './frame-text';

const config = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
const build = `export const compositionConfig = { id: 'CoinPiles', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
export default function CoinPiles() { return null; }`;

describe('sweepFrames', () => {
  it('reads every frame of a short piece', () => {
    const { frames, step } = sweepFrames(240, SWEEP_MAX_FRAMES);
    expect(step).toBe(1);
    expect(frames).toHaveLength(240);
    expect(frames[239]).toBe(239);
  });

  it('reads every Nth frame of a long one, and always the last', () => {
    const { frames, step } = sweepFrames(900, SWEEP_MAX_FRAMES);
    expect(step).toBe(3);
    expect(frames.slice(0, 3)).toEqual([0, 3, 6]);
    expect(frames[frames.length - 1]).toBe(899);
  });
});

describe('sweepSource', () => {
  it('pages the frames, a tile per frame tagged for the frame-text probe, the build mounted as a component', () => {
    const { frames } = sweepFrames(240, SWEEP_MAX_FRAMES);
    const sweep = sweepSource(build, config, frames);
    expect(sweep.pages).toBe(Math.ceil(240 / SWEEP_PAGE_TILES));
    expect(sweep.config.durationInFrames).toBeGreaterThanOrEqual(sweep.pages);
    expect(sweep.config.width % 2).toBe(0);
    expect(sweep.code).toContain(`'${FRAME_TEXT_ATTR}': frame`);
    expect(sweep.code).toContain('h(CoinPiles, props)');
    expect(sweep.code).toContain('const __vidtsxPieceConfig =');
    expect(sweep.code).not.toMatch(/export default function CoinPiles/);
    expect(sweep.code.match(/export const compositionConfig/g)).toHaveLength(1);
  });
});
