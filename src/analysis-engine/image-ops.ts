// Pixel helpers for the analysis worker — plain typed arrays over RGB24.
// The harness used sharp for these (it was there); the app does them in
// JS: the detector's input is ~640 px on its long side and the mesh crop is
// 256², so both cost a couple of milliseconds a frame.

/**
 * Bilinear resize of tightly packed RGB24. Good enough for the detector's
 * input (it sees a 640-px letterbox either way); the mesh samples the
 * full-resolution frame itself.
 */
export function resizeRgb(src: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  if (sw === dw && sh === dh) return src;
  const out = new Uint8Array(dw * dh * 3);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, (y + 0.5) * yRatio - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(sh - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, (x + 0.5) * xRatio - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(sw - 1, x0 + 1);
      const fx = sx - x0;
      const o = (y * dw + x) * 3;
      for (let c = 0; c < 3; c++) {
        const a = src[(y0 * sw + x0) * 3 + c];
        const b = src[(y0 * sw + x1) * 3 + c];
        const d = src[(y1 * sw + x0) * 3 + c];
        const e = src[(y1 * sw + x1) * 3 + c];
        out[o + c] = Math.round((a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy);
      }
    }
  }
  return out;
}

/**
 * One bilinear RGB sample at a fractional position into `out[o..o+2]` as
 * floats in 0..1; outside the frame = black (the mesh crop's padding).
 */
export function sampleBilinear(rgb: Uint8Array, W: number, H: number, x: number, y: number, out: Float32Array, o: number): void {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) {
    out[o] = out[o + 1] = out[o + 2] = 0;
    return;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1);
  const y1 = Math.min(H - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const a = rgb[(y0 * W + x0) * 3 + c];
    const b = rgb[(y0 * W + x1) * 3 + c];
    const d = rgb[(y1 * W + x0) * 3 + c];
    const e = rgb[(y1 * W + x1) * 3 + c];
    out[o + c] = ((a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy) / 255;
  }
}
