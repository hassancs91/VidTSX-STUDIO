// The catalog sync (W8 Stage 6): packaged flows on disk become `builtin` /
// `installed` rows, a refresh keeps the row's runs, a folder that is gone
// takes its row (and its runs) with it, an agent package's `flows/` shows
// under the agent's name. Real SQL through the node:sqlite adapter the
// flows-projects-db test uses.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fsSync from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let userData = '';
vi.mock('electron', () => ({
  app: { getPath: () => userDataForMock(), isPackaged: false, getAppPath: () => userDataForMock(), getVersion: () => '1.1.0' },
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

import { AGENT_TOOL_IDS } from '../../../shared/agents/tool-ids';
import * as db from '../flows-projects-db';
import { listRuns, persistRun } from '../flows-runs-db';
import { packageInfoFor, resetFlowCatalogForTests, syncFlowCatalog, type FlowCatalogRoots } from './flow-catalog';
import type { FlowPackageDeps } from './flow-package';
import { defaultFlowManifest } from './test-flow-package-builder';

const deps: FlowPackageDeps = { manifestContext: { appVersion: '1.1.0', toolIds: AGENT_TOOL_IDS } };
let roots: FlowCatalogRoots;

async function writeFlowFolder(dir: string, id: string, over: Record<string, unknown> = {}): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'flow.json'), JSON.stringify({ ...defaultFlowManifest(id), files: [], ...over }));
}

beforeEach(() => {
  userData = fsSync.mkdtempSync(path.join(os.tmpdir(), 'vidtsx-flow-catalog-'));
  roots = {
    flows: { userDir: path.join(userData, 'flows'), builtinDir: path.join(userData, 'resources', 'flows') },
    agents: { userDir: path.join(userData, 'agents'), builtinDir: path.join(userData, 'resources', 'agents') },
  };
  resetFlowCatalogForTests();
});

afterEach(async () => {
  db.closeDb();
  await fs.rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('syncFlowCatalog', () => {
  it('mirrors built-in and installed folders as rows the ordinary reads see', async () => {
    await writeFlowFolder(path.join(roots.flows.builtinDir, 'vidtsx', 'thumbnail'), 'vidtsx/thumbnail', { name: 'Thumbnail' });
    await writeFlowFolder(path.join(roots.flows.userDir, 'acme', 'captions'), 'acme/captions', { name: 'Captions', version: '1.2.0' });
    expect(await syncFlowCatalog(deps, roots)).toEqual({ flows: 2 });

    const rows = db.listFlows();
    expect(rows.map((r) => `${r.id}:${r.source}`).sort()).toEqual(['acme/captions:installed', 'vidtsx/thumbnail:builtin']);
    const project = db.loadFlow('vidtsx/thumbnail');
    expect(project?.name).toBe('Thumbnail');
    const doc = JSON.parse(project!.graphJson) as { version?: string; graph: { nodes: unknown[] } };
    expect(doc.version).toBeUndefined();
    expect(doc.graph.nodes).toHaveLength(2);
    expect(packageInfoFor('acme/captions')).toEqual({ version: '1.2.0', author: 'Tests', signature: 'unsigned' });
    expect(packageInfoFor('01NOPE')).toBeUndefined();
  });

  it('a refresh keeps a packaged flow’s runs; a removed folder takes its row and runs', async () => {
    const dir = path.join(roots.flows.userDir, 'acme', 'captions');
    await writeFlowFolder(dir, 'acme/captions');
    await syncFlowCatalog(deps, roots);
    persistRun({ id: 'run-1', flowId: 'acme/captions', status: 'success', startedAt: 1, finishedAt: 2, error: null, nodeResults: '{}' });

    await writeFlowFolder(dir, 'acme/captions', { version: '1.1.0' });
    await syncFlowCatalog(deps, roots);
    expect(listRuns('acme/captions').map((r) => r.id)).toEqual(['run-1']);
    expect(packageInfoFor('acme/captions')?.version).toBe('1.1.0');

    await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    await syncFlowCatalog(deps, roots);
    expect(db.listFlows()).toEqual([]);
    expect(listRuns('acme/captions')).toEqual([]);
  });

  it('never touches user rows, and keeps built-in rows while the built-in root is unreadable', async () => {
    const mine = db.createFlow({ name: 'Mine' });
    await writeFlowFolder(path.join(roots.flows.builtinDir, 'vidtsx', 'thumbnail'), 'vidtsx/thumbnail');
    await syncFlowCatalog(deps, roots);
    expect(db.listFlows().map((r) => r.id).sort()).toEqual([mine.id, 'vidtsx/thumbnail'].sort());

    // The dev launch whose `resources/` resolves nowhere: rows survive.
    await syncFlowCatalog(deps, {
      flows: { ...roots.flows, builtinDir: path.join(userData, 'nowhere') },
      agents: { ...roots.agents, builtinDir: path.join(userData, 'nowhere-either') },
    });
    expect(db.listFlows().map((r) => r.id).sort()).toEqual([mine.id, 'vidtsx/thumbnail'].sort());
  });

  it('lists a flow carried inside an agent package under the agent’s name (decision 10)', async () => {
    const agentDir = path.join(roots.agents.userDir, 'acme', 'storyboard');
    await fs.mkdir(agentDir, { recursive: true });
    await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify({ id: 'acme/storyboard', name: 'Storyboard' }));
    await writeFlowFolder(path.join(agentDir, 'flows', 'shots'), 'acme/shots', { name: 'Shot list' });
    await syncFlowCatalog(deps, roots);
    expect(db.listFlows().map((r) => `${r.id}:${r.source}`)).toEqual(['acme/shots:installed']);
    expect(packageInfoFor('acme/shots')?.viaAgent).toEqual({ id: 'acme/storyboard', name: 'Storyboard' });
  });
});
