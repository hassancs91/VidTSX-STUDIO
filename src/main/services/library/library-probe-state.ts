import type { LibraryIndexEntry, LibraryProbeStamp } from '../../../shared/types/asset-library';
import { isTimedMediaKind, mediaKindOf } from '../../../shared/media-kinds';

/**
 * How far one index entry's `probe` can be trusted (E1 fix round 1, verifier V1-4 / V1-5):
 * - `none`    not audio/video — no probe expected
 * - `ok`      a probe measured on this file version (or an unstamped one — trusted)
 * - `stale`   a probe measured on another version (an older app refreshed size/mtime
 *             but kept it), or one without a finite duration > 0 — re-probed by the back-fill
 * - `failed`  ffprobe failed on this very version — not retried until the file changes
 * - `missing` no probe yet — the back-fill gets it
 * Pure: shared by the store, the back-fill and the `list_assets` formatter.
 */
export type LibraryProbeState = 'none' | 'ok' | 'stale' | 'failed' | 'missing';

type ProbeFields = Pick<LibraryIndexEntry, 'relPath' | 'kind' | 'probe' | 'probeStamp' | 'size' | 'mtimeMs'>;

/** The stamp for a probe (or a failed probe) measured on a file of this size + mtime. */
export function makeProbeStamp(file: { size: number; mtimeMs: number }, failed = false): LibraryProbeStamp {
  return failed
    ? { size: file.size, mtimeMs: file.mtimeMs, failed: true }
    : { size: file.size, mtimeMs: file.mtimeMs };
}

function stampFits(e: ProbeFields): boolean {
  const s = e.probeStamp;
  return (
    s !== undefined &&
    (e.size === undefined || s.size === e.size) &&
    (e.mtimeMs === undefined || s.mtimeMs === e.mtimeMs)
  );
}

/**
 * A timed probe is usable only with a finite duration > 0 (fix round 2, verifier V2-1):
 * ffprobe "reads" some broken files (random bytes named `.flac`: rc 0, `duration` N/A)
 * and `probeMedia` makes that 0 s — for the library that is a FAILED probe, never "0.00 s".
 */
export function hasUsableDuration(probe: { duration?: number } | undefined): boolean {
  const d = probe?.duration;
  return typeof d === 'number' && Number.isFinite(d) && d > 0;
}

export function probeStateOf(e: ProbeFields): LibraryProbeState {
  if (!isTimedMediaKind(e.kind ?? mediaKindOf(e.relPath))) return 'none';
  // A 0 s / non-finite probe (written by the fix-round-1 code) is re-probed, never trusted.
  if (e.probe && !hasUsableDuration(e.probe)) return 'stale';
  if (e.probe) return !e.probeStamp || (!e.probeStamp.failed && stampFits(e)) ? 'ok' : 'stale';
  return e.probeStamp?.failed && stampFits(e) ? 'failed' : 'missing';
}

/** Audio/video whose probe is missing or stale — the back-fill's work list. */
export function needsProbe(e: ProbeFields): boolean {
  const state = probeStateOf(e);
  return state === 'missing' || state === 'stale';
}
