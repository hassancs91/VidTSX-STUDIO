import { describe, expect, it } from 'vitest';
import { changedRegion, describeSeam, meanAbsDiff, measureSeam, SEAM_JUMP_RATIO, SEAM_MIN_DIFF, type Bitmap } from './loop-seam';

/** A grey BGRA frame; `paint` sets a box's RGB to one value (alpha untouched). */
function frame(width: number, height: number, grey = 100, paint?: { x: number; y: number; w: number; h: number; v: number }): Bitmap {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([grey, grey, grey, 255], i);
  if (paint) {
    for (let y = paint.y; y < paint.y + paint.h; y++) {
      for (let x = paint.x; x < paint.x + paint.w; x++) data.set([paint.v, paint.v, paint.v], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

describe('meanAbsDiff', () => {
  it('averages R, G and B over every pixel and ignores alpha', () => {
    const a = frame(10, 10);
    const b = frame(10, 10, 100, { x: 0, y: 0, w: 5, h: 2, v: 200 });
    // 10 of 100 pixels moved by 100 on each colour channel.
    expect(meanAbsDiff(a, b)).toBeCloseTo(10);
    const alphaOnly = frame(10, 10);
    alphaOnly.data[3] = 0;
    expect(meanAbsDiff(a, alphaOnly)).toBe(0);
  });

  it('refuses frames of different sizes', () => {
    expect(() => meanAbsDiff(frame(10, 10), frame(10, 12))).toThrow(/differ in size/);
  });
});

describe('changedRegion', () => {
  it('boxes the visible change and ignores sub-threshold noise', () => {
    const a = frame(20, 20);
    const b = frame(20, 20, 110, { x: 4, y: 6, w: 3, h: 5, v: 220 });
    expect(changedRegion(a, b)).toEqual({ x: 4, y: 6, width: 3, height: 5, share: 15 / 400 });
    expect(changedRegion(a, frame(20, 20, 110))).toBeNull();
  });
});

describe('measureSeam', () => {
  const base = frame(20, 20);
  const step = (v: number) => frame(20, 20, 100, { x: 0, y: 0, w: 20, h: 2, v });

  it('passes a wrap that is just another step', () => {
    const m = measureSeam({ beforeLast: step(130), last: step(160), first: step(190), afterFirst: step(220) });
    expect(m.wrap).toBeCloseTo(m.neighbours);
    expect(m.jump).toBe(false);
  });

  it('flags a wrap far above its neighbours', () => {
    const last = frame(20, 20, 100, { x: 0, y: 0, w: 20, h: 10, v: 250 });
    const m = measureSeam({ beforeLast: last, last, first: base, afterFirst: base });
    expect(m.neighbours).toBe(0);
    expect(m.ratio).toBe(Infinity);
    expect(m.jump).toBe(true);
    expect(m.region).toMatchObject({ x: 0, y: 0, width: 20, height: 10 });
  });

  it('does not flag a change too small to see, however still the neighbours', () => {
    const last = frame(20, 20, 100, { x: 0, y: 0, w: 1, h: 1, v: 101 });
    const m = measureSeam({ beforeLast: last, last, first: base, afterFirst: base });
    expect(m.wrap).toBeLessThan(SEAM_MIN_DIFF);
    expect(m.jump).toBe(false);
  });

  it('calls a still loop seamless', () => {
    const m = measureSeam({ beforeLast: base, last: base, first: base, afterFirst: base });
    expect(m).toMatchObject({ wrap: 0, ratio: 1, jump: false, region: null });
  });

  it('flags a wrap at the jump ratio, not below it', () => {
    const grey = (g: number) => frame(4, 4, g);
    // Neighbours step by 10; the wrap by `wrap`.
    const seam = (wrap: number) => measureSeam({ beforeLast: grey(50), last: grey(60), first: grey(60 + wrap), afterFirst: grey(70 + wrap) });
    expect(seam(Math.floor(10 * SEAM_JUMP_RATIO * 0.9)).jump).toBe(false);
    expect(seam(Math.ceil(10 * SEAM_JUMP_RATIO * 1.1)).jump).toBe(true);
  });
});

describe('describeSeam', () => {
  it('gives the numbers, the verdict and where to look', () => {
    const last = frame(20, 20, 100, { x: 2, y: 3, w: 4, h: 5, v: 250 });
    const base = frame(20, 20);
    const said = describeSeam(measureSeam({ beforeLast: last, last, first: base, afterFirst: base }), 239);
    expect(said).toContain('wrap 239 → 0');
    expect(said).toContain('JUMP');
    expect(said).toContain('x 2-5, y 3-7');
    const ok = describeSeam(measureSeam({ beforeLast: base, last: base, first: base, afterFirst: base }), 239);
    expect(ok).toContain('OK');
  });
});
