import { describe, it, expect } from 'vitest';
import { snapRenderScale } from './render-scale';

// The stitcher validates `width * scale % 1 === 0` in plain float arithmetic,
// so every accepted result must reproduce exact integers with the exact same
// expressions — that's what these assertions recompute.
function expectExactEvenDims(
  w: number,
  h: number,
  result: { scale: number; width: number; height: number }
) {
  expect(w * result.scale).toBe(result.width);
  expect(h * result.scale).toBe(result.height);
  expect(Number.isInteger(result.width)).toBe(true);
  expect(Number.isInteger(result.height)).toBe(true);
  expect(result.width % 2).toBe(0);
  expect(result.height % 2).toBe(0);
}

describe('snapRenderScale', () => {
  it('passes through a scale that already yields even-integer dims (720p from 1080p)', () => {
    const s = 720 / 1080;
    const result = snapRenderScale(1920, 1080, s);
    expect(result).not.toBeNull();
    expect(result!.scale).toBe(s);
    expect(result!.width).toBe(1280);
    expect(result!.height).toBe(720);
  });

  it('snaps the 480p-from-1080p preset (the GIF export case) to 864×486', () => {
    // Requested 480/1080 gives 1920 × 0.4444… = 853.33 — the case that used
    // to be materialized as an 854×480 composition, rendering unscaled
    // pixel-sized content oversized and cropped.
    const result = snapRenderScale(1920, 1080, 480 / 1080);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(864);
    expect(result!.height).toBe(486);
    expectExactEvenDims(1920, 1080, result!);
  });

  it('handles portrait compositions symmetrically', () => {
    const result = snapRenderScale(1080, 1920, 480 / 1080);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(486);
    expect(result!.height).toBe(864);
    expectExactEvenDims(1080, 1920, result!);
  });

  it('hits 480×480 exactly for a square 1080 composition', () => {
    const result = snapRenderScale(1080, 1080, 480 / 1080);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(480);
    expect(result!.height).toBe(480);
    expectExactEvenDims(1080, 1080, result!);
  });

  it('snaps 4K and 1440p sources near the requested scale', () => {
    for (const [w, h] of [[3840, 2160], [2560, 1440], [1280, 720]] as const) {
      const requested = 480 / h;
      const result = snapRenderScale(w, h, requested);
      expect(result).not.toBeNull();
      expectExactEvenDims(w, h, result!);
      expect(Math.abs(result!.scale - requested)).toBeLessThanOrEqual(requested * 0.1);
    }
  });

  it('returns null for near-coprime dims where no nearby scale exists', () => {
    expect(snapRenderScale(1919, 1079, 0.4444)).toBeNull();
  });

  it('returns null rather than an output smaller than 2px', () => {
    expect(snapRenderScale(16, 9, 0.01)).toBeNull();
  });

  it('rejects invalid inputs', () => {
    expect(snapRenderScale(0, 1080, 0.5)).toBeNull();
    expect(snapRenderScale(1920.5, 1080, 0.5)).toBeNull();
    expect(snapRenderScale(1920, 1080, 0)).toBeNull();
    expect(snapRenderScale(1920, 1080, -1)).toBeNull();
    expect(snapRenderScale(1920, 1080, NaN)).toBeNull();
  });

  it('accepts every resolution the settings modal can produce for common comps', () => {
    // Mirror of the modal's preset math: targetHeight over the comp's
    // limiting dimension. Every common source size must land on an exact
    // even-integer scale — the materialize-dims fallback must stay reserved
    // for pathological sizes.
    const comps = [[1920, 1080], [1080, 1920], [3840, 2160], [1080, 1080], [2560, 1440]] as const;
    const targets = [2160, 1080, 720, 480];
    for (const [w, h] of comps) {
      const isLandscape = w >= h;
      for (const t of targets) {
        const requested = isLandscape ? t / h : t / w;
        if (requested >= 1) continue;
        const result = snapRenderScale(w, h, requested);
        expect(result, `${w}x${h} @ ${t}p`).not.toBeNull();
        expectExactEvenDims(w, h, result!);
      }
    }
  });
});
