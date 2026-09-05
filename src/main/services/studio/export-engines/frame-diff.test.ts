import { describe, expect, it, vi } from 'vitest';

vi.mock('../ffmpeg-bin', () => ({ runFfmpeg: async () => undefined }));

import { diffRgb24, downscaleRgb24, sampleFrames, tileRgb24 } from './frame-diff';

describe('frame diff (the T1 instrument)', () => {
  it('reports zero for identical frames', () => {
    const a = Buffer.alloc(4 * 3, 100);
    const row = diffRgb24(a, Buffer.from(a), 4);
    expect(row.meanAbsDiff).toEqual([0, 0, 0]);
    expect(row.pctOver8).toBe(0);
    expect(row.pctOver24).toBe(0);
    expect(row.maxDelta).toBe(0);
    expect(row.meanA).toEqual([100, 100, 100]);
  });

  it('counts pixels by their max-channel delta, over 8 and over 24', () => {
    // 4 pixels: deltas 0, 5 (under both), 10 (over 8), 30 (over both) on the green channel.
    const a = Buffer.alloc(12, 50);
    const b = Buffer.from(a);
    b[1 * 3 + 1] += 5;
    b[2 * 3 + 1] += 10;
    b[3 * 3 + 1] += 30;
    const diff = Buffer.alloc(12);
    const row = diffRgb24(a, b, 4, diff);
    expect(row.pctOver8).toBe(50);
    expect(row.pctOver24).toBe(25);
    expect(row.maxDelta).toBe(30);
    expect(row.meanAbsDiff).toEqual([0, 11.25, 0]);
    // Amplified ×8, clamped.
    expect(diff[1 * 3 + 1]).toBe(40);
    expect(diff[3 * 3 + 1]).toBe(240);
  });

  it('refuses short buffers', () => {
    expect(() => diffRgb24(Buffer.alloc(3), Buffer.alloc(6), 2)).toThrow(/too short/);
  });
});

describe('sampleFrames', () => {
  it("reproduces T1's frame set for the 900-frame single-cut project", () => {
    expect(sampleFrames(900, [450])).toEqual([1, 300, 449, 450, 451, 600, 899]);
  });

  it('samples first, thirds and last with no cuts', () => {
    expect(sampleFrames(900, [])).toEqual([1, 300, 600, 899]);
  });

  it('ignores cuts at 0 or past the end and caps the count', () => {
    expect(sampleFrames(90, [0, 89, 200])).toEqual([1, 30, 60, 89]);
    const many = Array.from({ length: 50 }, (_, i) => (i + 1) * 100);
    const frames = sampleFrames(6000, many);
    expect(frames.length).toBeLessThanOrEqual(24);
    expect(frames[0]).toBe(1);
    expect(frames[frames.length - 1]).toBe(5999);
  });

  it('handles a one-frame export', () => {
    expect(sampleFrames(1, [])).toEqual([0]);
  });
});

describe('stills without an image library', () => {
  it('downscales by an integer factor with nearest-neighbour sampling', () => {
    // 4×2 frame, every pixel = its x coordinate.
    const src = Buffer.alloc(4 * 2 * 3);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) src.fill(x * 10, (y * 4 + x) * 3, (y * 4 + x) * 3 + 3);
    const out = downscaleRgb24(src, 4, 2, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect([...out.data]).toEqual([0, 0, 0, 20, 20, 20]);
  });

  it('tiles frames side by side with a black gutter', () => {
    const a = { data: Buffer.alloc(3, 1), width: 1, height: 1 };
    const b = { data: Buffer.alloc(3, 2), width: 1, height: 1 };
    const out = tileRgb24([a, b], 1);
    expect([out.width, out.height]).toEqual([3, 1]);
    expect([...out.data]).toEqual([1, 1, 1, 0, 0, 0, 2, 2, 2]);
  });
});
