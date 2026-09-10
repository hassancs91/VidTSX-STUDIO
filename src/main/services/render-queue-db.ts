import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type {
  RenderQueueJob,
  RenderQueueJobStatus,
  RenderHistoryEntry,
  RenderCodec,
} from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';
import { isExportEngineId } from '../../shared/studio/export-engines';

const log = logEngine.createLogger('render-queue-db');

let db: Database.Database | null = null;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getRenderQueueDir(): string {
  return path.join(app.getPath('userData'), 'render-queue');
}

function getDbPath(): string {
  return path.join(getRenderQueueDir(), 'render.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getRenderQueueDir(), { recursive: true });
  } catch {
    // mkdir is best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS render_queue (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      bundle_url TEXT,
      composition_id TEXT NOT NULL,
      output_path TEXT NOT NULL,
      codec TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      fps INTEGER NOT NULL,
      crf INTEGER,
      muted INTEGER,
      scale REAL,
      every_nth_frame INTEGER,
      number_of_gif_loops INTEGER,
      input_props TEXT,
      transparent INTEGER,
      cpu_usage TEXT,
      status TEXT NOT NULL,
      progress REAL NOT NULL,
      frames_rendered INTEGER NOT NULL,
      total_frames INTEGER NOT NULL,
      file_size INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_render_queue_created_at ON render_queue(created_at ASC);

    CREATE TABLE IF NOT EXISTS render_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      output_path TEXT NOT NULL,
      completed_at INTEGER NOT NULL,
      file_name TEXT,
      codec TEXT,
      width INTEGER,
      height INTEGER,
      scale REAL,
      file_size INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_render_history_completed_at ON render_history(completed_at DESC);
  `);

  // Studio export engine (docs/export-engines-plan.md): a queued export must
  // keep its engine across a restart, or it would silently render the old way.
  ensureColumn(db, 'render_queue', 'export_engine', 'TEXT');

  return db;
}

function ensureColumn(database: Database.Database, table: string, column: string, type: string): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close render-queue DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

// --- Row mappers ---

interface QueueRow {
  id: string;
  file_name: string;
  file_path: string;
  bundle_url: string | null;
  composition_id: string;
  output_path: string;
  codec: string;
  width: number;
  height: number;
  fps: number;
  crf: number | null;
  muted: number | null;
  scale: number | null;
  every_nth_frame: number | null;
  number_of_gif_loops: number | null;
  input_props: string | null;
  transparent: number | null;
  cpu_usage: string | null;
  export_engine: string | null;
  status: string;
  progress: number;
  frames_rendered: number;
  total_frames: number;
  file_size: number | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

function nullToUndef<T>(v: T | null): T | undefined {
  return v === null ? undefined : v;
}

function parseInputProps(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed
  }
  return undefined;
}

function rowToQueueJob(row: QueueRow): RenderQueueJob {
  return {
    id: row.id,
    fileName: row.file_name,
    filePath: row.file_path,
    bundleUrl: nullToUndef(row.bundle_url),
    compositionId: row.composition_id,
    outputPath: row.output_path,
    codec: row.codec as RenderCodec,
    width: row.width,
    height: row.height,
    fps: row.fps,
    crf: nullToUndef(row.crf),
    muted: row.muted === null ? undefined : row.muted === 1,
    scale: nullToUndef(row.scale),
    everyNthFrame: nullToUndef(row.every_nth_frame),
    numberOfGifLoops: row.number_of_gif_loops,
    inputProps: parseInputProps(row.input_props),
    transparent: row.transparent === null ? undefined : row.transparent === 1,
    cpuUsage: row.cpu_usage,
    exportEngine: isExportEngineId(row.export_engine) ? row.export_engine : undefined,
    status: row.status as RenderQueueJobStatus,
    progress: row.progress,
    framesRendered: row.frames_rendered,
    totalFrames: row.total_frames,
    fileSize: nullToUndef(row.file_size),
    error: nullToUndef(row.error),
    createdAt: row.created_at,
    completedAt: nullToUndef(row.completed_at),
  };
}

interface HistoryRow {
  file_path: string;
  output_path: string;
  completed_at: number;
  file_name: string | null;
  codec: string | null;
  width: number | null;
  height: number | null;
  scale: number | null;
  file_size: number | null;
}

function rowToHistoryEntry(row: HistoryRow): RenderHistoryEntry {
  return {
    filePath: row.file_path,
    outputPath: row.output_path,
    completedAt: row.completed_at,
    fileName: nullToUndef(row.file_name),
    codec: nullToUndef(row.codec),
    width: nullToUndef(row.width),
    height: nullToUndef(row.height),
    scale: nullToUndef(row.scale),
    fileSize: nullToUndef(row.file_size),
  };
}

function boolToInt(v: boolean | undefined): number | null {
  if (v === undefined) return null;
  return v ? 1 : 0;
}

function undefToNull<T>(v: T | undefined): T | null {
  return v === undefined ? null : v;
}

// --- Queue operations ---

/**
 * Replace the entire queue atomically. Mirrors the original JSON "write whole array"
 * semantics the renderer relies on — the context saves its full jobs array whenever
 * it changes and we store exactly what was sent.
 */
export function saveQueueJobs(jobs: RenderQueueJob[]): void {
  const database = getDb();

  const insert = database.prepare(
    `INSERT INTO render_queue
       (id, file_name, file_path, bundle_url, composition_id, output_path,
        codec, width, height, fps, crf, muted, scale, every_nth_frame,
        number_of_gif_loops, input_props, transparent, cpu_usage, export_engine,
        status, progress, frames_rendered, total_frames, file_size, error,
        created_at, completed_at)
     VALUES
       (@id, @fileName, @filePath, @bundleUrl, @compositionId, @outputPath,
        @codec, @width, @height, @fps, @crf, @muted, @scale, @everyNthFrame,
        @numberOfGifLoops, @inputProps, @transparent, @cpuUsage, @exportEngine,
        @status, @progress, @framesRendered, @totalFrames, @fileSize, @error,
        @createdAt, @completedAt)`
  );

  const txn = database.transaction((items: RenderQueueJob[]) => {
    database.prepare('DELETE FROM render_queue').run();
    for (const j of items) {
      insert.run({
        id: j.id,
        fileName: j.fileName,
        filePath: j.filePath,
        bundleUrl: undefToNull(j.bundleUrl),
        compositionId: j.compositionId,
        outputPath: j.outputPath,
        codec: j.codec,
        width: j.width,
        height: j.height,
        fps: j.fps,
        crf: undefToNull(j.crf),
        muted: boolToInt(j.muted),
        scale: undefToNull(j.scale),
        everyNthFrame: undefToNull(j.everyNthFrame),
        numberOfGifLoops: j.numberOfGifLoops ?? null,
        inputProps: j.inputProps ? JSON.stringify(j.inputProps) : null,
        transparent: boolToInt(j.transparent),
        cpuUsage: j.cpuUsage ?? null,
        exportEngine: j.exportEngine ?? null,
        status: j.status,
        progress: j.progress,
        framesRendered: j.framesRendered,
        totalFrames: j.totalFrames,
        fileSize: undefToNull(j.fileSize),
        error: undefToNull(j.error),
        createdAt: j.createdAt,
        completedAt: undefToNull(j.completedAt),
      });
    }
  });
  txn(jobs);
}

/**
 * Load the queue and apply cleanup side-effects:
 *   - any job still marked "rendering" is flipped to "error" (interrupted by last shutdown)
 *   - jobs older than 7 days are deleted
 *
 * Both cleanups are persisted to the DB, matching the original behavior where the
 * next save-from-renderer would have written these transitions back to disk.
 */
export function listQueueJobs(): RenderQueueJob[] {
  const database = getDb();

  const txn = database.transaction(() => {
    database
      .prepare(
        `UPDATE render_queue
           SET status = 'error', error = 'Render was interrupted when the app closed'
         WHERE status = 'rendering'`
      )
      .run();

    const cutoff = Date.now() - SEVEN_DAYS_MS;
    database.prepare('DELETE FROM render_queue WHERE created_at <= ?').run(cutoff);
  });
  txn();

  const rows = database
    .prepare('SELECT * FROM render_queue ORDER BY created_at ASC')
    .all() as QueueRow[];
  return rows.map(rowToQueueJob);
}

/** The saved queue as-is — no interrupted-render rewrite, no age cleanup.
 *  For read-only views (Home's status strip); the renderer's own load path
 *  keeps using `listQueueJobs`. */
export function peekQueueJobs(): RenderQueueJob[] {
  const rows = getDb()
    .prepare('SELECT * FROM render_queue ORDER BY created_at ASC')
    .all() as QueueRow[];
  return rows.map(rowToQueueJob);
}

// --- History operations ---

export function listHistoryEntries(): RenderHistoryEntry[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT file_path, output_path, completed_at, file_name, codec, width, height, scale, file_size
       FROM render_history
       ORDER BY completed_at DESC`
    )
    .all() as HistoryRow[];
  return rows.map(rowToHistoryEntry);
}

export function appendHistoryEntry(entry: RenderHistoryEntry): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO render_history
         (file_path, output_path, completed_at, file_name, codec, width, height, scale, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.filePath,
      entry.outputPath,
      entry.completedAt,
      entry.fileName ?? null,
      entry.codec ?? null,
      entry.width ?? null,
      entry.height ?? null,
      entry.scale ?? null,
      entry.fileSize ?? null
    );
}

export function historyIsEmpty(): boolean {
  const database = getDb();
  const row = database.prepare('SELECT COUNT(*) AS n FROM render_history').get() as { n: number };
  return row.n === 0;
}

/**
 * Seed history from any "done" rows currently in the queue table.
 * Used on first SQLite run when history is still empty but the queue has finished jobs
 * (parity with the legacy seedHistoryFromQueueIfEmpty JSON behavior).
 */
export function seedHistoryFromQueue(): number {
  const database = getDb();
  const result = database
    .prepare(
      `INSERT INTO render_history
         (file_path, output_path, completed_at, file_name, codec, width, height, scale, file_size)
       SELECT file_path, output_path,
              COALESCE(completed_at, created_at) AS completed_at,
              file_name, codec, width, height, scale, file_size
       FROM render_queue
       WHERE status = 'done'
         AND file_path != ''
         AND output_path != ''`
    )
    .run();
  return result.changes;
}
