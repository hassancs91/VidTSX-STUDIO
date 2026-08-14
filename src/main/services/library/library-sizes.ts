import path from 'path';
import fs from 'fs/promises';
import type { LibrarySizes } from '../../../shared/types/asset-library';

/**
 * Per-folder recursive sizes for the assets root (ASSET_LIBRARY_DESIGN.md
 * L4) — the cache-manager scan pattern: computed on demand, cached per
 * root, invalidated whenever the library writes (index writes route
 * through library-store, which calls invalidateLibrarySizes).
 */

const cache = new Map<string, LibrarySizes>();

export function invalidateLibrarySizes(root: string): void {
  cache.delete(root);
}

async function walk(
  root: string,
  dir: string,
  folders: Record<string, number>
): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await walk(root, abs, folders);
    } else if (entry.isFile()) {
      try {
        total += (await fs.stat(abs)).size;
      } catch {
        // vanished mid-scan
      }
    }
  }
  const rel = path.relative(root, dir).split(path.sep).join('/');
  folders[rel] = total; // '' = root
  return total;
}

export async function getLibrarySizes(root: string): Promise<LibrarySizes> {
  const cached = cache.get(root);
  if (cached) return cached;
  const folders: Record<string, number> = {};
  const total = await walk(root, root, folders);
  const sizes: LibrarySizes = { total, folders };
  cache.set(root, sizes);
  return sizes;
}
