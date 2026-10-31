// The audio probe behind the cut planner — the port of the reference
// pipeline's AudioProbe (claude-youtube-editor tools/cutlib.py), reading the
// waveform cache's per-bucket RMS dB and zero-crossing rates instead of raw
// WAV samples. Pure: no I/O.
//
// Windows: cutlib measures exact sample windows [t, t+win). The cache only
// has 20 ms buckets, so a window here is the overlap-weighted mean of the
// buckets it covers (power for levels, rate for ZCR) — exact when a bucket's
// energy is uniform, and unbiased (snapping a window to bucket starts would
// read every window up to one bucket early).

import { RMS_SILENCE_DB } from '../types/studio-waveform';

/** cutlib's floor_db window: the noise floor is a percentile of 50 ms windows. */
const FLOOR_WINDOW_S = 0.05;

export class RmsEnvelope {
  private floor: number | null = null;

  /**
   * @param buckets RMS dBFS per bucket.
   * @param bucketsPerSecond bucket rate (the cache's `peaksPerSecond`).
   * @param zcrBuckets zero crossings per second per bucket, same grid (v3
   *   caches). Absent ⇒ `zcr()` reads 0 and every fricative rule is off.
   */
  constructor(
    private readonly buckets: number[],
    private readonly bucketsPerSecond: number,
    private readonly zcrBuckets?: number[],
  ) {}

  /** Audio length covered by the envelope, seconds. */
  duration(): number {
    return this.buckets.length / this.bucketsPerSecond;
  }

  /** True when the cache carried zero-crossing rates (the fricative rule can run). */
  hasZcr(): boolean {
    return !!this.zcrBuckets && this.zcrBuckets.length > 0;
  }

  /** Mean power over [t, t+win), in dB. Out-of-range ⇒ silence (decayed). */
  rmsDb(t: number, win = 0.05): number {
    const mean = this.windowMean(this.buckets, t, win, (db) => Math.pow(10, db / 10));
    if (mean === null || !(mean > 0)) return RMS_SILENCE_DB;
    return Math.max(RMS_SILENCE_DB, 10 * Math.log10(mean));
  }

  /**
   * Zero crossings per second over [t, t+win) — cutlib's `zcr`: ~1–2 k for
   * voiced sound and room tone, 4–12 k for fricatives (s, z, sh, th, f).
   * 0 without ZCR data or outside the audio.
   */
  zcr(t: number, win = 0.03): number {
    if (!this.zcrBuckets || this.zcrBuckets.length === 0) return 0;
    return this.windowMean(this.zcrBuckets, t, win, (rate) => rate) ?? 0;
  }

  /** Noise floor = 10th percentile of 50 ms window levels (cutlib's floor_db). */
  floorDb(): number {
    if (this.floor === null) {
      if (this.buckets.length === 0) return RMS_SILENCE_DB;
      const total = this.duration();
      const levels: number[] = [];
      for (let k = 0; k * FLOOR_WINDOW_S < total - FLOOR_WINDOW_S; k++) {
        levels.push(this.rmsDb(k * FLOOR_WINDOW_S, FLOOR_WINDOW_S));
      }
      if (levels.length === 0) levels.push(this.rmsDb(0, total));
      levels.sort((x, y) => x - y);
      this.floor = levels[Math.floor(levels.length / 10)];
    }
    return this.floor;
  }

  /**
   * Seconds to keep after wordEnd so the word's release decays to the noise
   * floor: steps 20 ms from minTail and stops at the first window ≤ floor +
   * margin. With `fricZcr`, a weak final fricative ("path", "with") that sits
   * below floor + margin but above floor + fricMargin keeps the walk going
   * while its ZCR ≥ fricZcr (room tone reads ~0.9–1.5 k, so it never does).
   */
  snapTail(
    wordEnd: number,
    minTail: number,
    maxTail: number,
    margin = 5.0,
    fricZcr?: number,
    fricMargin = 5.0,
  ): number {
    const floor = this.floorDb();
    for (let o = minTail; o <= maxTail; o += 0.02) {
      const level = this.rmsDb(wordEnd + o);
      if (level <= floor + margin) {
        const fricative =
          !!fricZcr && level > floor + fricMargin && this.zcr(wordEnd + o) >= fricZcr;
        if (!fricative) return round3(o);
      }
    }
    return maxTail;
  }

  /**
   * Lead-in before wordStart: at least `head`, more when the word's audio
   * starts before its ASR token — walk back in 10 ms steps while the 20 ms
   * window before t is above floor + margin (or still a fricative), then add
   * 30 ms. Capped at maxHead. ("Every" began 0.16 s before its token, so a
   * fixed 0.15 head shaved the onset.)
   */
  snapHead(
    wordStart: number,
    head: number,
    maxHead: number,
    margin = 5.0,
    fricZcr?: number,
    fricMargin = 5.0,
  ): number {
    const floor = this.floorDb();
    let t = wordStart;
    while (wordStart - t < maxHead) {
      const level = this.rmsDb(t - 0.02, 0.02);
      const fricative =
        !!fricZcr && level > floor + fricMargin && this.zcr(t - 0.02, 0.02) >= fricZcr;
      if (level > floor + margin || fricative) t -= 0.01;
      else break;
    }
    return round3(Math.min(Math.max(head, wordStart - t + 0.03), maxHead));
  }

  /**
   * Overlap-weighted mean of `toValue(bucket)` over [t, t+win), clamped to
   * the audio. null when the clamped window is empty.
   */
  private windowMean(
    values: number[],
    t: number,
    win: number,
    toValue: (bucket: number) => number,
  ): number | null {
    const bps = this.bucketsPerSecond;
    const from = Math.max(0, t * bps);
    const to = Math.min(values.length, (t + win) * bps);
    if (!(to > from)) return null;
    let sum = 0;
    let weight = 0;
    for (let i = Math.floor(from); i < to; i++) {
      const w = Math.min(i + 1, to) - Math.max(i, from);
      if (w <= 0) continue;
      sum += w * toValue(values[i]);
      weight += w;
    }
    return weight > 0 ? sum / weight : null;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
