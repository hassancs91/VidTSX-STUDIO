/**
 * sd-cli binary helpers. Model discovery/import/download now live in
 * `sdimage-library.ts` (scan-based, folder-as-truth) and `sdimage-download.ts`
 * (D1 profile downloads). This file only locates the bundled sd-cli binary.
 */
import { existsSync } from 'fs';
import path from 'path';
import { getBinariesDir } from '../utils/paths';

/**
 * sd-cli is bundled in resources/binaries/sd-cli.exe (Windows) or
 * resources/binaries/sd-cli (macOS/Linux). It also requires
 * stable-diffusion.dll alongside it.
 */
export function getSdCliBinaryPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(getBinariesDir(), `sd-cli${ext}`);
}

export function isSdCliInstalled(): boolean {
  return existsSync(getSdCliBinaryPath());
}
