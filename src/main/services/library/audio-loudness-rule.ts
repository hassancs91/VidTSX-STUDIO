// The loudness rule generated sound is filed under (T6 / Q2, E-d7): −20 LUFS integrated under a −1.5 dBFS
// true-peak ceiling — the editor repo's `gen_sfx.py normalize_clip()` rule, ported verbatim, plus E-d11 (the
// ceiling must hold on the ENCODED file: the skip never keeps an over-ceiling peak, and the corrective-pass
// helpers below). Pure: no IO and no ffmpeg here; audio-normalize.ts measures and applies.

/** Integrated loudness every generated sound is normalized to (the SFX palette's `target_lufs`). */
export const LOUDNESS_TARGET_LUFS = -20;
/** The peak ceiling the gain may never push a sound over (the palette's `ceiling_dbfs`, read as dBTP). */
export const LOUDNESS_CEILING_DBFS = -1.5;
/** Below this EBU R128 gated the clip (too short or too quiet to integrate): fall back to the peak. */
export const LOUDNESS_GATED_BELOW_LUFS = -50;
/** A gain this small is not worth a re-encode. */
export const LOUDNESS_MIN_GAIN_DB = 0.1;
/**
 * E-d11: the ceiling is a property of the ENCODED file. When a lossy re-encode lands the true peak over it, the
 * corrective pass re-encodes from the original with the gain lowered by the overshoot PLUS this margin — the
 * codec's peak error moves a little between two encodes at gains a few tenths apart, so aiming 0.1 dB under the
 * ceiling makes the corrective pass hold first time (the second pass is the backstop).
 */
export const LOUDNESS_CEILING_MARGIN_DB = 0.1;
/** At most this many corrective re-encodes after the first (each from the ORIGINAL — one lossy generation). */
export const LOUDNESS_MAX_CORRECTIVE_PASSES = 2;

export interface LoudnessStats {
  /** Integrated loudness, LUFS (`-Infinity` when nothing passed the gate). */
  integratedLufs: number;
  /** True peak, dBTP (`-Infinity` for digital silence). */
  truePeakDbtp: number;
}

export interface LoudnessGainPlan {
  /** The gain to apply, dB, rounded to 0.01 (0 when `skipped`). */
  gainDb: number;
  /** −20 LUFS would have pushed the peak over the ceiling: the gain was cut to `ceiling − peak`. */
  clamped: boolean;
  /** Integrated loudness unusable (gated / unmeasurable): peak-normalized to the ceiling, or left. */
  gated: boolean;
  /** |gain| under the threshold (or no peak to work with) — nothing to apply. */
  skipped: boolean;
}

function parseDb(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '-inf') return -Infinity;
  if (trimmed === 'inf') return Infinity;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

/**
 * The `input_i` / `input_tp` fields of a `loudnorm=…:print_format=json` analysis pass (it prints them on stderr
 * when the input ends). Null when the block is missing or a field is not a number.
 */
export function parseLoudnormStats(stderr: string): LoudnessStats | null {
  const i = /"input_i"\s*:\s*"([^"]*)"/.exec(stderr);
  const tp = /"input_tp"\s*:\s*"([^"]*)"/.exec(stderr);
  if (!i || !tp) return null;
  const integratedLufs = parseDb(i[1]);
  const truePeakDbtp = parseDb(tp[1]);
  if (integratedLufs === null || truePeakDbtp === null) return null;
  return { integratedLufs, truePeakDbtp };
}

/**
 * The `gen_sfx.py` rule: the peak unmeasurable → leave; the loudness gated (not finite, or under −50) →
 * peak-normalize to the ceiling; else `target − I`, cut to `ceiling − peak` when the peak would cross the
 * ceiling; a gain under 0.1 dB is skipped.
 */
export function planLoudnessGain(
  stats: LoudnessStats,
  target = LOUDNESS_TARGET_LUFS,
  ceiling = LOUDNESS_CEILING_DBFS,
): LoudnessGainPlan {
  const peak = stats.truePeakDbtp;
  if (!Number.isFinite(peak)) return { gainDb: 0, clamped: false, gated: true, skipped: true };
  const loudness = stats.integratedLufs;
  let gainDb: number;
  let clamped = false;
  let gated = false;
  if (!Number.isFinite(loudness) || loudness < LOUDNESS_GATED_BELOW_LUFS) {
    gated = true;
    gainDb = ceiling - peak;
  } else {
    gainDb = target - loudness;
    if (peak + gainDb > ceiling) {
      gainDb = ceiling - peak;
      clamped = true;
    }
  }
  gainDb = round2(gainDb);
  // The 0.1 dB skip keeps the file as it is — never one whose peak is already over the ceiling (E-d11).
  const skipped = Math.abs(gainDb) < LOUDNESS_MIN_GAIN_DB && !isOverCeiling(peak, ceiling);
  return { gainDb: skipped ? 0 : gainDb, clamped, gated, skipped };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Is this true peak over the ceiling AS RECORDED (two decimals — the index's `peakDbfs` precision)? A file that
 * records as −1.50 is at the ceiling, not over it. Digital silence (`-Infinity`) and NaN are never over.
 */
export function isOverCeiling(peakDbtp: number, ceiling = LOUDNESS_CEILING_DBFS): boolean {
  return Number.isFinite(peakDbtp) && round2(peakDbtp) > ceiling;
}

/** The corrective pass's gain (E-d11): the applied gain minus the measured overshoot minus the margin, 0.01 dB. */
export function correctiveGain(appliedGainDb: number, measuredPeakDbtp: number, ceiling = LOUDNESS_CEILING_DBFS): number {
  return round2(appliedGainDb - (measuredPeakDbtp - ceiling) - LOUDNESS_CEILING_MARGIN_DB);
}
