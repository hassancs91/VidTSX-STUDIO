import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import type { Scene } from '../../shared/types/whiteboard';
import type { WhiteboardProjectData } from '../../shared/ipc/types';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('whiteboard-projects-db');

let db: Database.Database | null = null;

export function getWhiteboardProjectsDir(): string {
  return path.join(app.getPath('userData'), 'whiteboard-projects');
}

function getDbPath(): string {
  return path.join(getWhiteboardProjectsDir(), 'whiteboard.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getWhiteboardProjectsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface a real failure.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS whiteboard_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scene TEXT NOT NULL,
      thumbnail TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_whiteboard_projects_updated_at ON whiteboard_projects(updated_at DESC);
  `);

  return db;
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close whiteboard-projects DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

interface ProjectRow {
  id: string;
  name: string;
  scene: string;
  thumbnail: string | null;
  created_at: number;
  updated_at: number;
}

function rowToProject(row: ProjectRow): WhiteboardProjectData {
  let scene: Scene;
  try {
    scene = JSON.parse(row.scene) as Scene;
  } catch (err) {
    log.warn('Malformed scene JSON in whiteboard project; returning empty scene', {
      id: row.id,
      err: err instanceof Error ? err.message : String(err),
    });
    scene = {
      assets: [],
      hand: { svg: '', tipOffset: { x: 0, y: 0 } },
      background: 'white',
      pxPerSec: 600,
      viewBox: '0 0 1280 720',
    };
  }
  scene.assets = scene.assets.map((a) => {
    if (a.kind === 'image' || a.kind === 'text') return a;
    return { ...a, kind: 'drawable' as const };
  });
  return {
    id: row.id,
    name: row.name,
    scene,
    thumbnail: row.thumbnail ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(): Promise<WhiteboardProjectData[]> {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM whiteboard_projects ORDER BY updated_at DESC')
    .all() as ProjectRow[];
  return rows.map(rowToProject);
}

export async function saveProject(project: WhiteboardProjectData): Promise<void> {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO whiteboard_projects
         (id, name, scene, thumbnail, created_at, updated_at)
       VALUES
         (@id, @name, @scene, @thumbnail, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         scene = excluded.scene,
         thumbnail = excluded.thumbnail,
         updated_at = excluded.updated_at`
    )
    .run({
      id: project.id,
      name: project.name,
      scene: JSON.stringify(project.scene),
      thumbnail: project.thumbnail ?? null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
}

export async function loadProject(id: string): Promise<WhiteboardProjectData | null> {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM whiteboard_projects WHERE id = ?')
    .get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export async function deleteProject(id: string): Promise<void> {
  const database = getDb();
  database.prepare('DELETE FROM whiteboard_projects WHERE id = ?').run(id);
}
