import type { LibraryIndexEntry, LibraryProbeStamp } from '../../../shared/types/asset-library';
import { isTimedMediaKind, mediaKindOf } from '../../../shared/media-kinds';

/**
 * How far one index entry's `probe` can be trusted (E1 fix round 1, verifier V1-4 / V1-5):
 * - `none`    not audio/video — no probe expected
 * - `ok`      a probe measured on this file version (or an unstamped one — trusted)
 * - `stale`   a probe measured on another version (an older app refreshed size/mtime
 *             but kept it) — re-probed by the back-fill
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

export function probeStateOf(e: ProbeFields): LibraryProbeState {
  if (!isTimedMediaKind(e.kind ?? mediaKindOf(e.relPath))) return 'none';
  if (e.probe) return !e.probeStamp || (!e.probeStamp.failed && stampFits(e)) ? 'ok' : 'stale';
  return e.probeStamp?.failed && stampFits(e) ? 'failed' : 'missing';
}

/** Audio/video whose probe is missing or stale — the back-fill's work list. */
export function needsProbe(e: ProbeFields): boolean {
  const state = probeStateOf(e);
  return state === 'missing' || state === 'stale';
}
