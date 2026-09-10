// The catalog sync (W8 Stage 6): packaged flows on disk → rows in the
// `flows` table (flows plan §1.7, §1.8 "Built-in" and "Installed" groups).
//
// Why rows at all, when §1.7 says packaged flows live on disk: every reader
// of a flow — the Flows page, `loadFlowDoc` for a run, the run history's
// foreign key, `run_flow`'s listing, `resolveFlowRef` — reads the table, and
// teaching each of them a second source would be the drift the plan warns
// about. So the folder stays the truth and the row is its cache: rewritten
// from `flow.json` on every sync, pruned when the folder is gone (its runs
// cascade with it, which is what "removed with the agent" means).
//
// Three sources feed it: `resources/flows` (built-in), `<userData>/flows`
// (installed from a `.vidtsxflow`), and `flows/<name>/flow.json` inside an
// agent package, built-in or installed (decision 10) — listed under the
// agent's name. Highest version per id wins, equal prefers the built-in.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { compareAgentVersions } from '../../../shared/agents/manifest';
import { parseAgentId } from '../../../shared/agents/ids';
import { flowDocOf } from '../../../shared/flows/flow-package';
import type { FlowPackageInfo } from '../../../shared/types/flows';
import { defaultAgentRoots, type AgentStoreRoots } from '../agents/agent-store';
import { deletePackagedFlowRows, listPackagedFlowRows, upsertPackagedFlow } from '../flows-packaged-db';
import type { FlowPackageDeps } from './flow-package';
import { defaultFlowRoots, readFlowFolder, scanFlows, type FlowStoreRoots, type InstalledFlow } from './flow-store';

const log = logEngine.createLogger('FlowCatalog');

/** Repeated syncs inside this window are free — the Flows page lists often. */
const SYNC_THROTTLE_MS = 2_000;

export interface FlowCatalogRoots {
  flows: FlowStoreRoots;
  agents: AgentStoreRoots;
}

async function listDirs(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function agentNameOf(agentDir: string, fallback: string): Promise<string> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(agentDir, 'agent.json'), 'utf-8')) as { name?: unknown };
    return typeof raw.name === 'string' && raw.name ? raw.name : fallback;
  } catch {
    return fallback;
  }
}

/** `<agentsRoot>/<ns>/<name>/flows/<flow>/flow.json`, tagged with the agent. */
async function scanAgentFlows(root: string, origin: 'builtin' | 'user', deps: FlowPackageDeps): Promise<InstalledFlow[]> {
  const found: InstalledFlow[] = [];
  for (const namespace of await listDirs(root)) {
    for (const name of await listDirs(path.join(root, namespace))) {
      const agentId = `${namespace}/${name}`;
      if (!parseAgentId(agentId)) continue;
      const agentDir = path.join(root, namespace, name);
      const flowsDir = path.join(agentDir, 'flows');
      const flowDirs = await listDirs(flowsDir);
      if (flowDirs.length === 0) continue;
      const agentName = await agentNameOf(agentDir, name);
      for (const flowName of flowDirs) {
        const flow = await readFlowFolder(path.join(flowsDir, flowName), origin, deps, { checkFolderName: false });
        if (flow) found.push({ ...flow, viaAgent: { id: agentId, name: agentName } });
      }
    }
  }
  return found;
}

/** Every packaged flow the app can see, shadowing resolved across all sources. */
export async function scanCatalog(deps: FlowPackageDeps, roots: FlowCatalogRoots): Promise<InstalledFlow[]> {
  const byId = new Map<string, InstalledFlow>();
  const consider = (flow: InstalledFlow): void => {
    const held = byId.get(flow.manifest.id);
    if (!held) {
      byId.set(flow.manifest.id, flow);
      return;
    }
    const cmp = compareAgentVersions(flow.manifest.version, held.manifest.version);
    if (cmp > 0 || (cmp === 0 && flow.origin === 'builtin' && held.origin !== 'builtin')) byId.set(flow.manifest.id, flow);
  };
  for (const flow of await scanFlows(deps, roots.flows)) consider(flow);
  for (const flow of await scanAgentFlows(roots.agents.builtinDir, 'builtin', deps)) consider(flow);
  for (const flow of await scanAgentFlows(roots.agents.userDir, 'user', deps)) consider(flow);
  return [...byId.values()];
}

async function mtimeOf(file: string): Promise<number> {
  try {
    return Math.floor((await fs.stat(file)).mtimeMs);
  } catch {
    return Date.now();
  }
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

const packageInfo = new Map<string, FlowPackageInfo>();
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;

/** The package behind a `builtin` / `installed` row, from the last sync. */
export function packageInfoFor(id: string): FlowPackageInfo | undefined {
  return packageInfo.get(id);
}

/**
 * Scan the roots and rewrite the cache rows. Prunes a row only when the root
 * it came from is readable — under a dev launch whose `resources/` resolves
 * nowhere, the built-ins keep their rows (and their runs) until the path is
 * fixed rather than losing them on every list.
 */
export async function syncFlowCatalog(
  deps: FlowPackageDeps,
  roots: FlowCatalogRoots = { flows: defaultFlowRoots(), agents: defaultAgentRoots() },
): Promise<{ flows: number }> {
  const found = await scanCatalog(deps, roots);
  const seen = new Set<string>();
  packageInfo.clear();
  for (const flow of found) {
    const doc = flowDocOf(flow.manifest);
    seen.add(flow.manifest.id);
    upsertPackagedFlow({
      id: flow.manifest.id,
      name: flow.manifest.name,
      description: flow.manifest.description,
      graphJson: JSON.stringify(doc),
      source: flow.origin === 'builtin' ? 'builtin' : 'installed',
      updatedAt: await mtimeOf(path.join(flow.dir, 'flow.json')),
    });
    packageInfo.set(flow.manifest.id, {
      version: flow.manifest.version,
      author: flow.manifest.author.name,
      signature: flow.signature,
      ...(flow.keyId ? { keyId: flow.keyId } : {}),
      ...(flow.publisher ? { publisher: flow.publisher } : {}),
      ...(flow.viaAgent ? { viaAgent: flow.viaAgent } : {}),
    });
  }

  const builtinReadable = (await dirExists(roots.flows.builtinDir)) || (await dirExists(roots.agents.builtinDir));
  const stale = listPackagedFlowRows()
    .filter((row) => !seen.has(row.id))
    .filter((row) => (row.source === 'builtin' ? builtinReadable : true))
    .map((row) => row.id);
  if (stale.length > 0) {
    deletePackagedFlowRows(stale);
    log.info('Pruned packaged flow rows whose folder is gone', { ids: stale });
  }
  lastSyncAt = Date.now();
  return { flows: found.length };
}

/** A throttled sync: at most one scan per window, shared by concurrent callers. */
export async function ensureFlowCatalog(deps: FlowPackageDeps, roots?: FlowCatalogRoots, force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastSyncAt < SYNC_THROTTLE_MS) return;
  inFlight = syncFlowCatalog(deps, roots)
    .then(() => undefined)
    .catch((err: unknown) => {
      log.warn('Flow catalog sync failed', { error: err instanceof Error ? err.message : String(err) });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Test seam — the throttle and the info map are module state. */
export function resetFlowCatalogForTests(): void {
  packageInfo.clear();
  lastSyncAt = 0;
  inFlight = null;
}
