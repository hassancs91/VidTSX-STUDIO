import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { StudioAssetProbe } from '../../../shared/types/studio';
import { isTimedMediaKind } from '../../../shared/media-kinds';
import { getLibraryIndexPath, resolveLibraryPath } from './library-paths';
import { loadIndex, serialize, writeIndex } from './library-index-io';
import { probeLibraryFile } from './library-probe';
import { makeProbeStamp, needsProbe } from './library-probe-state';

const log = logEngine.createLogger('LibraryBackfill');

/**
 * Probe back-fill (E1): audio/video entries without a `probe` — a pre-E1
 * index, a mass drop past the scan's inline budget, a probe that failed on
 * upsert — get one in the background. Off the startup path, deduped per root,
 * small batches with two ffprobes at a time, one index write per batch under
 * the store's chain, and an entry is only patched while its relPath + size +
 * mtime still match what was probed (an edit or a move in between wins).
 * Every result is stamped with the size + mtime it was measured on (fix
 * round 1): a failed probe is not retried until the file changes (across
 * restarts), and a stale probe (an older app kept it across a rewrite) is
 * re-probed.
 */

export const BACKFILL_BATCH = 8;
export const BACKFILL_CONCURRENCY = 2;

export interface BackfillResult {
  /** Timed entries with a missing or stale probe when the pass started. */
  candidates: number;
  probed: number;
  failed: number;
  /** Entries patched into the index (probes and failure stamps). */
  written: number;
  ms: number;
}

interface Probed {
  relPath: string;
  size: number;
  mtimeMs: number;
  /** Undefined = ffprobe failed on this size + mtime. */
  probe: StudioAssetProbe | undefined;
}

const running = new Map<string, Promise<BackfillResult>>();
const rerun = new Set<string>();

/** Undefined when the entry is not timed media or its file is gone. */
async function probeOne(root: string, entry: LibraryIndexEntry): Promise<Probed | undefined> {
  if (!isTimedMediaKind(entry.kind)) return undefined;
  const abs = resolveLibraryPath(root, entry.relPath);
  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    return undefined; // gone — the next scan tombstones it
  }
  const probe = await probeLibraryFile(abs, entry.kind);
  return { relPath: entry.relPath, size: stat.size, mtimeMs: stat.mtimeMs, probe };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Patch probes into the CURRENT index; never recreates a library that is gone. */
function patchProbes(root: string, probed: Probed[]): Promise<number> {
  return serialize(root, async () => {
    try {
      await fs.access(getLibraryIndexPath(root));
    } catch {
      return 0;
    }
    const index = await loadIndex(root);
    let patched = 0;
    for (const p of probed) {
      const e = index.entries.find((x) => x.relPath === p.relPath);
      if (!e || !needsProbe(e)) continue;
      if ((e.size !== undefined && e.size !== p.size) || (e.mtimeMs !== undefined && e.mtimeMs !== p.mtimeMs)) continue;
      if (p.probe) e.probe = p.probe;
      else delete e.probe; // a stale probe that no longer reads is not kept
      e.probeStamp = makeProbeStamp(p, !p.probe);
      patched += 1;
    }
    if (patched > 0) await writeIndex(root, index);
    return patched;
  });
}

async function backfillOnce(root: string): Promise<BackfillResult> {
  const started = Date.now();
  const index = await loadIndex(root);
  const todo = index.entries.filter(needsProbe);
  const result: BackfillResult = { candidates: todo.length, probed: 0, failed: 0, written: 0, ms: 0 };
  for (let i = 0; i < todo.length; i += BACKFILL_BATCH) {
    const batch = todo.slice(i, i + BACKFILL_BATCH);
    const results = await mapLimit(batch, BACKFILL_CONCURRENCY, (e) => probeOne(root, e));
    const measured = results.filter((p): p is Probed => p !== undefined);
    const ok = measured.filter((p) => p.probe !== undefined).length;
    result.probed += ok;
    result.failed += batch.length - ok;
    if (measured.length > 0) result.written += await patchProbes(root, measured);
  }
  result.ms = Date.now() - started;
  if (result.candidates > 0) log.info('Library probe back-fill pass', { root, ...result });
  return result;
}

const sum = (a: BackfillResult, b: BackfillResult): BackfillResult => ({
  candidates: a.candidates + b.candidates,
  probed: a.probed + b.probed,
  failed: a.failed + b.failed,
  written: a.written + b.written,
  ms: a.ms + b.ms,
});

/**
 * Start (or join) the back-fill for one root. A request while a pass runs
 * queues one more pass; the returned promise settles after all of them.
 */
export function scheduleProbeBackfill(root: string): Promise<BackfillResult> {
  const current = running.get(root);
  if (current) {
    rerun.add(root);
    return current;
  }
  const run = (async (): Promise<BackfillResult> => {
    let total: BackfillResult = { candidates: 0, probed: 0, failed: 0, written: 0, ms: 0 };
    do {
      rerun.delete(root);
      total = sum(total, await backfillOnce(root));
    } while (rerun.has(root));
    return total;
  })()
    .catch((err: unknown) => {
      log.warn('Library probe back-fill failed', { root, error: err instanceof Error ? err.message : String(err) });
      return { candidates: 0, probed: 0, failed: 0, written: 0, ms: 0 };
    })
    .finally(() => running.delete(root));
  running.set(root, run);
  return run;
}
