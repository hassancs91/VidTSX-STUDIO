/**
 * T8 "Check this export" (END_TO_END_PLAN §2): the verdict of the user-facing
 * A/V check, ported from the editor's `tools/verify_sync.py` `report()`.
 *
 * Each confident probe carries a sync error in ms = where the PICTURE says
 * this export moment lives in the camera file − where the AUDIO says it lives
 * (positive = audio BEHIND the picture, negative = AHEAD). Pass iff the median
 * |error| < 25 ms and the fitted drift × the measured span stays within 40 ms,
 * over at least 3 confident probes; fewer is "inconclusive", never a pass.
 */

export const SYNC_TOLERANCE_MS = 25;
export const SYNC_DRIFT_LIMIT_MS = 40;
export const SYNC_MIN_PROBES = 3;

export interface SyncErrorRow {
  /** Export seconds. */
  t: number;
  errorMs: number;
}

export type SyncVerdictKind = 'pass' | 'fail' | 'inconclusive';

export interface SyncVerdict {
  verdict: SyncVerdictKind;
  /** Median sync error (ms, 0.1 ms), + = audio behind the picture. */
  offsetMs: number | null;
  /** Median absolute deviation around the offset (ms). */
  spreadMs: number | null;
  driftMsPerSec: number | null;
  driftOverSpanMs: number | null;
  spanSec: number | null;
  attempted: number;
  confident: number;
  /** Confident probes left after the outlier cut (the drift fit's input). */
  used: number;
  message: string;
}

export interface SyncVerdictOptions {
  toleranceMs?: number;
  driftLimitMs?: number;
  minProbes?: number;
}

/** numpy.median: the mean of the two middle values for an even count. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Least-squares slope (numpy.polyfit(x, y, 1)[0]); 0 when x has no spread. */
export function linearSlope(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  return sxx > 0 ? sxy / sxx : 0;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const signed = (v: number) => `${v >= 0 ? '+' : ''}${r1(v)}`;

export function syncVerdict(rows: readonly SyncErrorRow[], attempted: number, options: SyncVerdictOptions = {}): SyncVerdict {
  const tol = options.toleranceMs ?? SYNC_TOLERANCE_MS;
  const driftLimit = options.driftLimitMs ?? SYNC_DRIFT_LIMIT_MS;
  const minProbes = options.minProbes ?? SYNC_MIN_PROBES;
  const confident = rows.length;
  if (confident < minProbes) {
    return {
      verdict: 'inconclusive',
      offsetMs: null,
      spreadMs: null,
      driftMsPerSec: null,
      driftOverSpanMs: null,
      spanSec: null,
      attempted,
      confident,
      used: 0,
      message: `Not enough to judge: only ${confident} of ${attempted} probes found the camera picture confidently (${minProbes} needed).`,
    };
  }
  const t = rows.map((r) => r.t);
  const e = rows.map((r) => r.errorMs);
  const offset = median(e);
  const mad = median(e.map((v) => Math.abs(v - offset)));
  // A failed frame match is wrong by a lot, not a little: cut those before the drift fit.
  const cut = Math.max(60, 6 * mad);
  const keep = rows.filter((r) => Math.abs(r.errorMs - offset) < cut);
  const slope = keep.length >= minProbes ? linearSlope(keep.map((r) => r.t), keep.map((r) => r.errorMs)) : 0;
  const span = Math.max(...t) - Math.min(...t);
  const drift = slope * span;
  const drifting = Math.abs(drift) > driftLimit;
  const inTolerance = Math.abs(offset) < tol;
  const pass = inTolerance && !drifting;
  const counted = `(${confident} of ${attempted} probes)`;
  let message: string;
  if (pass) {
    message = `In sync: audio ${signed(offset)} ms vs the picture, drift ${signed(drift)} ms over ${r1(span)} s ${counted}.`;
  } else if (!inTolerance) {
    const side = offset > 0 ? 'BEHIND' : 'AHEAD of';
    message = `Out of sync: audio ${Math.abs(r1(offset))} ms ${side} the picture ${counted}.`;
  } else {
    message = `Out of sync: the offset drifts ${signed(drift)} ms over ${r1(span)} s — not a constant delay ${counted}.`;
  }
  return {
    verdict: pass ? 'pass' : 'fail',
    offsetMs: r1(offset),
    spreadMs: r1(mad),
    driftMsPerSec: Math.round(slope * 10000) / 10000,
    driftOverSpanMs: r1(drift),
    spanSec: Math.round(span * 1000) / 1000,
    attempted,
    confident,
    used: keep.length,
    message,
  };
}
