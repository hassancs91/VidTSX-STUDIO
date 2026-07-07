import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import type {
  RenderCodec,
  RenderHistoryEntry,
  RenderQueueJob,
  RenderQueueJobStatus,
} from '../../shared/ipc/types';
import { getDb, historyIsEmpty, seedHistoryFromQueue } from './render-queue-db';

const log = logEngine.createLogger('render-queue-migrate');

const VALID_STATUSES: RenderQueueJobStatus[] = [
  'queued',
  'rendering',
  'done',
  'error',
  'cancelled',
];

function legacyQueuePath(): string {
  return path.join(app.getPath('userData'), 'render-queue.json');
}

function legacyHistoryPath(): string {
  return path.join(app.getPath('userData'), 'render-history.json');
}

function isQueueJob(j: unknown): j is RenderQueueJob {
  if (typeof j !== 'object' || j === null) return false;
  const o = j as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.fileName === 'string' &&
    typeof o.filePath === 'string' &&
    typeof o.compositionId === 'string' &&
    typeof o.outputPath === 'string' &&
    typeof o.codec === 'string' &&
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    typeof o.fps === 'number' &&
    typeof o.status === 'string' &&
    VALID_STATUSES.includes(o.status as RenderQueueJobStatus) &&
    typeof o.progress === 'number' &&
    typeof o.framesRendered === 'number' &&
    typeof o.totalFrames === 'number' &&
    typeof o.createdAt === 'number'
  );
}

function isHistoryEntry(e: unknown): e is RenderHistoryEntry {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.filePath === 'string' &&
    typeof o.outputPath === 'string' &&
    typeof o.completedAt === 'number'
  );
}

/**
 * Import legacy render-queue.json + render-history.json into SQLite.
 * Safe to call on every launch — only imports when the corresponding table is empty,
 * then renames the JSON files to `.backup-{ts}` so they won't be reimported.
 */
export async function migrateRenderQueue(): Promise<void> {
  const db = getDb();

  await importQueue(db);
  await importHistory(db);
}

async function importQueue(db: import('better-sqlite3').Database): Promise<void> {
  const filePath = legacyQueuePath();

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return; // nothing to import
  }

  const queueCount = (
    db.prepare('SELECT COUNT(*) AS n FROM render_queue').get() as { n: number }
  ).n;

  if (queueCount > 0) {
    // DB already populated; just retire the legacy file so we don't reimport.
    await backupFile(filePath);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.error('Legacy render-queue.json is not valid JSON — skipping import', err);
    await backupFile(filePath);
    return;
  }

  const jobs: RenderQueueJob[] = Array.isArray(parsed) ? parsed.filter(isQueueJob) : [];

  if (jobs.length === 0) {
    await backupFile(filePath);
    return;
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO render_queue
       (id, file_name, file_path, bundle_url, composition_id, output_path,
        codec, width, height, fps, crf, muted, scale, every_nth_frame,
        number_of_gif_loops, input_props, transparent, cpu_usage,
        status, progress, frames_rendered, total_frames, file_size, error,
        created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const txn = db.transaction(() => {
    for (const j of jobs) {
      insert.run(
        j.id,
        j.fileName,
        j.filePath,
        j.bundleUrl ?? null,
        j.compositionId,
        j.outputPath,
        j.codec as RenderCodec,
        j.width,
        j.height,
        j.fps,
        j.crf ?? null,
        j.muted === undefined ? null : j.muted ? 1 : 0,
        j.scale ?? null,
        j.everyNthFrame ?? null,
        j.numberOfGifLoops ?? null,
        j.inputProps ? JSON.stringify(j.inputProps) : null,
        j.transparent === undefined ? null : j.transparent ? 1 : 0,
        j.cpuUsage ?? null,
        j.status,
        j.progress,
        j.framesRendered,
        j.totalFrames,
        j.fileSize ?? null,
        j.error ?? null,
        j.createdAt,
        j.completedAt ?? null
      );
    }
  });
  txn();

  log.info('Imported legacy render queue into SQLite', { count: jobs.length });

  await backupFile(filePath);
}

async function importHistory(db: import('better-sqlite3').Database): Promise<void> {
  const filePath = legacyHistoryPath();

  let raw: string | null = null;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    // no history file — fall through to the seed-from-queue fallback
  }

  if (!historyIsEmpty()) {
    if (raw !== null) await backupFile(filePath);
    return;
  }

  if (raw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      log.error('Legacy render-history.json is not valid JSON — skipping import', err);
      await backupFile(filePath);
      parsed = [];
    }

    const entries: RenderHistoryEntry[] = Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];

    if (entries.length > 0) {
      const insert = db.prepare(
        `INSERT INTO render_history
           (file_path, output_path, completed_at, file_name, codec, width, height, scale, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const txn = db.transaction(() => {
        for (const e of entries) {
          insert.run(
            e.filePath,
            e.outputPath,
            e.completedAt,
            e.fileName ?? null,
            e.codec ?? null,
            e.width ?? null,
            e.height ?? null,
            e.scale ?? null,
            e.fileSize ?? null
          );
        }
      });
      txn();
      log.info('Imported legacy render history into SQLite', { count: entries.length });
    }

    await backupFile(filePath);
  }

  // Parity with the legacy seedHistoryFromQueueIfEmpty: if history is still empty but
  // the queue has completed jobs (imported just now, or present from a previous run),
  // seed those into history once.
  if (historyIsEmpty()) {
    const seeded = seedHistoryFromQueue();
    if (seeded > 0) {
      log.info('Seeded render history from completed queue jobs', { count: seeded });
    }
  }
}

async function backupFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.rename(filePath, backupPath);
  } catch (err) {
    log.warn('Failed to rename legacy render file to backup', {
      filePath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
