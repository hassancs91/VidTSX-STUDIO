import Database from 'better-sqlite3';
import fs from 'fs/promises';
import { mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { ImageStudioEntry, ImageStudioFolder, ReferenceImageEntry } from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';
import { getImagesDir, getReferencesDir, getStudioDir, safeResolvePath } from './image-studio-files';

const log = logEngine.createLogger('image-studio-db');

let db: Database.Database | null = null;

function getDbPath(): string {
  return path.join(getStudioDir(), 'image-studio.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure the studio directory exists before opening the DB file.
  try {
    mkdirSync(getStudioDir(), { recursive: true });
  } catch {
    // mkdir is best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL UNIQUE,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      content_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_images_folder ON images(folder_id);
    CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);

    CREATE TABLE IF NOT EXISTS reference_images (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_refs_created_at ON reference_images(created_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close image-studio DB', { err: err instanceof Error ? err.message : String(err) });
  }
  db = null;
}

// --- Row mappers ---

interface ImageRow {
  id: string;
  file_name: string;
  prompt: string;
  model: string;
  width: number | null;
  height: number | null;
  content_type: string;
  created_at: number;
  duration_ms: number;
  folder_id: string | null;
}

function rowToEntry(row: ImageRow): ImageStudioEntry {
  return {
    id: row.id,
    fileName: row.file_name,
    prompt: row.prompt,
    model: row.model,
    width: row.width,
    height: row.height,
    contentType: row.content_type,
    createdAt: row.created_at,
    durationMs: row.duration_ms,
    folderId: row.folder_id,
  };
}

interface FolderRow {
  id: string;
  name: string;
  created_at: number;
}

function rowToFolder(row: FolderRow): ImageStudioFolder {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

interface RefRow {
  id: string;
  file_name: string;
  original_name: string;
  content_type: string;
  created_at: number;
  enabled: number;
}

function rowToReference(row: RefRow): ReferenceImageEntry {
  return {
    id: row.id,
    fileName: row.file_name,
    originalName: row.original_name,
    contentType: row.content_type,
    createdAt: row.created_at,
    enabled: row.enabled === 1,
  };
}

// --- Image operations ---

function getExtension(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('webp')) return '.webp';
  return '.png';
}

export async function saveImage(
  base64: string,
  metadata: {
    prompt: string;
    model: string;
    width: number;
    height: number;
    contentType: string;
    durationMs: number;
    folderId?: string | null;
  }
): Promise<ImageStudioEntry> {
  await fs.mkdir(getImagesDir(), { recursive: true });

  const id = crypto.randomUUID();
  const ext = getExtension(metadata.contentType);
  const fileName = `img-${Date.now()}-${id.slice(0, 8)}${ext}`;
  const filePath = path.join(getImagesDir(), fileName);

  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(filePath, buffer);

  const database = getDb();

  // Validate folderId exists; fall back to root if not.
  let folderId = metadata.folderId ?? null;
  if (folderId) {
    const exists = database.prepare('SELECT 1 FROM folders WHERE id = ?').get(folderId);
    if (!exists) folderId = null;
  }

  const createdAt = Date.now();
  database
    .prepare(
      `INSERT INTO images (id, file_name, prompt, model, width, height, content_type, created_at, duration_ms, folder_id)
       VALUES (@id, @fileName, @prompt, @model, @width, @height, @contentType, @createdAt, @durationMs, @folderId)`
    )
    .run({
      id,
      fileName,
      prompt: metadata.prompt,
      model: metadata.model,
      width: metadata.width,
      height: metadata.height,
      contentType: metadata.contentType,
      createdAt,
      durationMs: metadata.durationMs,
      folderId,
    });

  return {
    id,
    fileName,
    prompt: metadata.prompt,
    model: metadata.model,
    width: metadata.width,
    height: metadata.height,
    contentType: metadata.contentType,
    createdAt,
    durationMs: metadata.durationMs,
    folderId,
  };
}

export async function listImages(): Promise<{
  entries: ImageStudioEntry[];
  folders: ImageStudioFolder[];
  basePath: string;
}> {
  await fs.mkdir(getImagesDir(), { recursive: true });
  const database = getDb();
  const imageRows = database
    .prepare(
      `SELECT id, file_name, prompt, model, width, height, content_type, created_at, duration_ms, folder_id
       FROM images ORDER BY created_at DESC`
    )
    .all() as ImageRow[];
  const folderRows = database
    .prepare('SELECT id, name, created_at FROM folders ORDER BY created_at DESC')
    .all() as FolderRow[];
  return {
    entries: imageRows.map(rowToEntry),
    folders: folderRows.map(rowToFolder),
    basePath: getImagesDir(),
  };
}

export async function deleteImage(id: string): Promise<void> {
  const database = getDb();
  const row = database.prepare('SELECT file_name FROM images WHERE id = ?').get(id) as
    | { file_name: string }
    | undefined;

  if (row) {
    const filePath = safeResolvePath(getImagesDir(), row.file_name);
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch {
        // File may already be deleted.
      }
    } else {
      log.warn('Blocked path traversal attempt', { fileName: row.file_name });
    }
  }

  database.prepare('DELETE FROM images WHERE id = ?').run(id);
}

export async function getImageBuffer(id: string): Promise<Buffer | null> {
  const database = getDb();
  const row = database.prepare('SELECT file_name FROM images WHERE id = ?').get(id) as
    | { file_name: string }
    | undefined;
  if (!row) return null;
  const filePath = safeResolvePath(getImagesDir(), row.file_name);
  if (!filePath) return null;
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

// --- Folder operations ---

export async function createFolder(name: string): Promise<ImageStudioFolder> {
  const database = getDb();
  const folder: ImageStudioFolder = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: Date.now(),
  };
  database
    .prepare('INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)')
    .run(folder.id, folder.name, folder.createdAt);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const database = getDb();
  const result = database.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name.trim(), id);
  if (result.changes === 0) throw new Error('Folder not found');
}

export async function deleteFolder(id: string, deleteImages: boolean): Promise<void> {
  const database = getDb();

  if (deleteImages) {
    // Collect files first (outside the transaction — fs I/O), then run the DB deletes atomically.
    const rows = database
      .prepare('SELECT file_name FROM images WHERE folder_id = ?')
      .all(id) as { file_name: string }[];

    for (const r of rows) {
      const filePath = safeResolvePath(getImagesDir(), r.file_name);
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch {
          // File may already be deleted.
        }
      }
    }

    const txn = database.transaction(() => {
      database.prepare('DELETE FROM images WHERE folder_id = ?').run(id);
      database.prepare('DELETE FROM folders WHERE id = ?').run(id);
    });
    txn();
  } else {
    // ON DELETE SET NULL takes care of rehoming images when we drop the folder row.
    database.prepare('DELETE FROM folders WHERE id = ?').run(id);
  }
}

export async function moveToFolder(imageIds: string[], folderId: string | null): Promise<void> {
  if (imageIds.length === 0) return;
  const database = getDb();
  const stmt = database.prepare('UPDATE images SET folder_id = ? WHERE id = ?');
  const txn = database.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(folderId, id);
  });
  txn(imageIds);
}

// --- Reference image operations ---

export async function saveReference(
  base64: string,
  originalName: string,
  contentType: string
): Promise<ReferenceImageEntry> {
  await fs.mkdir(getReferencesDir(), { recursive: true });

  const id = crypto.randomUUID();
  const ext = getExtension(contentType);
  const fileName = `ref-${Date.now()}-${id.slice(0, 8)}${ext}`;
  const filePath = path.join(getReferencesDir(), fileName);

  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(filePath, buffer);

  const createdAt = Date.now();
  const database = getDb();
  database
    .prepare(
      `INSERT INTO reference_images (id, file_name, original_name, content_type, created_at, enabled)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(id, fileName, originalName, contentType, createdAt);

  return { id, fileName, originalName, contentType, createdAt, enabled: true };
}

export async function listReferences(): Promise<ReferenceImageEntry[]> {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT id, file_name, original_name, content_type, created_at, enabled
       FROM reference_images ORDER BY created_at DESC`
    )
    .all() as RefRow[];
  return rows.map(rowToReference);
}

export async function deleteReference(id: string): Promise<void> {
  const database = getDb();
  const row = database
    .prepare('SELECT file_name FROM reference_images WHERE id = ?')
    .get(id) as { file_name: string } | undefined;
  if (!row) return;

  const filePath = safeResolvePath(getReferencesDir(), row.file_name);
  if (filePath) {
    try {
      await fs.unlink(filePath);
    } catch {
      // File may already be deleted.
    }
  }

  database.prepare('DELETE FROM reference_images WHERE id = ?').run(id);
}

export async function toggleReference(id: string, enabled: boolean): Promise<void> {
  const database = getDb();
  const result = database
    .prepare('UPDATE reference_images SET enabled = ? WHERE id = ?')
    .run(enabled ? 1 : 0, id);
  if (result.changes === 0) throw new Error(`Reference image not found: ${id}`);
}

export async function readReferenceBuffer(id: string): Promise<Buffer> {
  const database = getDb();
  const row = database
    .prepare('SELECT file_name FROM reference_images WHERE id = ?')
    .get(id) as { file_name: string } | undefined;
  if (!row) throw new Error(`Reference image not found: ${id}`);
  const filePath = safeResolvePath(getReferencesDir(), row.file_name);
  if (!filePath) throw new Error(`Invalid reference path: ${row.file_name}`);
  return fs.readFile(filePath);
}
