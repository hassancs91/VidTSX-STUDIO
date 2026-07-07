import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type { DownloadTaskState, DownloadStatus, DownloadOptions } from './types';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('download-state-db');

let db: Database.Database | null = null;

const PRUNE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getDownloadsDir(): string {
  return path.join(app.getPath('userData'), 'downloads');
}

function getDbPath(): string {
  return path.join(getDownloadsDir(), 'downloads.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getDownloadsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      dest_path TEXT NOT NULL,
      sha256 TEXT,
      extraction TEXT,
      metadata TEXT,
      priority INTEGER NOT NULL,
      status TEXT NOT NULL,
      downloaded_bytes INTEGER NOT NULL,
      total_bytes INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_downloads_updated_at ON downloads(updated_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close downloads DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

// --- Row mapper ---

interface DownloadRow {
  id: string;
  url: string;
  dest_path: string;
  sha256: string | null;
  extraction: string | null;
  metadata: string | null;
  priority: number;
  status: string;
  downloaded_bytes: number;
  total_bytes: number;
  updated_at: string;
  retry_count: number;
  last_error: string | null;
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function rowToState(row: DownloadRow): DownloadTaskState {
  const options: DownloadOptions = {
    id: row.id,
    url: row.url,
    destPath: row.dest_path,
    priority: row.priority,
  };
  if (row.sha256) options.sha256 = row.sha256;
  const extraction = parseJson<DownloadOptions['extraction']>(row.extraction);
  if (extraction) options.extraction = extraction;
  const metadata = parseJson<Record<string, string>>(row.metadata);
  if (metadata) options.metadata = metadata;

  const state: DownloadTaskState = {
    options,
    status: row.status as DownloadStatus,
    downloadedBytes: row.downloaded_bytes,
    totalBytes: row.total_bytes,
    updatedAt: row.updated_at,
    retryCount: row.retry_count,
  };
  if (row.last_error) state.lastError = row.last_error;
  return state;
}

// --- CRUD ---

/**
 * Load all tasks, dropping completed/cancelled tasks older than 24h as a side
 * effect. Mirrors the legacy behavior where `loadDownloadState()` pruned stale
 * entries during read — we now persist the prune so cleanup survives reads.
 */
export function listStates(): DownloadTaskState[] {
  const database = getDb();
  const cutoffIso = new Date(Date.now() - PRUNE_AGE_MS).toISOString();
  database
    .prepare(
      `DELETE FROM downloads
       WHERE (status = 'completed' OR status = 'cancelled')
         AND updated_at < ?`
    )
    .run(cutoffIso);

  const rows = database
    .prepare('SELECT * FROM downloads ORDER BY updated_at DESC')
    .all() as DownloadRow[];
  return rows.map(rowToState);
}

/**
 * Replace the full set of tasks atomically. Preserves the legacy snapshot
 * semantic where any task removed from the in-memory array is also removed
 * from persistence.
 */
export function replaceAllStates(tasks: DownloadTaskState[]): void {
  const database = getDb();

  const insert = database.prepare(
    `INSERT INTO downloads
       (id, url, dest_path, sha256, extraction, metadata, priority,
        status, downloaded_bytes, total_bytes, updated_at, retry_count, last_error)
     VALUES
       (@id, @url, @destPath, @sha256, @extraction, @metadata, @priority,
        @status, @downloadedBytes, @totalBytes, @updatedAt, @retryCount, @lastError)`
  );

  const txn = database.transaction((snapshot: DownloadTaskState[]) => {
    database.prepare('DELETE FROM downloads').run();
    for (const t of snapshot) {
      insert.run({
        id: t.options.id,
        url: t.options.url,
        destPath: t.options.destPath,
        sha256: t.options.sha256 ?? null,
        extraction: t.options.extraction ? JSON.stringify(t.options.extraction) : null,
        metadata: t.options.metadata ? JSON.stringify(t.options.metadata) : null,
        priority: t.options.priority ?? 0,
        status: t.status,
        downloadedBytes: t.downloadedBytes,
        totalBytes: t.totalBytes,
        updatedAt: t.updatedAt,
        retryCount: t.retryCount,
        lastError: t.lastError ?? null,
      });
    }
  });
  txn(tasks);
}
