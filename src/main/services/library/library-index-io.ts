import path from 'path';
import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import { LIBRARY_INDEX_REV, type LibraryIndexFile } from '../../../shared/types/asset-library';
import { mediaKindOf } from '../../../shared/media-kinds';
import { getLibraryIndexPath } from './library-paths';
import { invalidateLibrarySizes } from './library-sizes';

const log = logEngine.createLogger('LibraryIndexIO');

/**
 * The library index file's IO (ASSET_LIBRARY_DESIGN.md L1; index v2 = E1).
 * One per-root serialize chain shared by the store, the probe back-fill and
 * the migration, so scans and writes never interleave.
 *
 * Downgrade safety (E-d5): the file stays `version: 1` (the pre-E1 reader
 * empties anything else) and carries `rev: 2`; before the FIRST write per root
 * per process, a pre-E1 index on disk is copied once, raw, to
 * `.vidtsx/index.v1-backup.json` (never overwritten).
 */

export const LIBRARY_INDEX_BACKUP_NAME = 'index.v1-backup.json';

const EMPTY_INDEX: LibraryIndexFile = { version: 1, entries: [], tombstones: [] };

const opChains = new Map<string, Promise<unknown>>();

export function serialize<T>(root: string, op: () => Promise<T>): Promise<T> {
  const prev = opChains.get(root) ?? Promise.resolve();
  const next = prev.then(op, op);
  opChains.set(root, next);
  return next;
}

export function getLibraryIndexBackupPath(root: string): string {
  return path.join(path.dirname(getLibraryIndexPath(root)), LIBRARY_INDEX_BACKUP_NAME);
}

/** Every entry and tombstone gets its `kind` from the one table (no write). */
export function withKinds(index: LibraryIndexFile): LibraryIndexFile {
  return {
    ...index,
    entries: index.entries.map((e) => (e.kind ? e : { ...e, kind: mediaKindOf(e.relPath) })),
    tombstones: index.tombstones.map((t) => (t.kind ? t : { ...t, kind: mediaKindOf(t.relPath) })),
  };
}

/** Parse index bytes; null for anything this code must not rewrite as its own. */
export function parseIndex(raw: string): LibraryIndexFile | null {
  try {
    const parsed = JSON.parse(raw) as LibraryIndexFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return null;
    return { ...parsed, tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [] };
  } catch {
    return null;
  }
}

/** Reads `version: 1` with or without `rev` exactly as before; `kind` derived on read. */
export async function loadIndex(root: string): Promise<LibraryIndexFile> {
  try {
    const parsed = parseIndex(await fs.readFile(getLibraryIndexPath(root), 'utf-8'));
    return withKinds(parsed ?? { ...EMPTY_INDEX });
  } catch {
    return { ...EMPTY_INDEX };
  }
}

/**
 * Copy pre-E1 index bytes to the backup file unless a backup already exists.
 * Returns true when this call wrote it.
 */
export async function backupIndexOnce(root: string, raw: string): Promise<boolean> {
  const backupPath = getLibraryIndexBackupPath(root);
  try {
    await fs.writeFile(backupPath, raw, { encoding: 'utf-8', flag: 'wx' });
    log.info('Backed up the pre-E1 library index', { backupPath, bytes: raw.length });
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  }
}

const backupChecked = new Set<string>();

/** Once per root per process: back up an on-disk index that lacks `rev: 2`. */
async function ensureBackup(root: string): Promise<void> {
  if (backupChecked.has(root)) return;
  let raw: string;
  try {
    raw = await fs.readFile(getLibraryIndexPath(root), 'utf-8');
  } catch {
    backupChecked.add(root); // no index yet — nothing to keep
    return;
  }
  if (parseIndex(raw)?.rev !== LIBRARY_INDEX_REV) await backupIndexOnce(root, raw);
  backupChecked.add(root);
}

/** Atomic write (tmp + rename), mirroring project-store's writeProjectFile. Always `version: 1, rev: 2`. */
export async function writeIndex(root: string, index: LibraryIndexFile): Promise<void> {
  const finalPath = getLibraryIndexPath(root);
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await ensureBackup(root);
  const { version: _v, rev: _r, ...rest } = index;
  const out = { version: 1, rev: LIBRARY_INDEX_REV, ...rest };
  const tmpPath = `${finalPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(out, null, 2), 'utf-8');
  await fs.rename(tmpPath, finalPath);
  invalidateLibrarySizes(root);
}

/**
 * Load → mutate → write, on the root's chain. `mutate` returning `false`
 * skips the write. Resolves with the (possibly mutated) index.
 */
export function updateIndex(
  root: string,
  mutate: (index: LibraryIndexFile) => boolean | void | Promise<boolean | void>,
): Promise<LibraryIndexFile> {
  return serialize(root, async () => {
    const index = await loadIndex(root);
    if ((await mutate(index)) !== false) await writeIndex(root, index);
    return index;
  });
}
