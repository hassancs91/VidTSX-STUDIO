/**
 * T8 "Check this export": the raw cross-correlation behind `locateAudio`,
 * done with an FFT so the audio search can reach ±2 s around the planned
 * camera time (a direct loop over 32 000 lags × a 16 000-sample window is
 * ~0.5 G multiply-adds per probe; the FFT is a few ms).
 */

/** In-place iterative radix-2 FFT (`inverse` → unscaled inverse). `re`/`im` length must be a power of two. */
function fft(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    const half = len >> 1;
    for (let start = 0; start < n; start += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

/**
 * `out[lag] = Σ needle[i] · haystack[lag + i]` for every lag where the needle
 * fits (`haystack.length − needle.length + 1` values); empty when it cannot fit.
 */
export function crossCorrelate(needle: Float32Array, haystack: Float32Array): Float64Array {
  const n = needle.length;
  const lags = haystack.length - n + 1;
  if (n === 0 || lags < 1) return new Float64Array(0);
  let size = 1;
  while (size < haystack.length + n) size <<= 1;
  const hRe = new Float64Array(size);
  const hIm = new Float64Array(size);
  const nRe = new Float64Array(size);
  const nIm = new Float64Array(size);
  hRe.set(haystack);
  nRe.set(needle);
  fft(hRe, hIm, false);
  fft(nRe, nIm, false);
  // H · conj(N), then the inverse: the correlation at each lag.
  for (let k = 0; k < size; k++) {
    const re = hRe[k] * nRe[k] + hIm[k] * nIm[k];
    const im = hIm[k] * nRe[k] - hRe[k] * nIm[k];
    hRe[k] = re;
    hIm[k] = im;
  }
  fft(hRe, hIm, true);
  const out = new Float64Array(lags);
  for (let lag = 0; lag < lags; lag++) out[lag] = hRe[lag] / size;
  return out;
}
