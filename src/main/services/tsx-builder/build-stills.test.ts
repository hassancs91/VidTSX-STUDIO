import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ nativeImage: {} }));
vi.mock('@remotion/renderer', () => ({ renderStill: vi.fn(), selectComposition: vi.fn() }));
vi.mock('../remotion-bundler', () => ({ bundleComposition: vi.fn() }));
vi.mock('../../utils/paths', () => ({ getRemotionBinariesDir: () => null }));

import { clampFrames } from './build-stills';

describe('clampFrames', () => {
  it('keeps frames inside the composition, rounded, deduped, sorted', () => {
    expect(clampFrames([239, 0, 300, -5, 120.4, 120], 240)).toEqual([0, 120, 239]);
  });

  it('drops non-numbers and handles a one-frame composition', () => {
    expect(clampFrames([Number.NaN, 5], 1)).toEqual([0]);
  });
});
