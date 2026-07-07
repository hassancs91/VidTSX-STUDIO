import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('whiteboard-images-db');

let db: Database.Database | null = null;

export function getWhiteboardImagesDir(): string {
  return path.join(app.getPath('userData'), 'whiteboard-images');
}

export function getWhiteboardImagesFilesDir(): string {
  return path.join(getWhiteboardImagesDir(), 'files');
}

function getDbPath(): string {
  return path.join(getWhiteboardImagesDir(), 'images.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getWhiteboardImagesDir(), { recursive: true });
    mkdirSync(getWhiteboardImagesFilesDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_images (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_images_created_at ON user_images(created_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close whiteboard-images DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

export interface UserImageRecord {
  id: string;
  name: string;
  filePath: string;
  width: number;
  height: number;
  source: 'upload' | 'ai-generated';
  createdAt: number;
}

interface UserImageRow {
  id: string;
  name: string;
  file_path: string;
  width: number;
  height: number;
  source: string;
  created_at: number;
}

function rowToRecord(row: UserImageRow): UserImageRecord {
  return {
    id: row.id,
    name: row.name,
    filePath: row.file_path,
    width: row.width,
    height: row.height,
    source: (row.source === 'ai-generated' ? 'ai-generated' : 'upload') as UserImageRecord['source'],
    createdAt: row.created_at,
  };
}

const SAFE_EXT = /^[A-Za-z0-9]{1,10}$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Write a binary blob into the controlled image directory, returning the
 * resolved file path. Validates `id` and `ext` to prevent path traversal.
 */
export function saveBinary(id: string, ext: string, data: Uint8Array): string {
  if (!SAFE_ID.test(id)) {
    throw new Error(`Invalid image id: ${id}`);
  }
  const cleanExt = ext.replace(/^\.+/, '').toLowerCase();
  if (!SAFE_EXT.test(cleanExt)) {
    throw new Error(`Invalid image extension: ${ext}`);
  }
  mkdirSync(getWhiteboardImagesFilesDir(), { recursive: true });
  const filePath = path.join(getWhiteboardImagesFilesDir(), `${id}.${cleanExt}`);
  writeFileSync(filePath, data);
  return filePath;
}

export async function listUserImages(): Promise<UserImageRecord[]> {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM user_images ORDER BY created_at DESC')
    .all() as UserImageRow[];
  return rows.map(rowToRecord);
}

export async function saveUserImage(record: UserImageRecord): Promise<void> {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO user_images
         (id, name, file_path, width, height, source, created_at)
       VALUES
         (@id, @name, @filePath, @width, @height, @source, @createdAt)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         file_path = excluded.file_path,
         width = excluded.width,
         height = excluded.height,
         source = excluded.source`
    )
    .run({
      id: record.id,
      name: record.name,
      filePath: record.filePath,
      width: record.width,
      height: record.height,
      source: record.source,
      createdAt: record.createdAt,
    });
}

export async function deleteUserImage(id: string): Promise<void> {
  const database = getDb();
  const row = database
    .prepare('SELECT file_path FROM user_images WHERE id = ?')
    .get(id) as { file_path: string } | undefined;
  database.prepare('DELETE FROM user_images WHERE id = ?').run(id);
  if (row?.file_path) {
    try {
      const dir = getWhiteboardImagesFilesDir();
      const resolved = path.resolve(row.file_path);
      // Only unlink files that live inside the controlled directory.
      if (resolved.startsWith(path.resolve(dir))) {
        unlinkSync(resolved);
      }
    } catch (err) {
      log.warn('Failed to remove user image file; row deleted', {
        id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function getUserImagePath(id: string): string | null {
  if (!SAFE_ID.test(id)) return null;
  const database = getDb();
  const row = database
    .prepare('SELECT file_path FROM user_images WHERE id = ?')
    .get(id) as { file_path: string } | undefined;
  if (!row) return null;
  const dir = path.resolve(getWhiteboardImagesFilesDir());
  const resolved = path.resolve(row.file_path);
  if (!resolved.startsWith(dir)) return null;
  return resolved;
}
