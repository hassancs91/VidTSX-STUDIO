// On-disk format of the studio waveform cache (cache/waveforms/<assetId>.json).
// Written by the main-process waveform generator; read by the timeline's clip
// waveforms (peaks) and the auto-cut planner (rmsDb).

/** Peak buckets per second. 50 is ~1 bucket per 1.5 px at default zoom —
 *  enough shape to spot pauses, small enough to keep the JSON light. */
export const PEAKS_PER_SECOND = 50;

/** dB value used for buckets with zero energy (log of 0 is undefined). */
export const RMS_SILENCE_DB = -120;

/** Sample rate the waveform job decodes at (v3+). cutlib reads 16 kHz WAVs;
 *  fricative energy (4–12 kHz) needs it — 8 kHz audio has a 4 kHz Nyquist. */
export const WAVEFORM_SAMPLE_RATE = 16000;

/** Current waveform cache version. v3 = 16 kHz decode + `zcr`. */
export const WAVEFORM_VERSION = 3;

export interface WaveformFile {
  /** 1 = peaks only · 2 = + rmsDb (8 kHz) · 3 = 16 kHz decode + zcr. */
  version: 1 | 2 | 3;
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
  /**
   * Zero crossings per second per bucket (v3+), counted on the 16 kHz mono
   * samples the way cutlib's `zcr` does (a sign change, 0 counts as positive).
   * ~1–2 k for voiced sound and room tone, 4–12 k for fricatives. Same bucket
   * grid as `peaks`. Absent in v1/v2 files: the fricative rule is then off.
   */
  zcr?: number[];
}
