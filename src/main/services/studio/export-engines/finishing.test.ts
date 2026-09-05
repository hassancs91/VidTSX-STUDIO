import { describe, expect, it, vi } from 'vitest';

vi.mock('../ffmpeg-bin', () => ({
  getFfmpegBinary: async () => 'ffmpeg',
  runFfmpeg: async () => undefined,
}));

import { colorMismatch, colorTagArgs } from './finishing';
import { EXPORT_COLOR } from './types';

const good = { codec: 'h264', pixFmt: 'yuv420p', range: 'tv', matrix: 'bt709', primaries: 'bt709', transfer: 'bt709' };

describe('finishing stage colour policy (D7)', () => {
  it('accepts yuv420p tv bt709 and nothing else', () => {
    expect(colorMismatch(good, EXPORT_COLOR)).toBeNull();
    // Remotion's default tags — what every export carried before the seam.
    expect(colorMismatch({ ...good, pixFmt: 'yuvj420p', range: 'pc', matrix: 'bt470bg' }, EXPORT_COLOR)).toMatch(/pixel format is yuvj420p/);
    expect(colorMismatch({ ...good, range: 'pc' }, EXPORT_COLOR)).toMatch(/colour range is pc/);
    expect(colorMismatch({ ...good, matrix: undefined }, EXPORT_COLOR)).toMatch(/matrix is untagged/);
    expect(colorMismatch({ ...good, transfer: 'smpte170m' }, EXPORT_COLOR)).toMatch(/transfer is smpte170m/);
    expect(colorMismatch(undefined, EXPORT_COLOR)).toBe('no video stream');
  });

  it('carries the policy into the container as ffmpeg flags', () => {
    expect(colorTagArgs(EXPORT_COLOR)).toEqual([
      '-color_range', 'tv',
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
    ]);
  });
});
