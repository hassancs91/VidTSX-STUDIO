// MODNet portrait matting — the pure half of the masks pipeline
// (docs/studio/FILTER_PACKS_DESIGN.md "Spike results" → Facts 4 and the
// Decision): the input size, the normalisation, and the matte brought down
// to the stored mask size. The harness's `masks.mjs` did these with sharp;
// the app does them on typed arrays (the feed already delivers RGB24 at the
// input size — ffmpeg's scaler does the resize).

/** Short side on DirectML: the model card's reference (896×512 for 16:9). */
export const MODNET_SHORT_SIDE_GPU = 512;
/** Short side on the CPU fallback (the spike: 116 ms a frame vs 263 at 512). */
export const MODNET_SHORT_SIDE_CPU = 352;

/**
 * The model's input for a source: the short side AT `shortSide` — a smaller
 * source is scaled up to it — both sides rounded DOWN to a multiple of 32,
 * never below 32. (The official script keeps a source whose short side is
 * under 512 native; measured 2026-09-25 on the spike fixture, 640×360: at
 * native 640×352 the pink plush at the right shoulder joins the mask on 4 of
 * 75 frames, up to 80/255 mean alpha in its box; at 896×512 and 608×352 on
 * none. The model card's rule — always the short side — is what ships.)
 */
export function modnetInputSize(width: number, height: number, shortSide: number): { width: number; height: number } {
  const short = Math.min(width, height);
  const scale = shortSide / short;
  const to32 = (v: number) => Math.max(32, Math.floor((v * scale) / 32) * 32);
  return { width: to32(width), height: to32(height) };
}

/** RGB24 → the model's NCHW float input, `(x / 255 − 0.5) / 0.5` (= [−1, 1]). */
export function modnetInputFrom(rgb: Uint8Array, width: number, height: number, out: Float32Array): void {
  const plane = width * height;
  for (let p = 0; p < plane; p++) {
    out[p] = rgb[p * 3] / 127.5 - 1;
    out[plane + p] = rgb[p * 3 + 1] / 127.5 - 1;
    out[2 * plane + p] = rgb[p * 3 + 2] / 127.5 - 1;
  }
}

/** Per output cell along one axis: the source pixels it covers and their fractional weights (area resampling). */
function axisWeights(src: number, dst: number): { first: Int32Array; weights: Float32Array[] } {
  const ratio = src / dst;
  const first = new Int32Array(dst);
  const weights: Float32Array[] = [];
  for (let o = 0; o < dst; o++) {
    const a = o * ratio;
    const b = Math.min(src, (o + 1) * ratio);
    const i0 = Math.min(src - 1, Math.floor(a));
    const i1 = Math.max(i0 + 1, Math.ceil(b));
    const w = new Float32Array(i1 - i0);
    let sum = 0;
    for (let i = i0; i < i1; i++) {
      const cover = Math.max(0, Math.min(b, i + 1) - Math.max(a, i));
      w[i - i0] = cover;
      sum += cover;
    }
    // Upsampling (a cell narrower than a pixel) lands wholly inside one pixel.
    if (sum <= 0) w[0] = sum = 1;
    for (let k = 0; k < w.length; k++) w[k] /= sum;
    first[o] = i0;
    weights.push(w);
  }
  return { first, weights };
}

/**
 * The model's matte (floats, 0..1, `width × height`) → the stored mask:
 * area-averaged down to `maskWidth × maskHeight` (both axes independently,
 * which also undoes the /32 rounding's slight stretch) and quantised to
 * 8 bits, 0 = background, 255 = subject.
 */
export function matteToMask(matte: ArrayLike<number>, width: number, height: number, maskWidth: number, maskHeight: number): Uint8Array {
  const xs = axisWeights(width, maskWidth);
  const ys = axisWeights(height, maskHeight);
  const rows = new Float32Array(height * maskWidth);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < maskWidth; x++) {
      const w = xs.weights[x];
      const i0 = xs.first[x];
      let acc = 0;
      for (let k = 0; k < w.length; k++) acc += matte[row + i0 + k] * w[k];
      rows[y * maskWidth + x] = acc;
    }
  }
  const out = new Uint8Array(maskWidth * maskHeight);
  for (let y = 0; y < maskHeight; y++) {
    const w = ys.weights[y];
    const j0 = ys.first[y];
    for (let x = 0; x < maskWidth; x++) {
      let acc = 0;
      for (let k = 0; k < w.length; k++) acc += rows[(j0 + k) * maskWidth + x] * w[k];
      out[y * maskWidth + x] = Math.round(Math.max(0, Math.min(1, acc)) * 255);
    }
  }
  return out;
}
