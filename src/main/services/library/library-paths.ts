import path from 'path';
import fs from 'fs/promises';
import { getAssetsDir } from '../../utils/paths';
import { getValue, setValue } from '../settings-db';

/**
 * Assets-root resolution for the library (ASSET_LIBRARY_DESIGN.md L1).
 * Default is the app's existing `userData/assets`; a settings override
 * lets big media libraries live off C:. Moving = move the folder + update
 * the setting — the index travels inside the folder (`.vidtsx/`).
 *
 * The override is read straight from the settings KV store rather than a
 * typed getter in settings.ts — that file is owned by a parallel workstream
 * right now; fold a typed accessor in when it settles.
 */

const ASSETS_ROOT_OVERRIDE_KEY = 'assetsRootOverride';

/** Dot-folder inside the assets root holding the index overlay. */
export const LIBRARY_META_DIR = '.vidtsx';

export function getDefaultLibraryRoot(): string {
  return getAssetsDir();
}

/** Effective assets root: the override when set, else `userData/assets`. */
export function getLibraryRoot(): string {
  const override = getValue<string>(ASSETS_ROOT_OVERRIDE_KEY);
  return override && override.trim() !== '' ? override : getDefaultLibraryRoot();
}

/** Where installed packs live inside the assets root — beside brands/, so they
 *  travel with the library and follow the root override. Caption packs and
 *  transition packs share it (PACKS_DESIGN.md, TRANSITION_PACKS_DESIGN.md). */
export function getInstalledPacksDir(): string {
  return path.join(getLibraryRoot(), 'packs');
}

export function getLibraryRootOverride(): string | undefined {
  return getValue<string>(ASSETS_ROOT_OVERRIDE_KEY);
}

/** Set (absolute path) or clear (null) the assets-root override. */
export function setLibraryRootOverride(root: string | null): void {
  setValue(ASSETS_ROOT_OVERRIDE_KEY, root === null ? undefined : root);
}

export async function ensureLibraryRoot(): Promise<string> {
  const root = getLibraryRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

export function getLibraryIndexPath(root: string): string {
  return path.join(root, LIBRARY_META_DIR, 'index.json');
}

/** POSIX-separator rel path for index keys, regardless of platform. */
export function toLibraryRelPath(root: string, absPath: string): string {
  return path.relative(root, absPath).split(path.sep).join('/');
}

/**
 * The index key of an absolute path that lies UNDER `root`, else null — the
 * root itself, a parent, another drive, and a sibling folder that merely shares
 * the root as a string prefix (`<root>-other\x.mp3`) are all outside. Case-
 * insensitive on Windows (path.relative is), separators normalized to POSIX.
 */
export function libraryRelPathOf(root: string, absPath: string): string | null {
  const rel = path.relative(path.resolve(root), path.resolve(absPath));
  if (rel === '' || path.isAbsolute(rel) || rel === '..' || rel.startsWith(`..${path.sep}`)) {
    return null;
  }
  return rel.split(path.sep).join('/');
}

/** Resolve a library-relative path, refusing anything that escapes the root. */
export function resolveLibraryPath(root: string, relPath: string): string {
  const resolved = path.resolve(root, relPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Path escapes the assets root');
  }
  return resolved;
}
