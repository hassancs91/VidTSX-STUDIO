// A run's artifacts for the run form (flows plan §1.4, W8 Stage 2): what a
// shared viewer needs to SHOW one (`resolve`), and the shared action bar's
// handoffs (`action`). The agents' resolve/action code is reused with the
// run's `files/` as the workspace — a run's `artifacts.json` has the same
// file shape as a session's, only the root differs.

import fs from 'fs/promises';
import path from 'path';
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

export async function runRunArtifactAction(req: FlowsRunArtifactActionRequest): Promise<FlowsRunArtifactActionResponse> {
  if (req.action === 'send-to-queue') {
    return { success: false, error: 'Rendering from a flow run arrives with Stage 3 — open the composition in the TSX Creator to render it.' };
  }
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
