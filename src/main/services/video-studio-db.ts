import Database from 'better-sqlite3';
import fs from 'fs/promises';
import { mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { VideoStudioEntry, VideoStudioFolder } from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';
import {
  getStudioDir,
  getVideosDir,
  getThumbnailsDir,
  safeResolvePath,
} from './video-studio-files';

const log = logEngine.createLogger('video-studio-db');

let db: Database.Database | null = null;

function getDbPath(): string {
  return path.join(getStudioDir(), 'video-studio.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getStudioDir(), { recursive: true });
  } catch {
    // best-effort; Database() will surface a real failure
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

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL UNIQUE,
      thumbnail_file_name TEXT,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      aspect_ratio TEXT,
      duration_seconds REAL,
      has_audio INTEGER NOT NULL DEFAULT 0,
      size_bytes INTEGER,
      content_type TEXT NOT NULL DEFAULT 'video/mp4',
      credits_consumed INTEGER,
      source_url TEXT,
      created_at INTEGER NOT NULL,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_videos_folder ON videos(folder_id);
    CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close video-studio DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

// --- Row mappers ---

interface VideoRow {
  id: string;
  file_name: string;
  thumbnail_file_name: string | null;
  prompt: string;
  model: string;
  aspect_ratio: string | null;
  duration_seconds: number | null;
  has_audio: number;
  size_bytes: number | null;
  content_type: string;
  credits_consumed: number | null;
  source_url: string | null;
  created_at: number;
  folder_id: string | null;
}

function rowToEntry(row: VideoRow): VideoStudioEntry {
  return {
    id: row.id,
    fileName: row.file_name,
    thumbnailFileName: row.thumbnail_file_name,
    prompt: row.prompt,
    model: row.model,
    aspectRatio: row.aspect_ratio,
    durationSeconds: row.duration_seconds,
    hasAudio: row.has_audio === 1,
    sizeBytes: row.size_bytes,
    contentType: row.content_type,
    creditsConsumed: row.credits_consumed,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    folderId: row.folder_id,
  };
}

interface FolderRow {
  id: string;
  name: string;
  created_at: number;
}

function rowToFolder(row: FolderRow): VideoStudioFolder {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

// --- Video operations ---

function extensionFromContentType(contentType: string): string {
  if (contentType === 'video/webm') return '.webm';
  if (contentType === 'video/quicktime' || contentType === 'video/mov') return '.mov';
  return '.mp4';
}

export interface SaveVideoInput {
  bytes: Buffer;
  prompt: string;
  model: string;
  aspectRatio?: string | null;
  durationSeconds?: number | null;
  hasAudio?: boolean;
  contentType?: string;
  creditsConsumed?: number | null;
  sourceUrl?: string | null;
  folderId?: string | null;
}

export async function saveVideo(input: SaveVideoInput): Promise<VideoStudioEntry> {
  await fs.mkdir(getVideosDir(), { recursive: true });

  const id = crypto.randomUUID();
  const contentType = input.contentType || 'video/mp4';
  const ext = extensionFromContentType(contentType);
  const fileName = `vid-${Date.now()}-${id.slice(0, 8)}${ext}`;
  const filePath = path.join(getVideosDir(), fileName);

  await fs.writeFile(filePath, input.bytes);

  const database = getDb();

  let folderId = input.folderId ?? null;
  if (folderId) {
    const exists = database.prepare('SELECT 1 FROM folders WHERE id = ?').get(folderId);
    if (!exists) folderId = null;
  }

  const createdAt = Date.now();
  const sizeBytes = input.bytes.length;

  database
    .prepare(
      `INSERT INTO videos
         (id, file_name, thumbnail_file_name, prompt, model, aspect_ratio,
          duration_seconds, has_audio, size_bytes, content_type,
          credits_consumed, source_url, created_at, folder_id)
       VALUES (@id, @fileName, @thumbnailFileName, @prompt, @model, @aspectRatio,
               @durationSeconds, @hasAudio, @sizeBytes, @contentType,
               @creditsConsumed, @sourceUrl, @createdAt, @folderId)`
    )
    .run({
      id,
      fileName,
      thumbnailFileName: null,
      prompt: input.prompt,
      model: input.model,
      aspectRatio: input.aspectRatio ?? null,
      durationSeconds: input.durationSeconds ?? null,
      hasAudio: input.hasAudio ? 1 : 0,
      sizeBytes,
      contentType,
      creditsConsumed: input.creditsConsumed ?? null,
      sourceUrl: input.sourceUrl ?? null,
      createdAt,
      folderId,
    });

  return {
    id,
    fileName,
    thumbnailFileName: null,
    prompt: input.prompt,
    model: input.model,
    aspectRatio: input.aspectRatio ?? null,
    durationSeconds: input.durationSeconds ?? null,
    hasAudio: input.hasAudio ?? false,
    sizeBytes,
    contentType,
    creditsConsumed: input.creditsConsumed ?? null,
    sourceUrl: input.sourceUrl ?? null,
    createdAt,
    folderId,
  };
}

export async function setThumbnail(id: string, thumbnailFileName: string): Promise<void> {
  const database = getDb();
  database
    .prepare('UPDATE videos SET thumbnail_file_name = ? WHERE id = ?')
    .run(thumbnailFileName, id);
}

export async function listVideos(): Promise<{
  entries: VideoStudioEntry[];
  folders: VideoStudioFolder[];
  basePath: string;
  thumbnailsBasePath: string;
}> {
  await fs.mkdir(getVideosDir(), { recursive: true });
  await fs.mkdir(getThumbnailsDir(), { recursive: true });
  const database = getDb();
  const videoRows = database
    .prepare(
      `SELECT id, file_name, thumbnail_file_name, prompt, model, aspect_ratio,
              duration_seconds, has_audio, size_bytes, content_type,
              credits_consumed, source_url, created_at, folder_id
       FROM videos ORDER BY created_at DESC`
    )
    .all() as VideoRow[];
  const folderRows = database
    .prepare('SELECT id, name, created_at FROM folders ORDER BY created_at DESC')
    .all() as FolderRow[];
  return {
    entries: videoRows.map(rowToEntry),
    folders: folderRows.map(rowToFolder),
    basePath: getVideosDir(),
    thumbnailsBasePath: getThumbnailsDir(),
  };
}

export async function deleteVideo(id: string): Promise<void> {
  const database = getDb();
  const row = database
    .prepare('SELECT file_name, thumbnail_file_name FROM videos WHERE id = ?')
    .get(id) as { file_name: string; thumbnail_file_name: string | null } | undefined;

  if (row) {
    const videoPath = safeResolvePath(getVideosDir(), row.file_name);
    if (videoPath) {
      try {
        await fs.unlink(videoPath);
      } catch {
        // File may already be deleted.
      }
    } else {
      log.warn('Blocked path traversal attempt', { fileName: row.file_name });
    }

    if (row.thumbnail_file_name) {
      const thumbPath = safeResolvePath(getThumbnailsDir(), row.thumbnail_file_name);
      if (thumbPath) {
        try {
          await fs.unlink(thumbPath);
        } catch {
          // best-effort
        }
      }
    }
  }

  database.prepare('DELETE FROM videos WHERE id = ?').run(id);
}

export async function getVideoFilePath(id: string): Promise<string | null> {
  const database = getDb();
  const row = database.prepare('SELECT file_name FROM videos WHERE id = ?').get(id) as
    | { file_name: string }
    | undefined;
  if (!row) return null;
  return safeResolvePath(getVideosDir(), row.file_name);
}

// --- Folder operations ---

export async function createFolder(name: string): Promise<VideoStudioFolder> {
  const database = getDb();
  const folder: VideoStudioFolder = {
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

export async function deleteFolder(id: string, deleteVideos: boolean): Promise<void> {
  const database = getDb();

  if (deleteVideos) {
    const rows = database
      .prepare('SELECT file_name, thumbnail_file_name FROM videos WHERE folder_id = ?')
      .all(id) as { file_name: string; thumbnail_file_name: string | null }[];

    for (const r of rows) {
      const filePath = safeResolvePath(getVideosDir(), r.file_name);
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch {
          // best-effort
        }
      }
      if (r.thumbnail_file_name) {
        const thumbPath = safeResolvePath(getThumbnailsDir(), r.thumbnail_file_name);
        if (thumbPath) {
          try {
            await fs.unlink(thumbPath);
          } catch {
            // best-effort
          }
        }
      }
    }

    const txn = database.transaction(() => {
      database.prepare('DELETE FROM videos WHERE folder_id = ?').run(id);
      database.prepare('DELETE FROM folders WHERE id = ?').run(id);
    });
    txn();
  } else {
    database.prepare('DELETE FROM folders WHERE id = ?').run(id);
  }
}

export async function moveToFolder(videoIds: string[], folderId: string | null): Promise<void> {
  if (videoIds.length === 0) return;
  const database = getDb();
  const stmt = database.prepare('UPDATE videos SET folder_id = ? WHERE id = ?');
  const txn = database.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(folderId, id);
  });
  txn(videoIds);
}
