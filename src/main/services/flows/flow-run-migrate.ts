// One-time move of run folders out of the asset library (W8 Stage 6).
//
// Stage 1 kept runs at `<assets>/flows/<flowId>/runs/<runId>/`, beside the
// `flows/<slug>/` folders a run's MEDIA lands in — so the Assets screen's
// `flows/` folder showed one opaque ulid folder per flow next to the real
// ones (eleven on the W3 profile by Stage 6). Runs now live at
// `<userData>/flows-runs/<flowId>/<runId>/`; this moves what is there.
//
// Pure over its two roots so it is testable; `flow-service.ts` runs it once
// at startup and awaits it before the first run touches the store. A folder
// that cannot be moved is left in place with a warning — nothing is deleted
// except the empty shells the move leaves behind.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('FlowRunsMigrate');

const LEGACY_RUNS_SEGMENT = 'runs';

export interface RunFolderMigration {
  moved: number;
  skipped: number;
}

async function listDirs(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function removeIfEmpty(dir: string): Promise<void> {
  try {
    if ((await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
  } catch {
    // Not empty, or already gone — either is fine.
  }
}

/**
 * Move every `<legacyFlowsDir>/<flowId>/runs/<runId>` to
 * `<runsRoot>/<flowId>/<runId>`. `rename` first (same volume, instant);
 * a target that already exists is skipped, never overwritten.
 */
export async function migrateLegacyRunFolders(legacyFlowsDir: string, runsRoot: string): Promise<RunFolderMigration> {
  const result: RunFolderMigration = { moved: 0, skipped: 0 };
  for (const flowId of await listDirs(legacyFlowsDir)) {
    const legacyRuns = path.join(legacyFlowsDir, flowId, LEGACY_RUNS_SEGMENT);
    const runIds = await listDirs(legacyRuns);
    if (runIds.length === 0) continue;
    const targetRoot = path.join(runsRoot, flowId);
    await fs.mkdir(targetRoot, { recursive: true });
    for (const runId of runIds) {
      const from = path.join(legacyRuns, runId);
      const to = path.join(targetRoot, runId);
      try {
        await fs.access(to);
        result.skipped += 1;
        continue;
      } catch {
        // Target free — move.
      }
      try {
        await fs.rename(from, to);
        result.moved += 1;
      } catch (err) {
        result.skipped += 1;
        log.warn('Could not move a legacy run folder', { from, to, error: err instanceof Error ? err.message : String(err) });
      }
    }
    await removeIfEmpty(legacyRuns);
    await removeIfEmpty(path.join(legacyFlowsDir, flowId));
  }
  if (result.moved > 0) log.info('Moved legacy flow run folders', { ...result });
  return result;
}
