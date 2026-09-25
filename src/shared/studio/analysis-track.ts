// What every analysis track shares (docs/studio/FILTER_PACKS_DESIGN.md
// "Analysis tracks"): spans of SOURCE seconds, their union and what is still
// missing from one, the span a run settles, and the nearest-frame lookup
// within half a frame. The faces track (`face-track.ts`) and the masks track
// (`mask-track.ts`) are two formats over these rules.
//
// Pure: the jobs (main), the composition (renderer + render host) and the
// tests share it. No DOM, no Node.

export type AnalysisProvider = 'dml' | 'cpu';

/** A closed range of source seconds `[start, end]`. */
export type TrackSpan = [start: number, end: number];

/** Frame times are stored to this many decimals — far below half a frame at any rate. */
const TIME_DECIMALS = 5;

export const roundTrackTime = (t: number): number => {
  const f = 10 ** TIME_DECIMALS;
  return Math.round(t * f) / f;
};

/** Sorted union of spans; two spans closer than `gap` seconds join. */
export function mergeSpans(spans: readonly TrackSpan[], gap = 0): TrackSpan[] {
  const sorted = spans
    .filter((s) => Number.isFinite(s[0]) && Number.isFinite(s[1]) && s[1] >= s[0])
    .map((s): TrackSpan => [s[0], s[1]])
    .sort((a, b) => a[0] - b[0]);
  const out: TrackSpan[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span[0] <= last[1] + gap) last[1] = Math.max(last[1], span[1]);
    else out.push(span);
  }
  return out;
}

/**
 * The parts of `wanted` that `covered` does not contain, each shrunk by
 * nothing and widened by nothing: the caller decides the margin. A wanted
 * span is satisfied when a covered span reaches within `tolerance` of both
 * of its ends (one frame at the track's rate, so a trim by a fraction of a
 * frame never re-queues a job).
 */
export function missingSpans(covered: readonly TrackSpan[], wanted: readonly TrackSpan[], tolerance: number): TrackSpan[] {
  const have = mergeSpans(covered);
  const out: TrackSpan[] = [];
  for (const want of mergeSpans(wanted)) {
    let cursor = want[0];
    for (const span of have) {
      if (span[1] < cursor - tolerance) continue;
      if (span[0] > want[1] + tolerance) break;
      if (span[0] > cursor + tolerance) out.push([cursor, Math.min(span[0], want[1])]);
      cursor = Math.max(cursor, span[1]);
      if (cursor >= want[1] - tolerance) break;
    }
    if (cursor < want[1] - tolerance) out.push([cursor, want[1]]);
  }
  return out;
}

/**
 * The end of the span one run settles: the last frame it got, and never
 * before the end that was asked for — a feed that stops early has reached
 * the source's last frame (a probed duration can sit a frame past it), so
 * asking again would loop on a tail that does not exist (met live
 * 2026-09-24: a 39.385 s probe on a source whose last frame is at 39.333 s
 * re-ran the job every second until this rule).
 */
export function settledSpanEnd(wantedEnd: number, start: number, frames: number, fps: number): number {
  return Math.max(wantedEnd, start + Math.max(0, frames - 1) / fps);
}

/** True when every wanted span is inside the covered ones (within `tolerance`). */
export function spansCovered(covered: readonly TrackSpan[], wanted: readonly TrackSpan[], tolerance: number): boolean {
  return missingSpans(covered, wanted, tolerance).length === 0;
}

/**
 * Index of the stored frame nearest to `time` when it lies within half a
 * frame (at the track's rate), else -1 — a gap in a track plays plain rather
 * than borrowing a frame from a second away. `count` frames whose times
 * `timeAt(i)` are sorted ascending. A static track (a still) answers 0 at
 * every time.
 */
export function nearestFrameIndex(count: number, timeAt: (i: number) => number, fps: number, time: number, isStatic = false): number {
  if (count === 0 || !Number.isFinite(time)) return -1;
  if (isStatic) return 0;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timeAt(mid) < time) lo = mid + 1;
    else hi = mid;
  }
  let best = lo;
  if (lo > 0 && Math.abs(timeAt(lo - 1) - time) < Math.abs(timeAt(best) - time)) best = lo - 1;
  // Half a frame plus a hair, so a time that lands exactly between two frames
  // (float rounding on either side) still resolves.
  return Math.abs(timeAt(best) - time) <= 0.5 / fps + 1e-6 ? best : -1;
}

/** Finite, ordered spans from a file's JSON — null when any is malformed (the track is then rebuilt). */
export function parseTrackSpans(raw: unknown): TrackSpan[] | null {
  if (!Array.isArray(raw)) return null;
  const spans: TrackSpan[] = [];
  for (const s of raw) {
    if (!Array.isArray(s) || s.length !== 2) return null;
    const [a, b] = s as unknown[];
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
    spans.push([a, b]);
  }
  return spans;
}

/** Same sampling rate, same still-ness, same model hashes — else a cached track is discarded and rebuilt. */
export function sameTrackRecipe(
  existing: { fps: number; models: Readonly<Record<string, string>>; static?: boolean },
  header: { fps: number; models: Readonly<Record<string, string>>; static?: boolean },
): boolean {
  if (existing.fps !== header.fps || (existing.static ?? false) !== (header.static ?? false)) return false;
  const keys = new Set([...Object.keys(existing.models), ...Object.keys(header.models)]);
  for (const key of keys) if (existing.models[key] !== header.models[key]) return false;
  return true;
}
