import path from 'path';
import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import type {
  LibraryAssetKind,
  LibraryAssetOrigin,
  LibraryAudioMeta,
  LibraryIndexEntry,
} from '../../../shared/types/asset-library';
import { isTimedMediaKind, mediaKindOf } from '../../../shared/media-kinds';
import { hashFileHead } from '../studio/media-import';
import { reconcileIndex, type DiskFileStat, type ProbeOf } from './library-reconcile';
import { LIBRARY_META_DIR, resolveLibraryPath, toLibraryRelPath } from './library-paths';
import { loadIndex, serialize, writeIndex } from './library-index-io';
import { probeLibraryFile } from './library-probe';
import { scheduleProbeBackfill } from './library-backfill';

const log = logEngine.createLogger('LibraryStore');

/**
 * Index overlay scan + writes (ASSET_LIBRARY_DESIGN.md L1; the file IO and
 * the per-root serialize chain live in library-index-io.ts). All functions
 * take the assets root explicitly — only library-paths.ts knows about
 * settings — so everything here tests against a plain temp dir.
 */

/** ffprobe calls one scan makes inline; the rest go to the back-fill (E1). */
export const SCAN_PROBE_BUDGET = 20;

function budgetedProber(root: string): ProbeOf {
  let left = SCAN_PROBE_BUDGET;
  return async (relPath: string, kind: LibraryAssetKind) => {
    if (!isTimedMediaKind(kind) || left <= 0) return undefined;
    left -= 1;
    return probeLibraryFile(resolveLibraryPath(root, relPath), kind);
  };
}

/** A timed entry still lacking a probe → the back-fill catches up, off this chain. */
function kickBackfillIfNeeded(root: string, entries: LibraryIndexEntry[]): void {
  if (entries.some((e) => isTimedMediaKind(e.kind) && !e.probe)) void scheduleProbeBackfill(root);
}

/**
 * A composition's files folder (`promo.assets/` beside `promo.tsx`, P3 part 4):
 * part of that composition, not library items of its own.
 */
function isCompositionAssetsDir(name: string, siblings: Set<string>): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.assets') && siblings.has(`${lower.slice(0, -'.assets'.length)}.tsx`);
}

/** Walk the assets root; skip dot-entries (`.vidtsx`, `.DS_Store`, …) and compositions' `.assets/` folders. */
async function listDiskFiles(root: string, dir = root): Promise<DiskFileStat[]> {
  const out: DiskFileStat[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  const names = new Set(entries.map((e) => e.name.toLowerCase()));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory() && isCompositionAssetsDir(entry.name, names)) continue;
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

/**
 * Scan disk, reconcile against the stored index, persist, return entries.
 * Edited and new audio/video files are probed inline up to
 * SCAN_PROBE_BUDGET; the back-fill fills the rest in the background.
 */
export function scanLibrary(root: string): Promise<LibraryIndexEntry[]> {
  return serialize(root, async () => {
    const index = await loadIndex(root);
    const diskFiles = await listDiskFiles(root);
    const next = await reconcileIndex(
      index,
      diskFiles,
      (relPath) => hashFileHead(resolveLibraryPath(root, relPath)),
      new Date().toISOString(),
      budgetedProber(root)
    );
    await writeIndex(root, next);
    kickBackfillIfNeeded(root, next.entries);
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
 * Register a file that was just written into the library as born-managed
 * content (D12: `generated` / `captured`). The reconcile scan only ever mints
 * `origin: 'imported'` entries, so files the app creates must enter the index
 * here — with the origin, description, and brand tag they are born with, and
 * the hash/size/mtime bookkeeping that keeps the next scan from re-keying
 * them. Updates in place if the relPath is already indexed.
 *
 * E1: also writes `kind` and, for audio/video, `probe` — ffprobe runs BEFORE
 * the chain so a slow probe never holds other index ops; a failed probe keeps
 * the old one only when the file is unchanged, else the back-fill retries.
 * `tags` / `audio` pass through (filled by E2 / E4).
 */
export async function upsertEntry(
  root: string,
  relPath: string,
  meta: {
    origin: LibraryAssetOrigin;
    description?: string;
    brandId?: string;
    tags?: string[];
    audio?: LibraryAudioMeta;
  },
): Promise<LibraryIndexEntry> {
  const absPath = resolveLibraryPath(root, relPath); // traversal guard
  const kind = mediaKindOf(relPath);
  const probe = await probeLibraryFile(absPath, kind);
  const result = await serialize(root, async () => {
    const stat = await fs.stat(absPath); // throws if the file is not on disk
    const hash = await hashFileHead(absPath);
    const index = await loadIndex(root);
    const existing = index.entries.find((e) => e.relPath === relPath);
    const sameFile = existing?.size === stat.size && existing?.mtimeMs === stat.mtimeMs;
    const entry: LibraryIndexEntry = {
      ...(existing ?? { addedAt: new Date().toISOString() }),
      relPath,
      origin: meta.origin,
      kind,
      probe: probe ?? (sameFile ? existing?.probe : undefined),
      ...(hash !== undefined ? { hash } : {}),
      ...(meta.description !== undefined ? { description: meta.description } : {}),
      ...(meta.brandId !== undefined ? { brandId: meta.brandId } : {}),
      ...(meta.tags !== undefined ? { tags: meta.tags } : {}),
      ...(meta.audio !== undefined ? { audio: meta.audio } : {}),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
    if (existing) {
      index.entries[index.entries.indexOf(existing)] = entry;
    } else {
      index.entries.push(entry);
      index.entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
    }
    // The file exists again — a tombstone for this path is stale.
    index.tombstones = index.tombstones.filter((t) => t.relPath !== relPath);
    await writeIndex(root, index);
    return entry;
  });
  kickBackfillIfNeeded(root, [result]);
  return result;
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

export { LIBRARY_META_DIR, loadIndex };
