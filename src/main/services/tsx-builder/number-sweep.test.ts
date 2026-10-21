import { describe, expect, it } from 'vitest';
import { SWEEP_MAX_FRAMES, SWEEP_PAGE_TILES, sweepFrames, sweepSource, toPiece } from './number-sweep';
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

describe('toPiece', () => {
  it('scales text and shape boxes from tile pixels back to the piece, and drops untagged groups', () => {
    const groups = [
      { frame: 7, items: [{ t: '12', x: 10, y: 20, w: 5, h: 10, o: 1 }], more: 0, shapes: [{ k: 'rect', x: 1, y: 2, w: 3, h: 0, o: 1 }], moreShapes: 2 },
      { frame: null, items: [], more: 0 },
      { frame: 8, items: [], more: 0 },
    ];
    expect(toPiece(groups, 0.25)).toEqual([
      { frame: 7, items: [{ t: '12', x: 40, y: 80, w: 20, h: 40, o: 1 }], shapes: [{ k: 'rect', x: 4, y: 8, w: 12, h: 0, o: 1 }], moreShapes: 2 },
      { frame: 8, items: [], shapes: [], moreShapes: 0 },
    ]);
  });
});
