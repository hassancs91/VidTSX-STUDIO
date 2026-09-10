// The W8 Stage 0 schema migration: a flows table from before W8 (no
// doc_version / origin / source, v1 graph_json) opens, gains the columns,
// and every row is rewritten as a v2 FlowDoc; reads and writes hand out v2
// from then on. Real SQL against a real file — the same node:sqlite adapter
// ai-usage-db.test.ts uses, because better-sqlite3 is built for Electron's ABI.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';

let userData = '';
vi.mock('electron', () => ({
  app: { getPath: () => userDataForMock() },
}));

vi.mock('better-sqlite3', () => ({ default: adaptNodeSqlite() }));

function adaptNodeSqlite() {
  return class Adapter {
    private readonly inner: DatabaseSync;
    constructor(file: string) {
      this.inner = new DatabaseSync(file);
    }
    pragma(text: string): unknown {
      return this.inner.exec(`PRAGMA ${text}`);
    }
    exec(sql: string): void {
      this.inner.exec(sql);
    }
    prepare(sql: string) {
      return this.inner.prepare(sql);
    }
    transaction<TArgs extends unknown[]>(fn: (...args: TArgs) => void) {
      return (...args: TArgs) => {
        this.inner.exec('BEGIN');
        try {
          const out = fn(...args);
          this.inner.exec('COMMIT');
          return out;
        } catch (err) {
          this.inner.exec('ROLLBACK');
          throw err;
        }
      };
    }
    close(): void {
      this.inner.close();
    }
  };
}

function userDataForMock(): string {
  return userData;
}

import * as db from './flows-projects-db';
import { persistRun, listRuns } from './flows-runs-db';
import { FLOW_TEMPLATES } from '../../features/flows/templates';
import { parseFlowDoc, isFlowDocV2 } from '../../shared/flows/migrate-v1';
import { validateFlowDoc } from '../../shared/flows/validate';

const V1_ROW_ID = '01J8ZKEGACYR0W000000000000';
const V1_GRAPH = JSON.stringify(FLOW_TEMPLATES[1].graph);

/** The flows table exactly as it shipped before W8. */
function createLegacyTable(dbPath: string): void {
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`
    CREATE TABLE flows (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      graph_json TEXT NOT NULL DEFAULT '{}', thumbnail TEXT, gallery_folder_id TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE flow_runs (
      id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
      status TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, error TEXT,
      node_results TEXT NOT NULL DEFAULT '{}'
    );
  `);
  legacy
    .prepare('INSERT INTO flows VALUES (?, ?, ?, ?, NULL, NULL, 1, 1)')
    .run(V1_ROW_ID, 'Old variation flow', 'from before W8', V1_GRAPH);
  legacy.prepare("INSERT INTO flows VALUES (?, ?, NULL, 'not json at all', NULL, NULL, 2, 2)").run('01J8ZKEGACYR0W000000000001', 'Broken');
  legacy.close();
}

function dbFile(): string {
  return path.join(db.getFlowsProjectsDir(), 'flows-projects.db');
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vidtsx-flows-'));
});

afterEach(() => {
  db.closeDb();
  fs.rmSync(userData, { recursive: true, force: true });
});

describe('read migration of a pre-W8 database', () => {
  it('adds the columns and rewrites every v1 row as a FlowDoc v2 at open', () => {
    fs.mkdirSync(db.getFlowsProjectsDir(), { recursive: true });
    createLegacyTable(dbFile());

    const summaries = db.listFlows();
    expect(summaries.map((s) => s.docVersion)).toEqual([2, 2]);
    expect(summaries.map((s) => s.source)).toEqual(['user', 'user']);
    expect(summaries.every((s) => s.origin === null)).toBe(true);

    const project = db.loadFlow(V1_ROW_ID);
    expect(project).not.toBeNull();
    const stored = JSON.parse(project!.graphJson) as unknown;
    expect(isFlowDocV2(stored)).toBe(true);
    const doc = parseFlowDoc(stored);
    expect(doc.id).toBe(V1_ROW_ID);
    expect(doc.name).toBe('Old variation flow');
    expect(doc.description).toBe('from before W8');
    expect(doc.graph.nodes.map((n) => n.toolId)).toEqual(['input_image_library', 'input_text', 'generate_image']);
    expect(doc.graph.nodes.map((n) => n.id)).toEqual(['n-tpl-gallery', 'n-tpl-prompt', 'n-tpl-generate']);
    expect(doc.outputs).toEqual([{ nodeId: 'n-tpl-generate', handle: 'image', label: 'Image' }]);
    expect(validateFlowDoc(doc, { requireNodes: true })).toEqual({ ok: true });

    // The raw column now holds v2 — the migration wrote, not just read.
    const raw = new DatabaseSync(dbFile());
    const row = raw.prepare('SELECT graph_json, doc_version, source FROM flows WHERE id = ?').get(V1_ROW_ID) as {
      graph_json: string;
      doc_version: number;
      source: string;
    };
    raw.close();
    expect(row.doc_version).toBe(2);
    expect(row.source).toBe('user');
    expect(isFlowDocV2(JSON.parse(row.graph_json))).toBe(true);
  });

  it('turns an unparsable legacy row into the empty doc instead of failing open', () => {
    fs.mkdirSync(db.getFlowsProjectsDir(), { recursive: true });
    createLegacyTable(dbFile());
    const broken = db.loadFlow('01J8ZKEGACYR0W000000000001');
    const doc = parseFlowDoc(broken!.graphJson);
    expect(doc.graph.nodes).toEqual([]);
    expect(doc.name).toBe('Broken');
  });

  it('is idempotent across reopens and keeps the run history rows', () => {
    fs.mkdirSync(db.getFlowsProjectsDir(), { recursive: true });
    createLegacyTable(dbFile());
    db.listFlows();
    persistRun({ id: 'run-1', flowId: V1_ROW_ID, status: 'success', startedAt: 5, finishedAt: 6, error: null, nodeResults: '{}' });
    db.closeDb();
    expect(() => db.listFlows()).not.toThrow();
    expect(listRuns(V1_ROW_ID).map((r) => r.id)).toEqual(['run-1']);
    expect(db.loadFlow(V1_ROW_ID)!.docVersion).toBe(2);
  });
});

describe('writes on a fresh database', () => {
  it('createFlow accepts a v1 template graph and stores v2 with the row id folded in', () => {
    const project = db.createFlow({ name: 'From template', graphJson: JSON.stringify(FLOW_TEMPLATES[0].graph), source: 'template' });
    expect(project.docVersion).toBe(2);
    expect(project.source).toBe('template');
    const doc = parseFlowDoc(project.graphJson);
    expect(doc.id).toBe(project.id);
    expect(doc.name).toBe('From template');
    expect(doc.graph.nodes.map((n) => n.toolId)).toEqual(['input_text', 'generate_image']);
  });

  it('createFlow with no graph stores the empty v2 doc, and origin round-trips', () => {
    const origin = { agentId: 'vidtsx/motion-post', sessionId: 's-1', artifactId: 'video-3' };
    const project = db.createFlow({ name: 'Frozen', source: 'frozen', origin });
    expect(parseFlowDoc(project.graphJson).graph.nodes).toEqual([]);
    expect(db.loadFlow(project.id)!.origin).toEqual(origin);
    expect(db.listFlows()[0].origin).toEqual(origin);
  });

  it('updateFlow accepts v1 or v2 graph JSON and folds a rename into the doc', () => {
    const created = db.createFlow({ name: 'A' });
    const v1 = db.updateFlow({ id: created.id, graphJson: JSON.stringify(FLOW_TEMPLATES[2].graph) });
    expect(parseFlowDoc(v1!.graphJson).graph.nodes).toHaveLength(4);

    const v2doc = parseFlowDoc(v1!.graphJson);
    v2doc.graph.nodes[0].pause = true;
    v2doc.params = [{ id: 'prompt', label: 'Prompt', kind: 'prompt', bind: [{ nodeId: 'n-tpl-prompt', key: 'prompt' }] }];
    const v2 = db.updateFlow({ id: created.id, graphJson: JSON.stringify(v2doc), name: 'B' });
    const back = parseFlowDoc(v2!.graphJson);
    expect(back.name).toBe('B');
    expect(back.graph.nodes[0].pause).toBe(true);
    expect(back.params).toHaveLength(1);
    expect(validateFlowDoc(back, { requireNodes: true })).toEqual({ ok: true });

    // A thumbnail-only update leaves the doc alone.
    const thumb = db.updateFlow({ id: created.id, thumbnail: 'data:image/svg+xml;base64,AA==' });
    expect(parseFlowDoc(thumb!.graphJson)).toEqual(back);
    expect(thumb!.thumbnail).toBe('data:image/svg+xml;base64,AA==');
  });
});
