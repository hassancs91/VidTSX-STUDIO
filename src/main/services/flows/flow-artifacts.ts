// A run's artifacts for the run form (flows plan §1.4, W8 Stage 2): what a
// shared viewer needs to SHOW one (`resolve`), and the shared action bar's
// handoffs (`action`). The agents' resolve/action code is reused with the
// run's `files/` as the workspace — a run's `artifacts.json` has the same
// file shape as a session's, only the root differs.

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  FlowsRunArtifactActionRequest,
  FlowsRunArtifactActionResponse,
  FlowsRunArtifactResolveResponse,
} from '../../../shared/ipc/types';
import { artifactFilesIn, assetUrlFor, ensureCompositionModuleIn } from '../agents/artifact-paths';
import { runArtifactAction } from '../agents/artifact-actions';
import { getDefaultBrandId } from '../library/brand-default';
import { slugifyName } from '../agents/tools/workspace-files';
import { loadFlow } from '../flows-projects-db';
import { loadRun } from '../flows-runs-db';
import { flowRunStore, RUN_FILES_DIR } from './flow-run-store';
import { flowService } from './flow-service';
import { settleRenderJob } from './flow-render';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('FlowArtifacts');

async function openRun(runId: string) {
  const row = loadRun(runId);
  if (!row) throw new Error('That run no longer exists.');
  const dir = flowRunStore.runDir(row.flowId, runId);
  const run = await flowRunStore.readDoc(dir);
  if (!run) throw new Error("That run's folder is gone.");
  const store = await flowRunStore.openArtifacts(dir);
  return { row, run, dir, store, workspaceDir: path.join(dir, RUN_FILES_DIR) };
}

export async function resolveRunArtifact(runId: string, artifactId: string): Promise<FlowsRunArtifactResolveResponse> {
  const { store, workspaceDir } = await openRun(runId);
  const artifact = store.get(artifactId);
  if (!artifact) return { success: false, error: 'That artifact is no longer in this run.' };

  switch (artifact.kind) {
    case 'document': {
      const [file] = await artifactFilesIn(workspaceDir, artifact);
      return { success: true, text: await fs.readFile(file, 'utf-8') };
    }
    case 'composition':
      return { success: true, moduleUrl: await ensureCompositionModuleIn(workspaceDir, artifact) };
    case 'video':
    case 'image-set':
    case 'audio': {
      const assetUrls: string[] = [];
      for (const file of await artifactFilesIn(workspaceDir, artifact)) {
        try {
          await fs.access(file);
          assetUrls.push(await assetUrlFor(file));
        } catch {
          log.warn('A run artifact file is missing', { artifact: artifact.id, file: path.basename(file) });
        }
      }
      return { success: true, assetUrls };
    }
    case 'web-page':
      return { success: false, error: 'Web pages are agent-only in V1 (flows plan §0.1 item 13).' };
    case 'job':
      return { success: true };
  }
}

/**
 * "Render" on a run's composition (W8 Stage 3): the same main-side render a
 * `render_composition` node settles through, started here in the background
 * with a `job` artifact in the run's store so the MP4 lands beside the run's
 * other outputs and in the flow's library folder. Refused while the run is
 * still executing — two writers on one `artifacts.json` is one too many.
 */
async function renderRunComposition(req: FlowsRunArtifactActionRequest): Promise<FlowsRunArtifactActionResponse> {
  if (flowService.isRunning(req.runId)) {
    return { success: false, error: 'This run is still going — wait for it to finish, then render.' };
  }
  const { row, run, store, workspaceDir } = await openRun(req.runId);
  const composition = store.get(req.artifactId);
  if (!composition || composition.kind !== 'composition') {
    return { success: false, error: 'Only a composition can be rendered.' };
  }
  const flow = loadFlow(row.flowId);
  const libraryFolder = `flows/${slugifyName(flow?.name ?? 'flow', 'flow')}`;
  const brandId = run.brandId === null ? undefined : run.brandId || getDefaultBrandId();
  const jobId = randomUUID();
  const job = await store.add(
    { kind: 'job', title: `Render — ${composition.title}`, payload: { jobId, job: 'render', status: 'pending' } },
    { tool: 'render_composition', callId: `action:${jobId}` },
  );
  if (job.kind !== 'job') return { success: false, error: 'Could not create the render job.' };
  void settleRenderJob(job, {
    runId: req.runId,
    store,
    signal: new AbortController().signal,
    workspaceDir,
    libraryFolder,
    ...(brandId ? { brandId } : {}),
    request: {
      jobId,
      job: 'render',
      compositionArtifactId: composition.id,
      config: composition.payload.config,
      outputFolder: libraryFolder,
      outputName: slugifyName(composition.title, 'render'),
    },
    note: (line) => log.info('Run render', { runId: req.runId, jobId, line }),
  }).catch((err: unknown) => {
    log.warn('Run render failed', { runId: req.runId, jobId, error: err instanceof Error ? err.message : String(err) });
  });
  return { success: true };
}

export async function runRunArtifactAction(req: FlowsRunArtifactActionRequest): Promise<FlowsRunArtifactActionResponse> {
  if (req.action === 'send-to-queue') return renderRunComposition(req);
  const { row, run, store, workspaceDir } = await openRun(req.runId);
  const artifact = store.get(req.artifactId);
  if (!artifact) return { success: false, error: 'That artifact is no longer in this run.' };
  const flow = loadFlow(row.flowId);
  const brandId = run.brandId === null ? undefined : run.brandId || getDefaultBrandId();
  return runArtifactAction({
    agentId: `flow:${row.flowId}`,
    sessionId: req.runId,
    artifact,
    action: req.action,
    workspaceDir,
    libraryFolder: `flows/${slugifyName(flow?.name ?? 'flow', 'flow')}`,
    ...(brandId ? { brandId } : {}),
    ...(req.projectId ? { projectId: req.projectId } : {}),
    artifacts: store.list(),
  });
}
