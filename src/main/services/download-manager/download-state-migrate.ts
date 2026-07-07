import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import type { DownloadTaskState, DownloadStatus } from './types';
import { getDb, replaceAllStates } from './download-state-db';

const log = logEngine.createLogger('download-state-migrate');

const VALID_STATUSES: DownloadStatus[] = [
  'queued',
  'downloading',
  'paused',
  'extracting',
  'verifying',
  'completed',
  'failed',
  'cancelled',
];

function legacyStatePath(): string {
  return path.join(app.getPath('userData'), 'downloads.json');
}

function isTaskState(t: unknown): t is DownloadTaskState {
  if (typeof t !== 'object' || t === null) return false;
  const o = t as Record<string, unknown>;
  if (typeof o.status !== 'string' || !VALID_STATUSES.includes(o.status as DownloadStatus)) return false;
  if (typeof o.downloadedBytes !== 'number') return false;
  if (typeof o.totalBytes !== 'number') return false;
  if (typeof o.updatedAt !== 'string') return false;
  if (typeof o.retryCount !== 'number') return false;
  if (typeof o.options !== 'object' || o.options === null) return false;
  const opts = o.options as Record<string, unknown>;
  return (
    typeof opts.id === 'string' &&
    typeof opts.url === 'string' &&
    typeof opts.destPath === 'string'
  );
}

/**
 * One-shot migration. Safe to call on every launch.
 * Imports downloads.json into SQLite when the table is empty, then renames
 * the file to `.backup-{ts}` so we don't reimport.
 */
export async function migrateDownloads(): Promise<void> {
  const filePath = legacyStatePath();

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return; // nothing to import
  }

  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) AS n FROM downloads').get() as { n: number }).n;

  if (count > 0) {
    await backupFile(filePath);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log.error('Legacy downloads.json is not valid JSON — skipping import', err);
    await backupFile(filePath);
    return;
  }

  if (!Array.isArray(parsed)) {
    log.warn('Legacy downloads.json is not an array — skipping');
    await backupFile(filePath);
    return;
  }

  const valid: DownloadTaskState[] = parsed.filter(isTaskState);
  if (valid.length > 0) {
    replaceAllStates(valid);
    log.info('Imported legacy download state into SQLite', { count: valid.length });
  }

  await backupFile(filePath);
}

async function backupFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup-${Date.now()}`;
  try {
    await fs.rename(filePath, backupPath);
  } catch (err) {
    log.warn('Failed to rename legacy downloads.json to backup', {
      filePath,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
