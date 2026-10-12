import { describe, expect, it } from 'vitest';
import { describePurity, measurePurity, PURITY_MIN_DIFF, purityFrames } from './frame-purity';
import type { Bitmap } from './loop-seam';

const W = 40;
const H = 20;

/** A flat frame with an optional 4x4 square: a body somewhere. */
function frame(square?: { x: number; y: number }, base = 200): Bitmap {
  const data = new Uint8Array(W * H * 4).fill(base);
  if (square) {
    for (let y = square.y; y < square.y + 4; y++) {
      for (let x = square.x; x < square.x + 4; x++) {
        const i = (y * W + x) * 4;
        data[i] = 20;
        data[i + 1] = 40;
        data[i + 2] = 220;
      }
    }
  }
  return { width: W, height: H, data };
}

describe('purityFrames', () => {
  it('samples a third, two thirds and the last frame', () => {
    expect(purityFrames(90)).toEqual([30, 59, 89]);
    expect(purityFrames(2)).toEqual([0, 1]);
    expect(purityFrames(1)).toEqual([0]);
  });
});

describe('measurePurity', () => {
  it('is PURE when every pair is identical', () => {
    const m = measurePurity([
      { frame: 30, inOrder: frame({ x: 5, y: 5 }), alone: frame({ x: 5, y: 5 }) },
      { frame: 89, inOrder: frame({ x: 30, y: 12 }), alone: frame({ x: 30, y: 12 }) },
    ]);
    expect(m.pure).toBe(true);
    expect(m.frames.map((f) => f.mean)).toEqual([0, 0]);
  });

  it('is IMPURE when a body sits elsewhere in the fresh page, and says where', () => {
    const m = measurePurity([
      { frame: 30, inOrder: frame({ x: 5, y: 5 }), alone: frame({ x: 5, y: 5 }) },
      { frame: 89, inOrder: frame({ x: 30, y: 12 }), alone: frame({ x: 30, y: 2 }) },
    ]);
    expect(m.pure).toBe(false);
    expect(m.frames[0].differs).toBe(false);
    expect(m.frames[1].differs).toBe(true);
    expect(m.frames[1].region).toMatchObject({ x: 30, y: 2, width: 4, height: 14 });
  });

  it('catches a faint change everywhere (no pixel over the visible step, the mean over the floor)', () => {
    const m = measurePurity([{ frame: 10, inOrder: frame(undefined, 200), alone: frame(undefined, 201) }]);
    expect(m.frames[0].region).toBeNull();
    expect(m.frames[0].mean).toBeGreaterThanOrEqual(PURITY_MIN_DIFF);
    expect(m.pure).toBe(false);
  });
});

describe('describePurity', () => {
  it('reports PURE with each frame', () => {
    const text = describePurity(measurePurity([{ frame: 30, inOrder: frame(), alone: frame() }]), 1);
    expect(text).toMatch(/^PURE: frames 30 render the same/);
    expect(text).toContain('Frame 30: mean difference 0.000');
    expect(text).not.toContain('Usual causes');
  });

  it('reports IMPURE with the box in build pixels and the usual causes', () => {
    const m = measurePurity([{ frame: 89, inOrder: frame({ x: 30, y: 12 }), alone: frame({ x: 30, y: 2 }) }]);
    const text = describePurity(m, 0.5);
    expect(text).toMatch(/^IMPURE: /);
    expect(text).toContain('box x 60-66, y 4-30');
    expect(text).toContain('useSimulation from @vidtsx/sim');
  });
});
