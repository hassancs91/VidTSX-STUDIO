import path from 'path';
import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import type { LibraryIndexEntry, LibraryIndexFile } from '../../../shared/types/asset-library';
import { hashFileHead } from '../studio/media-import';
import { reconcileIndex, type DiskFileStat } from './library-reconcile';
import {
  LIBRARY_META_DIR,
  getLibraryIndexPath,
  resolveLibraryPath,
  toLibraryRelPath,
} from './library-paths';
import { invalidateLibrarySizes } from './library-sizes';

const log = logEngine.createLogger('LibraryStore');

const EMPTY_INDEX: LibraryIndexFile = { version: 1, entries: [], tombstones: [] };

/**
 * Index overlay IO + reconcile scan (ASSET_LIBRARY_DESIGN.md L1). All
 * functions take the assets root explicitly — only library-paths.ts knows
 * about settings — so everything here tests against a plain temp dir.
 * Serialized via a per-root promise chain: scans and writes never interleave.
 */
const opChains = new Map<string, Promise<unknown>>();

function serialize<T>(root: string, op: () => Promise<T>): Promise<T> {
  const prev = opChains.get(root) ?? Promise.resolve();
  const next = prev.then(op, op);
  opChains.set(root, next);
  return next;
}

export async function loadIndex(root: string): Promise<LibraryIndexFile> {
  try {
    const raw = await fs.readFile(getLibraryIndexPath(root), 'utf-8');
    const parsed = JSON.parse(raw) as LibraryIndexFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return { ...EMPTY_INDEX };
    return { ...parsed, tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [] };
  } catch {
    return { ...EMPTY_INDEX };
  }
}

/** Atomic write (tmp + rename), mirroring project-store's writeProjectFile. */
async function writeIndex(root: string, index: LibraryIndexFile): Promise<void> {
  const finalPath = getLibraryIndexPath(root);
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  const tmpPath = `${finalPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(index, null, 2), 'utf-8');
  await fs.rename(tmpPath, finalPath);
  invalidateLibrarySizes(root);
}

/** Walk the assets root; skip dot-entries (`.vidtsx`, `.DS_Store`, …). */
async function listDiskFiles(root: string, dir = root): Promise<DiskFileStat[]> {
  const out: DiskFileStat[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listDiskFiles(root, abs)));
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(abs);
        out.push({ relPath: toLibraryRelPath(root, abs), size: stat.size, mtimeMs: stat.mtimeMs });
      } catch {
        // vanished mid-scan — next scan picks it up
      }
    }
  }
  return out;
}

/** Scan disk, reconcile against the stored index, persist, return entries. */
export function scanLibrary(root: string): Promise<LibraryIndexEntry[]> {
  return serialize(root, async () => {
    const index = await loadIndex(root);
    const diskFiles = await listDiskFiles(root);
    const next = await reconcileIndex(
      index,
      diskFiles,
      (relPath) => hashFileHead(resolveLibraryPath(root, relPath)),
      new Date().toISOString()
    );
    await writeIndex(root, next);
    log.debug('Library scan complete', {
      files: diskFiles.length,
      entries: next.entries.length,
      tombstones: next.tombstones.length,
    });
    return next.entries;
  });
}

/** Set (or clear with '') one asset's description. */
export function setDescription(root: string, relPath: string, description: string): Promise<void> {
  return serialize(root, async () => {
    resolveLibraryPath(root, relPath); // traversal guard
    const index = await loadIndex(root);
    const entry = index.entries.find((e) => e.relPath === relPath);
    if (!entry) throw new Error(`Asset not in index: ${relPath}`);
    const trimmed = description.trim();
    entry.description = trimmed === '' ? undefined : trimmed;
    await writeIndex(root, index);
  });
}

/**
 * Relink-by-hash (L7 move-safety rule): find a library file with this
 * content hash. Tries the stored index first; on a miss re-scans once so
 * a move made outside the app (Explorer) still heals. Returns the file's
 * absolute path, or null.
 */
export async function findLibraryFileByHash(root: string, hash: string): Promise<string | null> {
  const fromEntries = (entries: LibraryIndexEntry[]): string | null => {
    const match = entries.find((e) => e.hash === hash);
    return match ? resolveLibraryPath(root, match.relPath) : null;
  };
  const indexed = fromEntries((await loadIndex(root)).entries);
  if (indexed) {
    try {
      await fs.access(indexed);
      return indexed;
    } catch {
      // stale index — fall through to the scan
    }
  }
  return fromEntries(await scanLibrary(root));
}

export { LIBRARY_META_DIR };
