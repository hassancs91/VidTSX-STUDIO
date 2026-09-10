// The flows service: the one FlowRunner wired to the real registry, store,
// video engine and event relay (flows plan §1.3), plus what the IPC handlers
// need — node specs, start / cancel / resume / get. Events go to every
// listener; the registration broadcasts them to every webContents, the same
// shape the agents use.

import fs from 'fs/promises';
import { parseFlowDoc } from '../../../shared/flows/migrate-v1';
import type { AgentArtifact, InteractionReply } from '../../../shared/types/agents';
import type { FlowDoc, FlowRunDoc, FlowRunEvent, FlowRunMode, NodeSpec } from '../../../shared/types/flows';
import { getNode, listNodeSpecs } from '../agents/tools/registry';
import { invokeTool } from '../agents/tools/invoke-tool';
import { resolveToolCapabilities } from '../agents/tool-support';
import { artifactRoot, assetUrlFor } from '../agents/artifact-paths';
import { slugifyName } from '../agents/tools/workspace-files';
import { ensureLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { getDefaultBrandId } from '../library/brand-default';
import { loadFlow } from '../flows-projects-db';
import { loadRun } from '../flows-runs-db';
import { FlowRunner } from './flow-runner';
import { flowRunStore } from './flow-run-store';
import { settleJob } from './flow-jobs';

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

function loadDoc(flowId: string): { doc: FlowDoc; version: string } {
  const project = loadFlow(flowId);
  if (!project) throw new Error('That flow no longer exists.');
  const doc = parseFlowDoc(project.graphJson, {
    id: project.id,
    name: project.name,
    description: project.description,
  });
  return { doc, version: String(project.updatedAt) };
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

  /** Run-level brand (§0.1 item 9): absent = library default, null = none. */
  private brandFor(requested: string | null | undefined): string | undefined {
    if (requested === null) return undefined;
    if (requested) return requested;
    return getDefaultBrandId();
  }

  async start(req: StartFlowRunRequest): Promise<{ runId: string }> {
    const { doc, version } = loadDoc(req.flowId);
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
    const row = loadRun(runId);
    if (!row) throw new Error('That run no longer exists.');
    const { doc } = loadDoc(row.flowId);
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
