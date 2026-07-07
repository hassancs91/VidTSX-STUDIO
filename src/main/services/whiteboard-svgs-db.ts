import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type {
  AssetCategory,
  RevealMode,
  UserSvgAsset,
  UserSvgSource,
} from '../../shared/types/whiteboard';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('whiteboard-svgs-db');

let db: Database.Database | null = null;

export function getWhiteboardSvgsDir(): string {
  return path.join(app.getPath('userData'), 'whiteboard-svgs');
}

function getDbPath(): string {
  return path.join(getWhiteboardSvgsDir(), 'svgs.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getWhiteboardSvgsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_svgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      paths_json TEXT NOT NULL,
      viewbox TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_svgs_created_at ON user_svgs(created_at DESC);
  `);

  // Phase 12 — add `source_image_id` column for vectorized SVGs that point
  // back at the originating raster row. Idempotent: skip when already present.
  const cols = db.prepare("PRAGMA table_info('user_svgs')").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'source_image_id')) {
    db.exec('ALTER TABLE user_svgs ADD COLUMN source_image_id TEXT');
  }

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close whiteboard-svgs DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

interface UserSvgRow {
  id: string;
  name: string;
  paths_json: string;
  viewbox: string;
  source: string;
  created_at: number;
  source_image_id: string | null;
}

// User SVGs render through the LibraryAsset pipeline but the My-SVGs tab is
// flat (no category UI), so all uploads materialize as `objects`. Reveal mode
// is always `draw` for now — non-draw reveals land in a later phase.
const DEFAULT_CATEGORY: AssetCategory = 'objects';
const DEFAULT_REVEAL: RevealMode = 'draw';

function rowToAsset(row: UserSvgRow): UserSvgAsset {
  let paths: string[];
  try {
    const parsed = JSON.parse(row.paths_json) as unknown;
    paths = Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch (err) {
    log.warn('Malformed paths JSON in user SVG row; returning empty paths', {
      id: row.id,
      err: err instanceof Error ? err.message : String(err),
    });
    paths = [];
  }
  return {
    id: row.id,
    name: row.name,
    paths,
    viewBox: row.viewbox,
    revealMode: DEFAULT_REVEAL,
    category: DEFAULT_CATEGORY,
    source: row.source as UserSvgSource,
    createdAt: row.created_at,
    ...(row.source_image_id ? { sourceImageId: row.source_image_id } : {}),
  };
}

export async function listUserSvgs(): Promise<UserSvgAsset[]> {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM user_svgs ORDER BY created_at DESC')
    .all() as UserSvgRow[];
  return rows.map(rowToAsset);
}

export async function saveUserSvg(asset: UserSvgAsset): Promise<void> {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO user_svgs
         (id, name, paths_json, viewbox, source, created_at, source_image_id)
       VALUES
         (@id, @name, @pathsJson, @viewbox, @source, @createdAt, @sourceImageId)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         paths_json = excluded.paths_json,
         viewbox = excluded.viewbox,
         source = excluded.source,
         source_image_id = excluded.source_image_id`
    )
    .run({
      id: asset.id,
      name: asset.name,
      pathsJson: JSON.stringify(asset.paths),
      viewbox: asset.viewBox,
      source: asset.source,
      createdAt: asset.createdAt,
      sourceImageId: asset.sourceImageId ?? null,
    });
}

export async function deleteUserSvg(id: string): Promise<void> {
  const database = getDb();
  database.prepare('DELETE FROM user_svgs WHERE id = ?').run(id);
}
