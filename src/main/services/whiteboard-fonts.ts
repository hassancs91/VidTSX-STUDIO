import { app } from 'electron';
import { existsSync } from 'fs';
import path from 'path';

const SAFE_FONT_ID = /^[a-z0-9-]{1,30}$/;

export function getFontsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'fonts');
  }
  // Dev: anchor on app.getAppPath() (the project root) instead of __dirname,
  // because electron-vite may chunk this module under out/main/chunks/ where
  // __dirname-based relative paths land in the wrong place.
  return path.join(app.getAppPath(), 'resources/fonts');
}

/**
 * Resolve a bundled handwriting font id (e.g. `caveat`) to its on-disk
 * `.ttf` path. Returns `null` for unknown ids, malformed ids, or paths
 * that escape the controlled fonts directory.
 */
export function getBundledFontPath(id: string): string | null {
  if (!SAFE_FONT_ID.test(id)) return null;
  const dir = path.resolve(getFontsDir());
  const candidate = path.resolve(path.join(dir, `${id}.ttf`));
  if (!candidate.startsWith(dir)) return null;
  if (!existsSync(candidate)) return null;
  return candidate;
}
