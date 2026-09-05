import Database from 'better-sqlite3';
import fs from 'fs/promises';
import { mkdirSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { ThreedStudioEntry } from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';
import {
  INPUT_FILE_NAME,
  MESH_FILE_NAME,
  PREVIEW_FILE_NAME,
  getModelDir,
  getModelsDir,
  getStudioDir,
  safeResolvePath,
} from './threed-studio-files';

const log = logEngine.createLogger('threed-studio-db');

let db: Database.Database | null = null;

function getDbPath(): string {
  return path.join(getStudioDir(), 'threed-studio.db');
}

export function getDb(): Database.Database {
  if (db) return db;
  try {
    mkdirSync(getStudioDir(), { recursive: true });
  } catch {
    // best-effort; Database() surfaces a real failure
  }
  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dir_name TEXT NOT NULL UNIQUE,
      mesh_file_name TEXT NOT NULL,
      preview_file_name TEXT,
      input_file_name TEXT,
      source_image_name TEXT NOT NULL,
      source_image_id TEXT,
      model TEXT NOT NULL,
      quality INTEGER NOT NULL,
      seed INTEGER,
      remove_background INTEGER NOT NULL DEFAULT 1,
      vertices INTEGER,
      faces INTEGER,
      size_bytes INTEGER NOT NULL,
      seconds REAL,
      device TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_models_created_at ON models(created_at DESC);
  `);
  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close threed-studio DB', { err: err instanceof Error ? err.message : String(err) });
  }
  db = null;
}

interface ModelRow {
  id: string;
  name: string;
  dir_name: string;
  mesh_file_name: string;
  preview_file_name: string | null;
  input_file_name: string | null;
  source_image_name: string;
  source_image_id: string | null;
  model: string;
  quality: number;
  seed: number | null;
  remove_background: number;
  vertices: number | null;
  faces: number | null;
  size_bytes: number;
  seconds: number | null;
  device: string | null;
  created_at: number;
}

const COLUMNS =
  'id, name, dir_name, mesh_file_name, preview_file_name, input_file_name, source_image_name, source_image_id, model, quality, seed, remove_background, vertices, faces, size_bytes, seconds, device, created_at';

function rowToEntry(row: ModelRow): ThreedStudioEntry {
  return {
    id: row.id,
    name: row.name,
    dirName: row.dir_name,
    meshFileName: row.mesh_file_name,
    previewFileName: row.preview_file_name,
    inputFileName: row.input_file_name,
    sourceImageName: row.source_image_name,
    sourceImageId: row.source_image_id,
    model: row.model,
    quality: row.quality,
    seed: row.seed,
    removeBackground: row.remove_background === 1,
    vertices: row.vertices,
    faces: row.faces,
    sizeBytes: row.size_bytes,
    seconds: row.seconds,
    device: row.device,
    createdAt: row.created_at,
  };
}

/** Reserve a fresh model folder: `<timestamp>-<8 hex>` under models/. */
export async function reserveModelDir(): Promise<{ id: string; dirName: string; dir: string }> {
  const id = crypto.randomUUID();
  const dirName = `m-${Date.now()}-${id.slice(0, 8)}`;
  const dir = getModelDir(dirName);
  await fs.mkdir(dir, { recursive: true });
  return { id, dirName, dir };
}

export interface RegisterModelInput {
  id: string;
  dirName: string;
  name: string;
  sourceImageName: string;
  sourceImageId: string | null;
  model: string;
  quality: number;
  seed: number | null;
  removeBackground: boolean;
  vertices: number | null;
  faces: number | null;
  seconds: number | null;
  device: string | null;
  hasPreview: boolean;
  hasInput: boolean;
}

/** Record a finished generation whose files are already in `<models>/<dirName>/`. */
export async function registerModel(input: RegisterModelInput): Promise<ThreedStudioEntry> {
  const dir = getModelDir(input.dirName);
  const stat = await fs.stat(path.join(dir, MESH_FILE_NAME));
  const createdAt = Date.now();
  getDb()
    .prepare(
      `INSERT INTO models (${COLUMNS})
       VALUES (@id, @name, @dirName, @meshFileName, @previewFileName, @inputFileName, @sourceImageName, @sourceImageId, @model, @quality, @seed, @removeBackground, @vertices, @faces, @sizeBytes, @seconds, @device, @createdAt)`,
    )
    .run({
      id: input.id,
      name: input.name,
      dirName: input.dirName,
      meshFileName: MESH_FILE_NAME,
      previewFileName: input.hasPreview ? PREVIEW_FILE_NAME : null,
      inputFileName: input.hasInput ? INPUT_FILE_NAME : null,
      sourceImageName: input.sourceImageName,
      sourceImageId: input.sourceImageId,
      model: input.model,
      quality: input.quality,
      seed: input.seed,
      removeBackground: input.removeBackground ? 1 : 0,
      vertices: input.vertices,
      faces: input.faces,
      sizeBytes: stat.size,
      seconds: input.seconds,
      device: input.device,
      createdAt,
    });
  return getModelEntry(input.id)!;
}

export function getModelEntry(id: string): ThreedStudioEntry | null {
  const row = getDb().prepare(`SELECT ${COLUMNS} FROM models WHERE id = ?`).get(id) as ModelRow | undefined;
  return row ? rowToEntry(row) : null;
}

export async function listModels(): Promise<{ entries: ThreedStudioEntry[]; basePath: string }> {
  await fs.mkdir(getModelsDir(), { recursive: true });
  const rows = getDb().prepare(`SELECT ${COLUMNS} FROM models ORDER BY created_at DESC`).all() as ModelRow[];
  return { entries: rows.map(rowToEntry), basePath: getModelsDir() };
}

/** Absolute paths of a model's files (null entries when the row lacks them). */
export function getModelPaths(id: string): { entry: ThreedStudioEntry; dir: string; mesh: string; preview: string | null; input: string | null } | null {
  const entry = getModelEntry(id);
  if (!entry) return null;
  const dir = safeResolvePath(getModelsDir(), entry.dirName);
  if (!dir) return null;
  return {
    entry,
    dir,
    mesh: path.join(dir, entry.meshFileName),
    preview: entry.previewFileName ? path.join(dir, entry.previewFileName) : null,
    input: entry.inputFileName ? path.join(dir, entry.inputFileName) : null,
  };
}

export async function deleteModel(id: string): Promise<void> {
  const paths = getModelPaths(id);
  if (paths) {
    await fs.rm(paths.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch((err) => {
      log.warn('Could not remove model folder', { dir: paths.dir, err: String(err) });
    });
  }
  getDb().prepare('DELETE FROM models WHERE id = ?').run(id);
}
