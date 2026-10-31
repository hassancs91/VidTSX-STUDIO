/**
 * Remove a folder a render used (an export's scratch, a composition probe's temp).
 * After a cancel the killed ffmpeg, compositor or browser can still hold a file,
 * and Windows refuses the delete (EBUSY/EPERM), so this retries for a few
 * seconds, then keeps trying in the background for two minutes.
 */
import fs from 'fs/promises';
import { logEngine } from '../../../../logging/log-engine';

const log = logEngine.createLogger('StudioExportRun');

const QUICK_TRIES = 12;
const QUICK_MS = 500;
const RETRY_MS = 5000;
const RETRY_TRIES = 24;

/** Resolves true when the folder is gone now, false when a background retry took over. */
export async function removeDirWithRetry(
  dir: string,
  what: string,
  context: Record<string, unknown> = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < QUICK_TRIES; attempt++) {
    if (await tryRemove(dir)) return true;
    await new Promise((r) => setTimeout(r, QUICK_MS));
  }
  log.warn(`${what} still locked; retrying in the background`, { ...context, dir });
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    void tryRemove(dir).then((gone) => {
      if (gone) {
        clearInterval(timer);
        log.info(`${what} removed after a retry`, { ...context, dir, tries });
      } else if (tries >= RETRY_TRIES) {
        clearInterval(timer);
        log.warn(`${what} could not be removed`, { ...context, dir });
      }
    });
  }, RETRY_MS);
  timer.unref?.();
  return false;
}

async function tryRemove(dir: string): Promise<boolean> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    return false;
  }
  return fs.access(dir).then(() => false, () => true);
}
