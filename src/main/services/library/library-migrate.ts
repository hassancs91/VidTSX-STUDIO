import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import { LIBRARY_INDEX_REV } from '../../../shared/types/asset-library';
import { getLibraryIndexPath, getLibraryRoot } from './library-paths';
import { backupIndexOnce, parseIndex, serialize, withKinds, writeIndex } from './library-index-io';
import { scheduleProbeBackfill } from './library-backfill';

const log = logEngine.createLogger('LibraryMigrate');

export interface LibraryMigrationResult {
  /** True when this call rewrote the index as rev 2. */
  migrated: boolean;
  /** True when this call wrote `.vidtsx/index.v1-backup.json`. */
  backedUp: boolean;
  /** Entries + tombstones that had no `kind`. */
  kindsFilled: number;
  /** Why nothing was written (no index, unreadable / other version, already current). */
  skipped?: 'no-index' | 'not-v1' | 'current';
}

/**
 * Index v2 migration (E1, T6). An index lacking `rev: 2` (pre-E1, or
 * rewritten since by a pre-E1 app — which drops `rev`) or any entry/tombstone
 * without `kind`: back up the raw pre-migration bytes once (never
 * overwritten), back-fill `kind` from the one extension table, write
 * `version: 1, rev: 2` (E-d5), then start the probe back-fill. Idempotent:
 * rev 2 with every kind → no write. A missing, unreadable or non-v1 index is
 * left alone (no backup, no write). Durations come from the back-fill, not
 * from here — this never blocks on ffprobe.
 */
export async function migrateLibraryIndex(root: string): Promise<LibraryMigrationResult> {
  const result = await serialize(root, async (): Promise<LibraryMigrationResult> => {
    let raw: string;
    try {
      raw = await fs.readFile(getLibraryIndexPath(root), 'utf-8');
    } catch {
      return { migrated: false, backedUp: false, kindsFilled: 0, skipped: 'no-index' };
    }
    const parsed = parseIndex(raw);
    if (!parsed) return { migrated: false, backedUp: false, kindsFilled: 0, skipped: 'not-v1' };
    const kindsFilled =
      parsed.entries.filter((e) => !e.kind).length + parsed.tombstones.filter((t) => !t.kind).length;
    if (parsed.rev === LIBRARY_INDEX_REV && kindsFilled === 0) {
      return { migrated: false, backedUp: false, kindsFilled: 0, skipped: 'current' };
    }
    const backedUp = await backupIndexOnce(root, raw);
    await writeIndex(root, withKinds(parsed));
    log.info('Library index migrated to rev 2', {
      root,
      fromRev: parsed.rev ?? null,
      entries: parsed.entries.length,
      tombstones: parsed.tombstones.length,
      kindsFilled,
      backedUp,
    });
    return { migrated: true, backedUp, kindsFilled };
  });
  void scheduleProbeBackfill(root);
  return result;
}

/** App start (main/index.ts): migrate the effective library root, off the startup path. */
export async function migrateLibraryIndexAtStartup(): Promise<void> {
  try {
    await migrateLibraryIndex(getLibraryRoot());
  } catch (err) {
    log.warn('Library index migration failed', { error: err instanceof Error ? err.message : String(err) });
  }
}
