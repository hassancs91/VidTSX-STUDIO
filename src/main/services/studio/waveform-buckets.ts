// Pure per-bucket reduction of 16-bit mono PCM into the waveform cache's
// three arrays: peaks (what the timeline draws), RMS dB (the cut planner's
// level) and zero crossings per second (the cut planner's fricative test).
// Kept apart from the ffmpeg plumbing so it is unit-testable.

import { RMS_SILENCE_DB } from '../../../shared/types/studio-waveform';

export interface WaveformBuckets {
  peaks: number[];
  rmsDb: number[];
  zcr: number[];
}

function bucketRmsDb(sumSquares: number, count: number): number {
  if (count === 0) return RMS_SILENCE_DB;
  const rms = Math.sqrt(sumSquares / count) / 32768;
  if (rms <= 0) return RMS_SILENCE_DB;
  return Math.max(RMS_SILENCE_DB, Math.round(20 * Math.log10(rms) * 10) / 10);
}

export class WaveformBucketizer {
  private readonly out: WaveformBuckets = { peaks: [], rmsDb: [], zcr: [] };
  private peak = 0;
  private sumSquares = 0;
  private crossings = 0;
  private count = 0;
  /** Sign of the previous sample (cutlib: `data[i] < 0`); null before the first. */
  private prevNegative: boolean | null = null;
  private carry: Buffer | null = null;

  constructor(
    private readonly sampleRate: number,
    private readonly samplesPerBucket: number,
  ) {}

  /** Feed raw little-endian s16 bytes; a sample split across chunks is carried. */
  push(chunk: Buffer): void {
    const buffer = this.carry ? Buffer.concat([this.carry, chunk]) : chunk;
    const usable = buffer.length - (buffer.length % 2);
    this.carry = usable < buffer.length ? buffer.subarray(usable) : null;
    for (let i = 0; i < usable; i += 2) this.sample(buffer.readInt16LE(i));
  }

  /** Close the last partial bucket and return the arrays. */
  finish(): WaveformBuckets {
    if (this.count > 0) this.flush();
    return this.out;
  }

  private sample(value: number): void {
    const amplitude = Math.abs(value) / 32768;
    if (amplitude > this.peak) this.peak = amplitude;
    this.sumSquares += value * value;
    // A crossing is counted in the bucket of the sample that completes it —
    // summed over a window this is cutlib's count of sign changes in it.
    const negative = value < 0;
    if (this.prevNegative !== null && negative !== this.prevNegative) this.crossings++;
    this.prevNegative = negative;
    if (++this.count >= this.samplesPerBucket) this.flush();
  }

  private flush(): void {
    this.out.peaks.push(Math.round(this.peak * 1000) / 1000);
    this.out.rmsDb.push(bucketRmsDb(this.sumSquares, this.count));
    this.out.zcr.push(Math.round((this.crossings * this.sampleRate) / this.count));
    this.peak = 0;
    this.sumSquares = 0;
    this.crossings = 0;
    this.count = 0;
  }
}
