// The run folder (flows plan §1.3) and the SQLite summary row beside it.
//
//   <userData>/flows-runs/<flowId>/<runId>/
//       run.json        FlowRunDoc — rewritten after every node (atomic)
//       artifacts.json  the agents' artifact store, same file shape
//       files/          the run workspace: everything a tool writes
//
// W8 Stage 6 moved the root out of the asset library (Stage 1 had
// `<assets>/flows/<flowId>/runs/`): `flow-run-migrate.ts` moves old folders
// once, at startup. A run's MEDIA still files into the library under
// `flows/<flow-slug>/`; only the work folder lives here.
//
// Retention: the last 20 runs per flow. The summary table already prunes
// its rows to that cap; folders whose row is gone are removed here, so the
// two never disagree for long.

import fs from 'fs/promises';
import path from 'path';
import type { FlowRunDoc, FlowRunDocStatus } from '../../../shared/types/flows';
import type { FlowRunStatus } from '../../../shared/ipc/types';
import { AgentArtifactStore } from '../agents/artifact-store';
import { getFlowRunsDir } from '../../utils/paths';
import { listRuns, persistRun } from '../flows-runs-db';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('FlowRuns');

export const RUN_DOC_FILE = 'run.json';
export const RUN_FILES_DIR = 'files';

/** The folder and row operations the runner needs — a seam for its tests. */
export interface FlowRunStore {
  runDir(flowId: string, runId: string): string;
  writeDoc(dir: string, doc: FlowRunDoc): Promise<void>;
  readDoc(dir: string): Promise<FlowRunDoc | null>;
  openArtifacts(dir: string): Promise<AgentArtifactStore>;
  /** The summary row, and the folder prune after it. */
  persistSummary(doc: FlowRunDoc): Promise<void>;
}

export function flowRunsRoot(flowId: string): string {
  return path.join(getFlowRunsDir(), flowId);
}

export function flowRunDir(flowId: string, runId: string): string {
  return path.join(flowRunsRoot(flowId), runId);
}

/**
 * Rename with a short retry. On Windows a rename over a file another process
 * is reading (a poller on `run.json`, a sync client, an antivirus scan) fails
 * with EPERM for the length of that read; Stage 6's acceptance run crashed
 * two flows on exactly that. A few 50 ms retries outlast any plain read.
 */
export async function renameWithRetry(
  from: string,
  to: string,
  attempts = 8,
  renameImpl: (a: string, b: string) => Promise<void> = fs.rename,
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await renameImpl(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') || attempt >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
}

/** Atomic: temp file, then rename. */
export async function writeRunDoc(dir: string, doc: FlowRunDoc): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, RUN_DOC_FILE);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc, null, 2), 'utf-8');
  await renameWithRetry(tmp, file);
}

export async function readRunDoc(dir: string): Promise<FlowRunDoc | null> {
  try {
    const raw = await fs.readFile(path.join(dir, RUN_DOC_FILE), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FlowRunDoc>;
    if (typeof parsed.id !== 'string' || typeof parsed.flowId !== 'string' || typeof parsed.nodes !== 'object') {
      return null;
    }
    return parsed as FlowRunDoc;
  } catch {
    return null;
  }
}

export async function openRunArtifacts(dir: string): Promise<AgentArtifactStore> {
  await fs.mkdir(path.join(dir, RUN_FILES_DIR), { recursive: true });
  return AgentArtifactStore.open(dir);
}

/** The summary row's four states from the doc's six. */
export function toSummaryStatus(status: FlowRunDocStatus): FlowRunStatus {
  switch (status) {
    case 'success':
    case 'error':
    case 'cancelled':
      return status;
    case 'queued':
    case 'running':
    case 'paused':
      return 'running';
  }
}

/** Remove run folders whose summary row the cap already pruned. */
export async function pruneRunFolders(flowId: string): Promise<void> {
  const keep = new Set(listRuns(flowId).map((r) => r.id));
  let entries: string[];
  try {
    entries = await fs.readdir(flowRunsRoot(flowId));
  } catch {
    return;
  }
  for (const name of entries) {
    if (keep.has(name)) continue;
    try {
      await fs.rm(path.join(flowRunsRoot(flowId), name), { recursive: true, force: true });
    } catch (err) {
      log.warn('Could not remove a pruned run folder', {
        flowId,
        runId: name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function persistRunSummary(doc: FlowRunDoc): Promise<void> {
  persistRun({
    id: doc.id,
    flowId: doc.flowId,
    status: toSummaryStatus(doc.status),
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    error: doc.error,
    nodeResults: JSON.stringify(doc.nodes),
  });
  await pruneRunFolders(doc.flowId);
}

export const flowRunStore: FlowRunStore = {
  runDir: flowRunDir,
  writeDoc: writeRunDoc,
  readDoc: readRunDoc,
  openArtifacts: openRunArtifacts,
  persistSummary: persistRunSummary,
};
