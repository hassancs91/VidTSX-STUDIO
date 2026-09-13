import { describe, expect, it } from 'vitest';
import { exportOutputSize } from './output-size';

describe('exportOutputSize', () => {
  it('is the composition size at scale 1 or with no scale — the byte-identity path', () => {
    expect(exportOutputSize({ width: 1920, height: 1080 }, {})).toEqual({ width: 1920, height: 1080 });
    expect(exportOutputSize({ width: 1920, height: 1080 }, { scale: 1 })).toEqual({ width: 1920, height: 1080 });
  });

  it('lands on the dialog presets exactly (720p / 540p / 360p from 1080p)', () => {
    expect(exportOutputSize({ width: 1920, height: 1080 }, { scale: 720 / 1080 })).toEqual({ width: 1280, height: 720 });
    expect(exportOutputSize({ width: 1920, height: 1080 }, { scale: 540 / 1080 })).toEqual({ width: 960, height: 540 });
    expect(exportOutputSize({ width: 1920, height: 1080 }, { scale: 360 / 1080 })).toEqual({ width: 640, height: 360 });
  });

  it('snaps a scale with fractional dims to the nearest even-integer size, as the renderer does', () => {
    expect(exportOutputSize({ width: 1920, height: 1080 }, { scale: 480 / 1080 })).toEqual({ width: 864, height: 486 });
  });
});
