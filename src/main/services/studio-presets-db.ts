import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type { StudioPreset } from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('studio-presets-db');

let db: Database.Database | null = null;

export function getStudioPresetsDir(): string {
  return path.join(app.getPath('userData'), 'studio-presets');
}

function getDbPath(): string {
  return path.join(getStudioPresetsDir(), 'studio-presets.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getStudioPresetsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_studio_presets_updated_at ON studio_presets(updated_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close studio-presets DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

interface PresetRow {
  id: string;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
}

function rowToPreset(row: PresetRow): StudioPreset {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPresets(): Promise<StudioPreset[]> {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM studio_presets ORDER BY updated_at DESC')
    .all() as PresetRow[];
  return rows.map(rowToPreset);
}

export async function savePreset(preset: StudioPreset): Promise<void> {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO studio_presets (id, name, content, created_at, updated_at)
       VALUES (@id, @name, @content, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         content = excluded.content,
         updated_at = excluded.updated_at`
    )
    .run({
      id: preset.id,
      name: preset.name,
      content: preset.content,
      createdAt: preset.createdAt,
      updatedAt: preset.updatedAt,
    });
}

export async function deletePreset(id: string): Promise<void> {
  const database = getDb();
  database.prepare('DELETE FROM studio_presets WHERE id = ?').run(id);
}
