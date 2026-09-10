// The flows service: the one FlowRunner wired to the real registry, store,
// video engine and event relay (flows plan §1.3), plus what the IPC handlers
// need — node specs, start / cancel / resume / get. Events go to every
// listener; the registration broadcasts them to every webContents, the same
// shape the agents use.

import fs from 'fs/promises';
import path from 'path';
import { parseFlowDoc } from '../../../shared/flows/migrate-v1';
import type { AgentArtifact, InteractionReply } from '../../../shared/types/agents';
import type { FlowDoc, FlowRunDoc, FlowRunEvent, FlowRunMode, NodeSpec } from '../../../shared/types/flows';
import { getNode, listNodeSpecs } from '../agents/tools/registry-core';
import { invokeTool } from '../agents/tools/invoke-tool';
import { resolveToolCapabilities } from '../agents/tool-support';
import { artifactRoot, assetUrlFor } from '../agents/artifact-paths';
import { slugifyName } from '../agents/tools/workspace-files';
import { ensureLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { getDefaultBrandId } from '../library/brand-default';
import { listFlows, loadFlow } from '../flows-projects-db';
import { loadRun } from '../flows-runs-db';
import { getAssetsDir, getFlowRunsDir } from '../../utils/paths';
import { FlowRunner } from './flow-runner';
import { flowRunStore } from './flow-run-store';
import { settleJob } from './flow-jobs';
import { migrateLegacyRunFolders } from './flow-run-migrate';
import { ensureFlowCatalog, packageInfoFor } from './flow-catalog';
import { buildFlowPackageDeps } from './flow-package-context';

const INTERRUPTED = 'The app closed while this run was in progress — Resume continues from the first unfinished step.';
const PAUSE_EXPIRED = 'The app closed while this run waited at a checkpoint — Resume asks again from that step.';

export interface FlowRunView {
  run: FlowRunDoc;
  artifacts: AgentArtifact[];
  assetUrls: Record<string, string[]>;
  resumable: boolean;
}

export interface StartFlowRunRequest {
  flowId: string;
  mode: FlowRunMode;
  params: Record<string, unknown>;
  brandId?: string | null;
}

/** A flow by row id, or by its exact name (case-insensitive) when unique — what an agent types. */
export function resolveFlowRef(ref: string): { id: string; name: string } | { error: string } {
  const wanted = ref.trim();
  if (!wanted) return { error: 'Name the flow to run (its id or its name).' };
  const rows = listFlows();
  const byId = rows.find((r) => r.id === wanted);
  if (byId) return { id: byId.id, name: byId.name };
  const byName = rows.filter((r) => r.name.trim().toLowerCase() === wanted.toLowerCase());
  if (byName.length === 1) return { id: byName[0].id, name: byName[0].name };
  if (byName.length > 1) {
    return { error: `Several flows are named "${wanted}" — use the id: ${byName.map((r) => r.id).join(', ')}.` };
  }
  return { error: `No flow "${wanted}". Installed flows: ${rows.map((r) => `${r.name} (${r.id})`).join(', ') || 'none'}.` };
}

/** Every stored flow with its parsed document, newest first. */
export function listFlowDocs(): Array<{ doc: FlowDoc; updatedAt: number }> {
  const out: Array<{ doc: FlowDoc; updatedAt: number }> = [];
  for (const row of listFlows()) {
    const project = loadFlow(row.id);
    if (!project) continue;
    out.push({
      doc: parseFlowDoc(project.graphJson, { id: project.id, name: project.name, description: project.description }),
      updatedAt: project.updatedAt,
    });
  }
  return out;
}

/** The stored document of one flow (W8 Stage 4: exported for `run_flow` / `read_flow`). */
export function loadFlowDoc(flowId: string): { doc: FlowDoc; version: string } {
  const project = loadFlow(flowId);
  if (!project) throw new Error('That flow no longer exists.');
  const doc = parseFlowDoc(project.graphJson, {
    id: project.id,
    name: project.name,
    description: project.description,
  });
  // A packaged flow's version is the manifest's (Stage 6); a user flow's is its save time.
  return { doc, version: packageInfoFor(project.id)?.version ?? String(project.updatedAt) };
}

/** `flows/<flow-slug>` in the asset library — where a run's media files land. */
function libraryFolderFor(doc: FlowDoc): string {
  return `flows/${slugifyName(doc.name, 'flow')}`;
}

function hasUnfinished(run: FlowRunDoc): boolean {
  return Object.values(run.nodes).some((n) => n.status !== 'done');
}

class FlowService {
  private readonly listeners = new Set<(event: FlowRunEvent) => void>();
  /** W8 Stage 6: Stage 1's run folders move out of the asset library, once. */
  private migrated: Promise<void> | null = null;
  private readonly runner = new FlowRunner({
    registry: { getNode },
    capabilities: resolveToolCapabilities,
    invoke: invokeTool,
    store: flowRunStore,
    settleJob,
    emit: (event) => this.emit(event),
  });

  onEvent(listener: (event: FlowRunEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: FlowRunEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  async listNodes(): Promise<NodeSpec[]> {
    return listNodeSpecs(await resolveToolCapabilities());
  }

  /** Before any run touches the store: legacy folders moved, packaged rows present. */
  private async ready(): Promise<void> {
    if (!this.migrated) {
      this.migrated = migrateLegacyRunFolders(path.join(getAssetsDir(), 'flows'), getFlowRunsDir()).then(() => undefined);
    }
    await this.migrated;
    await ensureFlowCatalog(buildFlowPackageDeps());
  }

  /** Run-level brand (§0.1 item 9): absent = library default, null = none. */
  private brandFor(requested: string | null | undefined): string | undefined {
    if (requested === null) return undefined;
    if (requested) return requested;
    return getDefaultBrandId();
  }

  async start(req: StartFlowRunRequest): Promise<{ runId: string }> {
    await this.ready();
    const { doc, version } = loadFlowDoc(req.flowId);
    const resolvedBrandId = this.brandFor(req.brandId);
    return this.runner.start({
      doc,
      mode: req.mode,
      params: req.params,
      ...(req.brandId !== undefined ? { brandId: req.brandId } : {}),
      ...(resolvedBrandId ? { resolvedBrandId } : {}),
      flowVersion: version,
      libraryFolder: libraryFolderFor(doc),
    });
  }

  cancel(runId: string): boolean {
    return this.runner.cancel(runId);
  }

  /** Settles when the run finishes (W8 Stage 4: `run_flow` waits on it). */
  wait(runId: string): Promise<void> {
    return this.runner.wait(runId);
  }

  /** Whether the run executes in this process right now (Stage 3: the run-artifact render refuses then). */
  isRunning(runId: string): boolean {
    return this.runner.isRunning(runId);
  }

  /** A checkpoint reply (Stage 2); throws for a run that is not waiting on that card. */
  async reply(runId: string, reply: InteractionReply): Promise<void> {
    const accepted = await this.runner.reply(runId, reply);
    if (!accepted) throw new Error('That checkpoint is no longer waiting for an answer.');
  }

  async resume(runId: string): Promise<void> {
    await this.ready();
    const row = loadRun(runId);
    if (!row) throw new Error('That run no longer exists.');
    const { doc } = loadFlowDoc(row.flowId);
    const existing = await flowRunStore.readDoc(flowRunStore.runDir(row.flowId, runId));
    const resolvedBrandId = this.brandFor(existing?.brandId);
    await this.runner.resume({
      runId,
      doc,
      mode: existing?.mode ?? 'unattended',
      params: existing?.params ?? {},
      ...(existing?.brandId !== undefined ? { brandId: existing.brandId } : {}),
      ...(resolvedBrandId ? { resolvedBrandId } : {}),
      libraryFolder: libraryFolderFor(doc),
    });
  }

  /**
   * The run with its artifacts and preview urls. A run that says `running`
   * but has no job in memory was interrupted by an app close: it is marked
   * so here, once, and offered for Resume.
   */
  async get(runId: string): Promise<FlowRunView> {
    await this.ready();
    const row = loadRun(runId);
    if (!row) throw new Error('That run no longer exists.');
    const dir = flowRunStore.runDir(row.flowId, runId);
    const run = await flowRunStore.readDoc(dir);
    if (!run) throw new Error('That run\'s folder is gone.');

    const running = this.runner.isRunning(runId);
    if (!running && (run.status === 'running' || run.status === 'queued' || run.status === 'paused')) {
      // A checkpoint the app closed on survives as EXPIRED (§1.3): the card is
      // not re-shown, the node keeps its outputs, Resume asks again.
      const atCheckpoint = run.status === 'paused';
      run.status = 'error';
      run.error = atCheckpoint ? PAUSE_EXPIRED : INTERRUPTED;
      run.finishedAt = run.finishedAt ?? Date.now();
      if (run.pending) run.pending = { ...run.pending, expired: true };
      for (const state of Object.values(run.nodes)) {
        if (state.status === 'running') state.status = 'skipped';
      }
      await flowRunStore.writeDoc(dir, run);
      await flowRunStore.persistSummary(run);
    }

    const store = await flowRunStore.openArtifacts(dir);
    const artifacts = store.list();
    const assetUrls: Record<string, string[]> = {};
    const root = await ensureLibraryRoot();
    for (const artifact of artifacts) {
      if (artifactRoot(artifact) !== 'library') continue;
      const relPaths =
        artifact.kind === 'image-set'
          ? artifact.payload.items.map((i) => i.relPath)
          : artifact.kind === 'video' || artifact.kind === 'audio'
            ? [artifact.payload.relPath]
            : [];
      const urls: string[] = [];
      for (const relPath of relPaths) {
        const abs = resolveLibraryPath(root, relPath);
        try {
          await fs.access(abs);
          urls.push(await assetUrlFor(abs));
        } catch {
          // A missing file loses its preview, nothing else.
        }
      }
      assetUrls[artifact.id] = urls;
    }
    return { run, artifacts, assetUrls, resumable: !running && hasUnfinished(run) };
  }
}

export const flowService = new FlowService();
