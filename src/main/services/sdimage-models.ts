/**
 * sd-cli binary helpers. Model discovery/import/download now live in
 * `sdimage-library.ts` (scan-based, folder-as-truth) and `sdimage-download.ts`
 * (D1 profile downloads). This file only locates the sd-cli binary; the
 * in-app install flow lives in `sdcli-install.ts`.
 */
import { app } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import { getBinariesDir } from '../utils/paths';

/** Where the in-app install flow extracts the full release zip (exe + DLL set). */
export function getSdCliUserDir(): string {
  return path.join(app.getPath('userData'), 'sd-cli');
}

/**
 * The in-app install in userData/sd-cli wins; resources/binaries stays as a
 * dev drop-in fallback (drop the FULL release zip contents there — the exe
 * dynamically loads ggml, so a partial/mixed DLL set fails to start).
 */
export function getSdCliBinaryPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const userPath = path.join(getSdCliUserDir(), `sd-cli${ext}`);
  if (existsSync(userPath)) return userPath;
  return path.join(getBinariesDir(), `sd-cli${ext}`);
}

export function isSdCliInstalled(): boolean {
  return existsSync(getSdCliBinaryPath());
}
