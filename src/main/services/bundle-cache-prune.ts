// Pruning `<userData>/bundle-cache` (TSX_BUILDER_DESIGN.md P2 part 5, Hasan's
// pick 10-13: "run end + 7 days"). Every webpack bundle is a folder there
// (~10-25 MB with its source map) and nothing deleted them: 320 MB in a real
// profile, ~54 MB per builder run. Two rules:
// - a builder run deletes the bundles of its own looks when it ends
//   (remotion-bundler.ts `releaseBundlesUnder`);
// - at app start, folders unused for 7 days go, except one a saved
//   render-queue job still points at (`bundleUrl`). A cache hit touches its
//   folder, so "unused" is the folder's mtime.
// After a restart no folder is ever reused (the in-memory map that finds them
// is empty and a new bundle gets a new id), so the 7 days are a margin, not a
// cache. Pre-v2 `bundle-*` folders can never be served and go by the same rule.
//
// No electron in here: the caller passes the folder and the ids to keep.

import fs from 'fs/promises';
import path from 'path';

export const BUNDLE_UNUSED_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export interface BundleFolder {
  name: string;
  mtimeMs: number;
}

/** The folders to delete: unused for longer than `maxAgeMs`, and not in `keep`. */
export function staleBundleFolders(
  folders: readonly BundleFolder[],
  options: { now: number; maxAgeMs?: number; keep?: ReadonlySet<string> },
): string[] {
  const maxAge = options.maxAgeMs ?? BUNDLE_UNUSED_MAX_MS;
  return folders
    .filter((f) => options.now - f.mtimeMs > maxAge && !options.keep?.has(f.name))
    .map((f) => f.name);
}

/** Delete the stale folders of `dir` (folders only; a missing `dir` is nothing to do). */
export async function pruneBundleFolders(
  dir: string,
  options: { now?: number; maxAgeMs?: number; keep?: ReadonlySet<string> } = {},
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const folders: BundleFolder[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const stat = await fs.stat(path.join(dir, entry.name)).catch(() => null);
    if (stat) folders.push({ name: entry.name, mtimeMs: stat.mtimeMs });
  }
  const stale = staleBundleFolders(folders, { now: options.now ?? Date.now(), ...options });
  const removed: string[] = [];
  for (const name of stale) {
    try {
      await fs.rm(path.join(dir, name), { recursive: true, force: true });
      removed.push(name);
    } catch {
      /* in use or locked: the next start tries again */
    }
  }
  return removed;
}

/** A bundle made this app run: its entry file and its folder. */
export interface MadeBundle {
  entryFilePath: string;
  bundlePath: string;
}

/**
 * The ids of the bundles made from an entry inside `dir`. Every bundle counts,
 * not only the newest per entry: a look re-bundles the same entry path for each
 * new build, and the older folders are still on disk.
 */
export function bundlesMadeInside(made: ReadonlyMap<string, MadeBundle>, dir: string): string[] {
  return [...made].filter(([, bundle]) => isPathInside(bundle.entryFilePath, dir)).map(([id]) => id);
}

/** True when `file` is inside `dir` (or is `dir`), compared case-insensitively on Windows. */
export function isPathInside(file: string, dir: string): boolean {
  const norm = (p: string) => {
    const resolved = path.resolve(p);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  const rel = path.relative(norm(dir), norm(file));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
