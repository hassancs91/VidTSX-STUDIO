import { describe, expect, it } from 'vitest';
import { MODNET_SHORT_SIDE_CPU, MODNET_SHORT_SIDE_GPU, matteToMask, modnetInputFrom, modnetInputSize } from './modnet';

describe('modnetInputSize', () => {
  it('brings the short side to 512 on DirectML and 352 on the CPU, both sides rounded DOWN to /32', () => {
    expect(modnetInputSize(960, 540, MODNET_SHORT_SIDE_GPU)).toEqual({ width: 896, height: 512 }); // the spike's production shape
    expect(modnetInputSize(960, 540, MODNET_SHORT_SIDE_CPU)).toEqual({ width: 608, height: 352 });
    expect(modnetInputSize(1920, 1080, MODNET_SHORT_SIDE_GPU)).toEqual({ width: 896, height: 512 });
    expect(modnetInputSize(1080, 1920, MODNET_SHORT_SIDE_GPU)).toEqual({ width: 512, height: 896 });
    expect(modnetInputSize(1440, 1080, MODNET_SHORT_SIDE_GPU)).toEqual({ width: 672, height: 512 });
  });

  it('scales a source under the short side UP (native 640×352 let the plush ghost back in)', () => {
    expect(modnetInputSize(640, 360, MODNET_SHORT_SIDE_GPU)).toEqual({ width: 896, height: 512 });
    expect(modnetInputSize(40, 20, MODNET_SHORT_SIDE_GPU)).toEqual({ width: 1024, height: 512 });
  });
});

describe('modnetInputFrom', () => {
  it('writes NCHW planes in [-1, 1]: (x / 255 - 0.5) / 0.5', () => {
    const rgb = new Uint8Array([0, 255, 51, 255, 0, 204]);
    const out = new Float32Array(6);
    modnetInputFrom(rgb, 2, 1, out);
    const expected = [0, 255, 255, 0, 51, 204].map((x) => (x / 255 - 0.5) / 0.5);
    out.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));
  });
});

describe('matteToMask', () => {
  it('area-averages the matte down to the stored size and quantises to 8 bits', () => {
    // 4×2 → 2×1: each output cell averages a 2×2 block.
    const matte = new Float32Array([1, 1, 0, 0.5, 1, 1, 0, 0.5]);
    expect([...matteToMask(matte, 4, 2, 2, 1)]).toEqual([255, 64]);
  });

  it('weighs a pixel split between two cells by its coverage', () => {
    // 3 → 2: cell 0 covers pixel 0 fully and pixel 1 by half; cell 1 the rest.
    const matte = new Float32Array([1, 0, 0]);
    expect([...matteToMask(matte, 3, 1, 2, 1)]).toEqual([Math.round((1 * 1 + 0 * 0.5) / 1.5 * 255), 0]);
  });

  it('undoes the /32 stretch: 896×512 lands on 256×144 with the subject where it was', () => {
    const W = 896, H = 512;
    const matte = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = W / 2; x < W; x++) matte[y * W + x] = 1; // right half is subject
    const mask = matteToMask(matte, W, H, 256, 144);
    expect(mask.length).toBe(256 * 144);
    expect(mask[10 * 256 + 10]).toBe(0);
    expect(mask[10 * 256 + 245]).toBe(255);
    expect(mask[10 * 256 + 127]).toBe(0);
    expect(mask[10 * 256 + 128]).toBe(255);
  });

  it('clamps values the model overshoots', () => {
    expect([...matteToMask(new Float32Array([1.2, -0.1]), 2, 1, 2, 1)]).toEqual([255, 0]);
  });
});
