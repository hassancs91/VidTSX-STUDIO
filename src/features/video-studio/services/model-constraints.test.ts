import { describe, it, expect } from 'vitest';
import type { VideoModelInfoIpc } from '@shared/ipc/types';
import {
  availableModes,
  clampAspectRatio,
  clampDuration,
  clampMode,
  clampResolution,
  defaultDuration,
  estimatedCostUsd,
  isCostRateApproximate,
} from './model-constraints';

function model(overrides: Partial<VideoModelInfoIpc> = {}): VideoModelInfoIpc {
  return {
    id: 'm',
    name: 'M',
    durations: { kind: 'discrete', values: [5, 10] },
    aspectRatios: ['16:9', '9:16'],
    supports: { audio: false, firstFrame: false, lastFrame: false },
    ...overrides,
  };
}

describe('duration clamping', () => {
  it('snaps to the nearest published value on a discrete model', () => {
    const m = model({ durations: { kind: 'discrete', values: [4, 6, 8] } });
    expect(clampDuration(m, 7)).toBe(6);
    expect(clampDuration(m, 100)).toBe(8);
    expect(clampDuration(m, 1)).toBe(4);
  });

  it('holds a range model inside its bounds', () => {
    const m = model({ durations: { kind: 'range', min: 4, max: 30, auto: true } });
    expect(clampDuration(m, 12)).toBe(12);
    expect(clampDuration(m, 2)).toBe(4);
    expect(clampDuration(m, 45)).toBe(30);
  });

  it('defaults inside the model rather than to a fixed 5s', () => {
    expect(defaultDuration(model({ durations: { kind: 'range', min: 8, max: 20 } }))).toBe(8);
    expect(
      defaultDuration(model({ durations: { kind: 'discrete', values: [10, 15] } })),
    ).toBe(10);
  });
});

describe('aspect and resolution clamping', () => {
  it('keeps an allowed aspect and falls back to 16:9 then the first', () => {
    const m = model({ aspectRatios: ['21:9', '1:1'] });
    expect(clampAspectRatio(m, '1:1')).toBe('1:1');
    expect(clampAspectRatio(m, '4:3')).toBe('21:9');
    expect(clampAspectRatio(model(), '4:3')).toBe('16:9');
  });

  it('returns undefined when the endpoint has no resolution field', () => {
    expect(clampResolution(model(), '720p')).toBeUndefined();
  });

  it('falls back to the first published resolution — the model default', () => {
    const m = model({ resolutions: ['720p', '480p'] });
    expect(clampResolution(m, '480p')).toBe('480p');
    expect(clampResolution(m, '4k')).toBe('720p');
    expect(clampResolution(m, undefined)).toBe('720p');
  });
});

describe('modes follow the routes a model actually has', () => {
  it('offers only generate when there is no image or reference route', () => {
    expect(availableModes(model())).toEqual(['generate']);
  });

  it('adds frames and reference when the model supports them', () => {
    const m = model({
      supports: {
        audio: true,
        firstFrame: true,
        lastFrame: true,
        references: { images: 9, videos: 3, audios: 3 },
      },
    });
    expect(availableModes(m)).toEqual(['generate', 'frames', 'reference']);
  });

  it('hides reference mode when every reference limit is zero', () => {
    const m = model({
      supports: {
        audio: false,
        firstFrame: true,
        lastFrame: false,
        references: { images: 0, videos: 0, audios: 0 },
      },
    });
    expect(availableModes(m)).toEqual(['generate', 'frames']);
    expect(clampMode(m, 'reference')).toBe('generate');
    expect(clampMode(m, 'frames')).toBe('frames');
  });
});

describe('cost estimate', () => {
  const seedance = model({
    resolutions: ['720p', '480p'],
    pricePerSecondUsd: 0.47,
    pricePerSecondByResolutionUsd: { '480p': 0.22, '720p': 0.47 },
  });

  it('uses the rate published for the requested resolution', () => {
    expect(estimatedCostUsd(seedance, '480p', 4)).toBeCloseTo(0.88);
    expect(estimatedCostUsd(seedance, '720p', 4)).toBeCloseTo(1.88);
    expect(isCostRateApproximate(seedance, '480p')).toBe(false);
  });

  it('falls back to the headline rate and says so', () => {
    const m = model({ resolutions: ['720p', '480p'], pricePerSecondUsd: 0.3 });
    expect(estimatedCostUsd(m, '480p', 4)).toBeCloseTo(1.2);
    expect(isCostRateApproximate(m, '480p')).toBe(true);
  });

  it('returns null when the catalog carries no price at all', () => {
    expect(estimatedCostUsd(model(), undefined, 5)).toBeNull();
  });
});
