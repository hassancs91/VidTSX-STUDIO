/**
 * Runs one Remotion call that belongs to no export job — the composition listing
 * after a fresh bundle — in a temp folder of its own, removed when the call settles
 * (part A2). Remotion's `getCompositions` opens a Chrome whose profile
 * (`puppeteer_dev_chrome_profile-*`) it does not delete on Windows: 5.6 MB left in
 * `%TEMP%` per bundle (A2 live run (a), 2026-10-21). The folder sits under the
 * caller's `parent`; one that stayed locked is caught by the background retry, and
 * the startup sweep when `parent` is the export scratch root.
 */
import fs from 'fs/promises';
import path from 'path';
import { withRemotionTempDir } from './remotion-temp-scope';
import { removeDirWithRetry } from './remove-dir-retry';

export async function withOwnRemotionTemp<T>(parent: string, fn: () => Promise<T>): Promise<T> {
  await fs.mkdir(parent, { recursive: true });
  const dir = await fs.mkdtemp(path.join(parent, 'probe-'));
  try {
    return await withRemotionTempDir(dir, fn);
  } finally {
    await removeDirWithRetry(dir, 'Remotion probe folder');
  }
}
