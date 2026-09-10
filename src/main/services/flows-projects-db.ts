import Database from 'better-sqlite3';
import { app } from 'electron';
import { mkdirSync } from 'fs';
import path from 'path';
import { ulid } from 'ulid';
import type {
  FlowProject,
  FlowProjectSummary,
  FlowProjectCreateRequest,
  FlowProjectUpdateRequest,
} from '../../shared/ipc/types';
import { FLOW_DOC_FORMAT_VERSION, type FlowOrigin, type FlowSource } from '../../shared/types/flows';
import { parseFlowDoc } from '../../shared/flows/migrate-v1';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('flows-projects-db');

const EMPTY_GRAPH_JSON = '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}';

let db: Database.Database | null = null;

export function getFlowsProjectsDir(): string {
  return path.join(app.getPath('userData'), 'flows-projects');
}

function getDbPath(): string {
  return path.join(getFlowsProjectsDir(), 'flows-projects.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(getFlowsProjectsDir(), { recursive: true });
  } catch {
    // Best-effort; the Database constructor will surface real failures.
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      graph_json TEXT NOT NULL DEFAULT '${EMPTY_GRAPH_JSON}',
      thumbnail TEXT,
      gallery_folder_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      doc_version INTEGER NOT NULL DEFAULT ${FLOW_DOC_FORMAT_VERSION},
      origin TEXT,
      source TEXT NOT NULL DEFAULT 'user'
    );
    CREATE INDEX IF NOT EXISTS idx_flows_updated_at ON flows(updated_at DESC);

    CREATE TABLE IF NOT EXISTS flow_runs (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      error TEXT,
      node_results TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_flow_runs_flow ON flow_runs(flow_id, started_at DESC);
  `);

  // Idempotent column adds: gallery_folder_id (Phase 4); doc_version, origin,
  // source (W8 Stage 0, docs/flows-plan.md §2). A table that predates W8 gets
  // doc_version 1 so its rows migrate below; graph_json itself stays — it now
  // holds the v2 FlowDoc.
  const cols = db.prepare('PRAGMA table_info(flows)').all() as { name: string }[];
  const has = (name: string) => cols.some((c) => c.name === name);
  if (!has('gallery_folder_id')) db.exec('ALTER TABLE flows ADD COLUMN gallery_folder_id TEXT');
  if (!has('doc_version')) db.exec('ALTER TABLE flows ADD COLUMN doc_version INTEGER NOT NULL DEFAULT 1');
  if (!has('origin')) db.exec('ALTER TABLE flows ADD COLUMN origin TEXT');
  if (!has('source')) db.exec("ALTER TABLE flows ADD COLUMN source TEXT NOT NULL DEFAULT 'user'");

  migrateLegacyRows(db);
  return db;
}

/** Rewrite every v1 row as a v2 FlowDoc, once, at open. Pure migration; a
 *  row that fails to parse becomes the empty doc rather than blocking open. */
function migrateLegacyRows(database: Database.Database): void {
  const rows = database
    .prepare('SELECT id, name, description, graph_json FROM flows WHERE doc_version < ?')
    .all(FLOW_DOC_FORMAT_VERSION) as Pick<FlowRow, 'id' | 'name' | 'description' | 'graph_json'>[];
  if (rows.length === 0) return;
  const update = database.prepare(
    'UPDATE flows SET graph_json = @graph_json, doc_version = @doc_version WHERE id = @id',
  );
  const run = database.transaction((pending: typeof rows) => {
    for (const row of pending) {
      const doc = parseFlowDoc(row.graph_json, { id: row.id, name: row.name, description: row.description });
      update.run({ id: row.id, graph_json: JSON.stringify(doc), doc_version: FLOW_DOC_FORMAT_VERSION });
    }
  });
  run(rows);
  log.info('Migrated flow rows to FlowDoc v2', { count: rows.length });
}

export function closeDb(): void {
  if (!db) return;
  try {
    db.close();
  } catch (err) {
    log.warn('Failed to close flows-projects DB', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  db = null;
}

interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  graph_json: string;
  thumbnail: string | null;
  gallery_folder_id: string | null;
  created_at: number;
  updated_at: number;
  doc_version: number;
  origin: string | null;
  source: string;
}

function parseOrigin(raw: string | null): FlowOrigin | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FlowOrigin> | null;
    if (value && typeof value.agentId === 'string' && typeof value.sessionId === 'string' && typeof value.artifactId === 'string') {
      return { agentId: value.agentId, sessionId: value.sessionId, artifactId: value.artifactId };
    }
  } catch {
    // fall through
  }
  return null;
}

const SOURCES: ReadonlySet<string> = new Set<FlowSource>(['user', 'template', 'frozen', 'imported']);

function rowToSummary(row: FlowRow): FlowProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail,
    galleryFolderId: row.gallery_folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    docVersion: row.doc_version,
    origin: parseOrigin(row.origin),
    source: (SOURCES.has(row.source) ? row.source : 'user') as FlowSource,
  };
}

/** Reads always hand out v2: a row the open-time migration missed (a
 *  concurrent writer, an older build) migrates here, on the way out. */
function rowToProject(row: FlowRow): FlowProject {
  const doc = parseFlowDoc(row.graph_json, { id: row.id, name: row.name, description: row.description });
  return {
    ...rowToSummary(row),
    docVersion: FLOW_DOC_FORMAT_VERSION,
    graphJson: JSON.stringify(doc),
  };
}

export function listFlows(): FlowProjectSummary[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM flows ORDER BY updated_at DESC')
    .all() as FlowRow[];
  return rows.map(rowToSummary);
}

export function loadFlow(id: string): FlowProject | null {
  const database = getDb();
  const row = database.prepare('SELECT * FROM flows WHERE id = ?').get(id) as FlowRow | undefined;
  return row ? rowToProject(row) : null;
}

export function createFlow(req: FlowProjectCreateRequest): FlowProject {
  const database = getDb();
  const now = Date.now();
  const id = ulid();
  const doc = parseFlowDoc(req.graphJson ?? EMPTY_GRAPH_JSON, {
    id,
    name: req.name,
    description: req.description ?? null,
  });
  const origin = req.origin ?? doc.origin;
  doc.origin = origin;

  database.prepare(`
    INSERT INTO flows (id, name, description, graph_json, thumbnail, created_at, updated_at, doc_version, origin, source)
    VALUES (@id, @name, @description, @graph_json, NULL, @now, @now, @doc_version, @origin, @source)
  `).run({
    id,
    name: req.name,
    description: req.description ?? null,
    graph_json: JSON.stringify(doc),
    now,
    doc_version: FLOW_DOC_FORMAT_VERSION,
    origin: origin ? JSON.stringify(origin) : null,
    source: req.source ?? 'user',
  });

  const row = database.prepare('SELECT * FROM flows WHERE id = ?').get(id) as FlowRow;
  return rowToProject(row);
}

export function updateFlow(req: FlowProjectUpdateRequest): FlowProject | null {
  const database = getDb();
  const existing = database.prepare('SELECT * FROM flows WHERE id = ?').get(req.id) as FlowRow | undefined;
  if (!existing) return null;

  const name = req.name ?? existing.name;
  const description = req.description !== undefined ? req.description : existing.description;
  // Whatever arrives (v1 from an older canvas, v2 from the new one) is
  // written back as v2 with the row's name and description folded in.
  const doc = parseFlowDoc(req.graphJson !== undefined ? req.graphJson : existing.graph_json, {
    id: existing.id,
    name,
    description,
  });
  const merged: FlowRow = {
    ...existing,
    name,
    description,
    graph_json: JSON.stringify(doc),
    thumbnail: req.thumbnail !== undefined ? req.thumbnail : existing.thumbnail,
    updated_at: Date.now(),
    doc_version: FLOW_DOC_FORMAT_VERSION,
  };

  database.prepare(`
    UPDATE flows SET name = @name, description = @description,
                     graph_json = @graph_json, thumbnail = @thumbnail,
                     updated_at = @updated_at, doc_version = @doc_version
    WHERE id = @id
  `).run({
    id: merged.id,
    name: merged.name,
    description: merged.description,
    graph_json: merged.graph_json,
    thumbnail: merged.thumbnail,
    updated_at: merged.updated_at,
    doc_version: merged.doc_version,
  });

  return rowToProject(merged);
}

export function deleteFlow(id: string): void {
  const database = getDb();
  database.prepare('DELETE FROM flows WHERE id = ?').run(id);
}

export function setGalleryFolderId(id: string, galleryFolderId: string | null): void {
  const database = getDb();
  database
    .prepare('UPDATE flows SET gallery_folder_id = ? WHERE id = ?')
    .run(galleryFolderId, id);
}
