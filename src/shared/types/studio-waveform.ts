// On-disk format of the studio waveform cache (cache/waveforms/<assetId>.json).
// Written by the main-process waveform generator; read by the timeline's clip
// waveforms (peaks) and the auto-cut planner (rmsDb).

/** Peak buckets per second. 50 is ~1 bucket per 1.5 px at default zoom —
 *  enough shape to spot pauses, small enough to keep the JSON light. */
export const PEAKS_PER_SECOND = 50;

/** dB value used for buckets with zero energy (log of 0 is undefined). */
export const RMS_SILENCE_DB = -120;

export interface WaveformFile {
  version: 2;
  peaksPerSecond: number;
  /** Normalized 0..1 peak per bucket, covering the whole source. */
  peaks: number[];
  /**
   * RMS level per bucket in dBFS (20·log10(rms), full scale = 1), rounded to
   * 0.1 dB, floored at RMS_SILENCE_DB. Same bucket grid as `peaks`. Feeds the
   * auto-cut noise-floor analysis; absent in version-1 files, which the
   * cut-plan path regenerates.
   */
  rmsDb?: number[];
}
