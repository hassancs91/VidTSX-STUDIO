import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('creator-db');

let db: Database.Database | null = null;

/**
 * Shape of what we persist per TSX so re-opening the Push dialog restores the
 * previously entered data. Animated webp thumbnails are stored as separate
 * files under the creator/thumbnails/ directory, keyed by a hash of the TSX path.
 */
export interface PushDraft {
  title: string;
  slug: string;
  slugEdited: boolean;
  description: string;
  tags: string[];
  isPremium: boolean;
  featured: boolean;
  updatedAt: string;
  pushedAt?: string;
  templateId?: string;
  templateUrl?: string;
}

export function getCreatorDir(): string {
  return path.join(app.getPath('userData'), 'creator');
}

export function getThumbnailsDir(): string {
  return path.join(getCreatorDir(), 'thumbnails');
}

function getDbPath(): string {
  return path.join(getCreatorDir(), 'creator.db');
}

/**
 * Deterministic, filesystem-safe filename for a TSX path's animated thumbnail.
 * SHA-256 of the absolute path (first 16 hex chars) keeps names short and
 * collision-free in practice while avoiding path-length issues.
 */
export function getThumbnailPath(tsxFilePath: string): string {
  const hash = crypto.createHash('sha256').update(tsxFilePath).digest('hex').slice(0, 16);
  return path.join(getThumbnailsDir(), `${hash}.webp`);
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getCreatorDir(), { recursive: true });
    mkdirSync(getThumbnailsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS push_drafts (
      tsx_file_path TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL DEFAULT '',
      slug_edited INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      is_premium INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      pushed_at TEXT,
      template_id TEXT,
      template_url TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_push_drafts_updated_at ON push_drafts(updated_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close creator DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

// --- Row mapper ---

interface DraftRow {
  tsx_file_path: string;
  title: string;
  slug: string;
  slug_edited: number;
  description: string;
  tags: string;
  is_premium: number;
  featured: number;
  updated_at: string;
  pushed_at: string | null;
  template_id: string | null;
  template_url: string | null;
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === 'string');
    }
  } catch {
    // ignore malformed
  }
  return [];
}

function rowToDraft(row: DraftRow): PushDraft {
  return {
    title: row.title,
    slug: row.slug,
    slugEdited: row.slug_edited === 1,
    description: row.description,
    tags: parseTags(row.tags),
    isPremium: row.is_premium === 1,
    featured: row.featured === 1,
    updatedAt: row.updated_at,
    pushedAt: row.pushed_at ?? undefined,
    templateId: row.template_id ?? undefined,
    templateUrl: row.template_url ?? undefined,
  };
}

// --- CRUD ---

export async function readDraft(tsxFilePath: string): Promise<PushDraft | null> {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM push_drafts WHERE tsx_file_path = ?')
    .get(tsxFilePath) as DraftRow | undefined;
  return row ? rowToDraft(row) : null;
}

export async function writeDraft(
  tsxFilePath: string,
  draft: Omit<PushDraft, 'updatedAt'>
): Promise<void> {
  const database = getDb();
  const updatedAt = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO push_drafts
         (tsx_file_path, title, slug, slug_edited, description, tags, is_premium, featured,
          updated_at, pushed_at, template_id, template_url)
       VALUES
         (@tsxFilePath, @title, @slug, @slugEdited, @description, @tags, @isPremium, @featured,
          @updatedAt, @pushedAt, @templateId, @templateUrl)
       ON CONFLICT(tsx_file_path) DO UPDATE SET
         title = excluded.title,
         slug = excluded.slug,
         slug_edited = excluded.slug_edited,
         description = excluded.description,
         tags = excluded.tags,
         is_premium = excluded.is_premium,
         featured = excluded.featured,
         updated_at = excluded.updated_at,
         pushed_at = excluded.pushed_at,
         template_id = excluded.template_id,
         template_url = excluded.template_url`
    )
    .run({
      tsxFilePath,
      title: draft.title,
      slug: draft.slug,
      slugEdited: draft.slugEdited ? 1 : 0,
      description: draft.description,
      tags: JSON.stringify(draft.tags),
      isPremium: draft.isPremium ? 1 : 0,
      featured: draft.featured ? 1 : 0,
      updatedAt,
      pushedAt: draft.pushedAt ?? null,
      templateId: draft.templateId ?? null,
      templateUrl: draft.templateUrl ?? null,
    });
}

export async function thumbnailExists(tsxFilePath: string): Promise<boolean> {
  try {
    await fs.access(getThumbnailPath(tsxFilePath));
    return true;
  } catch {
    return false;
  }
}
