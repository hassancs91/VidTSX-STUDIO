import { logEngine } from '../../../logging/log-engine';
import type { LibraryAssetKind } from '../../../shared/types/asset-library';
import type { StudioAssetProbe } from '../../../shared/types/studio';
import { isTimedMediaKind } from '../../../shared/media-kinds';
import { probeMedia } from '../studio/media-import';

const log = logEngine.createLogger('LibraryProbe');

/** A hung ffprobe must never stall the per-root index chain. */
export const LIBRARY_PROBE_TIMEOUT_MS = 15_000;

/**
 * ffprobe one library file (E1: the index's `probe`). Audio and video only —
 * the app's own ffprobe (`probeMedia`, Remotion's binary). Never throws: a
 * failure or a timeout logs a warning and returns undefined (the back-fill
 * tries again later), so an upsert or a scan never fails on a bad file.
 */
export async function probeLibraryFile(
  absPath: string,
  kind: LibraryAssetKind,
): Promise<StudioAssetProbe | undefined> {
  if (!isTimedMediaKind(kind)) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`ffprobe timed out after ${LIBRARY_PROBE_TIMEOUT_MS} ms`)), LIBRARY_PROBE_TIMEOUT_MS);
    });
    return await Promise.race([probeMedia(absPath, kind), timeout]);
  } catch (err) {
    log.warn('Library probe failed', { absPath, error: err instanceof Error ? err.message : String(err) });
    return undefined;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
