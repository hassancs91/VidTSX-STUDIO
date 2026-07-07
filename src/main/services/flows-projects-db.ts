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
  FlowRunRecord,
  FlowRunSummary,
  FlowRunStatus,
} from '../../shared/ipc/types';
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
      updated_at INTEGER NOT NULL
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

  // Idempotent column add for rows created before Phase 4.
  const cols = db.prepare('PRAGMA table_info(flows)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'gallery_folder_id')) {
    db.exec('ALTER TABLE flows ADD COLUMN gallery_folder_id TEXT');
  }

  return db;
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
}

function rowToSummary(row: FlowRow): FlowProjectSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail,
    galleryFolderId: row.gallery_folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToProject(row: FlowRow): FlowProject {
  return {
    ...rowToSummary(row),
    graphJson: row.graph_json,
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

  database.prepare(`
    INSERT INTO flows (id, name, description, graph_json, thumbnail, created_at, updated_at)
    VALUES (@id, @name, @description, @graphJson, NULL, @now, @now)
  `).run({
    id,
    name: req.name,
    description: req.description ?? null,
    graphJson: req.graphJson ?? EMPTY_GRAPH_JSON,
    now,
  });

  const row = database.prepare('SELECT * FROM flows WHERE id = ?').get(id) as FlowRow;
  return rowToProject(row);
}

export function updateFlow(req: FlowProjectUpdateRequest): FlowProject | null {
  const database = getDb();
  const existing = database.prepare('SELECT * FROM flows WHERE id = ?').get(req.id) as FlowRow | undefined;
  if (!existing) return null;

  const merged: FlowRow = {
    ...existing,
    name: req.name ?? existing.name,
    description: req.description !== undefined ? req.description : existing.description,
    graph_json: req.graphJson !== undefined ? req.graphJson : existing.graph_json,
    thumbnail: req.thumbnail !== undefined ? req.thumbnail : existing.thumbnail,
    updated_at: Date.now(),
  };

  database.prepare(`
    UPDATE flows SET name = @name, description = @description,
                     graph_json = @graph_json, thumbnail = @thumbnail,
                     updated_at = @updated_at
    WHERE id = @id
  `).run(merged);

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

// ─── flow_runs ──────────────────────────────────────────────────────────────

const RUN_HISTORY_CAP = 20;

interface FlowRunRow {
  id: string;
  flow_id: string;
  status: string;
  started_at: number;
  finished_at: number | null;
  error: string | null;
  node_results: string;
}

function rowToRunSummary(row: FlowRunRow): FlowRunSummary {
  return {
    id: row.id,
    flowId: row.flow_id,
    status: row.status as FlowRunStatus,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
  };
}

function rowToRunRecord(row: FlowRunRow): FlowRunRecord {
  return {
    ...rowToRunSummary(row),
    nodeResults: row.node_results,
  };
}

export interface PersistRunInput {
  id: string;
  flowId: string;
  status: FlowRunStatus;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  nodeResults: string;
}

export function persistRun(input: PersistRunInput): FlowRunRecord {
  const database = getDb();
  const insertAndPrune = database.transaction((row: PersistRunInput) => {
    database
      .prepare(`
        INSERT INTO flow_runs (id, flow_id, status, started_at, finished_at, error, node_results)
        VALUES (@id, @flowId, @status, @startedAt, @finishedAt, @error, @nodeResults)
      `)
      .run(row);

    // Prune oldest runs above the cap (per flow).
    database
      .prepare(`
        DELETE FROM flow_runs
        WHERE flow_id = @flowId
          AND id NOT IN (
            SELECT id FROM flow_runs
            WHERE flow_id = @flowId
            ORDER BY started_at DESC
            LIMIT @cap
          )
      `)
      .run({ flowId: row.flowId, cap: RUN_HISTORY_CAP });
  });
  insertAndPrune(input);

  const row = database
    .prepare('SELECT * FROM flow_runs WHERE id = ?')
    .get(input.id) as FlowRunRow;
  return rowToRunRecord(row);
}

export function listRuns(flowId: string): FlowRunSummary[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM flow_runs WHERE flow_id = ? ORDER BY started_at DESC')
    .all(flowId) as FlowRunRow[];
  return rows.map(rowToRunSummary);
}

export function loadRun(runId: string): FlowRunRecord | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM flow_runs WHERE id = ?')
    .get(runId) as FlowRunRow | undefined;
  return row ? rowToRunRecord(row) : null;
}
