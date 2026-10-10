import { describe, expect, it } from 'vitest';
import { aspectLabel, formatErrors, formatFromConfig, formatLine } from './build-format';

const loop45 = { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true };

describe('formatLine', () => {
  it('reads the same as the P0 request line', () => {
    expect(formatLine(loop45)).toBe('4:5, 1080x1350, 30 fps, 240 frames (8 s), seamless loop');
  });

  it('lets the builder pick the length when none is given', () => {
    expect(formatLine({ width: 1920, height: 1080, fps: 30 })).toBe(
      '16:9, 1920x1080, 30 fps, length: you decide from the idea (3 to 60 s)',
    );
  });

  it('keeps fractional seconds short', () => {
    expect(formatLine({ width: 1080, height: 1080, fps: 30, durationInFrames: 100 })).toBe('1:1, 1080x1080, 30 fps, 100 frames (3.33 s)');
  });
});

describe('aspectLabel', () => {
  it('reduces the size to its ratio', () => {
    expect(aspectLabel(1080, 1920)).toBe('9:16');
    expect(aspectLabel(1000, 563)).toBe('1000:563');
  });
});

describe('formatErrors', () => {
  const config = { id: 'X', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };

  it('passes a config that matches the request', () => {
    expect(formatErrors(config, loop45)).toEqual([]);
  });

  it('names every field that departs from the request', () => {
    const errors = formatErrors({ ...config, width: 1080, height: 1080, fps: 60, durationInFrames: 300 }, loop45);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain('1080x1080; the request is 1080x1350');
    expect(errors[1]).toContain('fps is 60');
    expect(errors[2]).toContain('durationInFrames is 300');
  });

  it('accepts any length when the request leaves it to the builder', () => {
    expect(formatErrors({ ...config, durationInFrames: 999 }, { width: 1080, height: 1350, fps: 30 })).toEqual([]);
  });
});

describe('formatFromConfig', () => {
  it('keeps the frame and marks a loop only when asked', () => {
    const config = { id: 'X', width: 1080, height: 1350, fps: 30, durationInFrames: 240 };
    expect(formatFromConfig(config)).toEqual({ width: 1080, height: 1350, fps: 30, durationInFrames: 240 });
    expect(formatFromConfig(config, true)).toEqual(loop45);
  });
});
