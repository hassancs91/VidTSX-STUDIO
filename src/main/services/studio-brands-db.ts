import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type { StudioBrand } from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('studio-brands-db');

let db: Database.Database | null = null;

export function getStudioBrandsDir(): string {
  return path.join(app.getPath('userData'), 'studio-brands');
}

function getDbPath(): string {
  return path.join(getStudioBrandsDir(), 'studio-brands.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getStudioBrandsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_studio_brands_updated_at ON studio_brands(updated_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close studio-brands DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

interface BrandRow {
  id: string;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
}

function rowToBrand(row: BrandRow): StudioBrand {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBrands(): Promise<StudioBrand[]> {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM studio_brands ORDER BY updated_at DESC')
    .all() as BrandRow[];
  return rows.map(rowToBrand);
}

export async function saveBrand(brand: StudioBrand): Promise<void> {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO studio_brands (id, name, content, created_at, updated_at)
       VALUES (@id, @name, @content, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         content = excluded.content,
         updated_at = excluded.updated_at`
    )
    .run({
      id: brand.id,
      name: brand.name,
      content: brand.content,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    });
}

export async function deleteBrand(id: string): Promise<void> {
  const database = getDb();
  database.prepare('DELETE FROM studio_brands WHERE id = ?').run(id);
}
