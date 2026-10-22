import type { StudioProject } from '../../../shared/types/studio';
import { renameWithRetry } from '../../utils/rename-retry';
import { projectTmpPath, type ProjectFs } from './project-file';
import { migrateProject } from './project-store';
import { getProjectFilePath } from './studio-paths';

export interface RecoveryLog {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

/** What an open found in `project.json.tmp`. */
export type TmpRecovery =
  /** No .tmp — the normal case. */
  | { kind: 'none' }
  /** A newer .tmp was renamed over project.json; read project.json now. */
  | { kind: 'finalized' }
  /** A newer .tmp, but project.json is still held: open this document, unsaved. */
  | { kind: 'loaded'; project: StudioProject }
  /** An older or unusable .tmp — moved aside (kept), project.json opens as is. */
  | { kind: 'ignored' };

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function readUpdated(pfs: ProjectFs, file: string): Promise<{ updatedAt: number; mtimeMs: number } | null> {
  try {
    const raw = JSON.parse(await pfs.readFile(file)) as { updatedAt?: unknown };
    const updatedAt = typeof raw.updatedAt === 'string' ? Date.parse(raw.updatedAt) : Number.NaN;
    return { updatedAt, mtimeMs: (await pfs.stat(file)).mtimeMs };
  } catch {
    return null; // missing or corrupt — anything usable beats it
  }
}

/**
 * Recovery on open (B5 fix round 1). A `project.json.tmp` is left when a
 * write's rename never happened — project.json was held open past main's
 * retries, or the app quit while it was. When the .tmp parses as a project
 * and is newer than project.json (`updatedAt`, else file time), it becomes
 * project.json; when project.json is still held, the caller opens the .tmp's
 * document as unsaved. Anything else is moved aside as
 * `project.json.tmp.ignored-<time>` and logged — never deleted, and never
 * left where the next save would overwrite it.
 */
export async function recoverProjectTmp(
  pfs: ProjectFs,
  projectDir: string,
  folderId: string,
  log: RecoveryLog,
): Promise<TmpRecovery> {
  const tmpPath = projectTmpPath(projectDir);
  const jsonPath = getProjectFilePath(projectDir);
  let text: string;
  try {
    text = await pfs.readFile(tmpPath);
  } catch {
    return { kind: 'none' };
  }

  let reason: string;
  let project: StudioProject | null = null;
  try {
    project = migrateProject(JSON.parse(text), folderId);
    const tmp = await readUpdated(pfs, tmpPath);
    const current = await readUpdated(pfs, jsonPath);
    const newer =
      !current ||
      !tmp ||
      (Number.isFinite(tmp.updatedAt) && Number.isFinite(current.updatedAt)
        ? tmp.updatedAt > current.updatedAt
        : tmp.mtimeMs > current.mtimeMs);
    reason = newer ? '' : 'older than project.json';
  } catch (err) {
    reason = `not a usable project (${errorText(err)})`;
  }

  if (project && reason === '') {
    try {
      await renameWithRetry(tmpPath, jsonPath, { renameImpl: pfs.rename });
      log.info('Recovered unsaved changes from project.json.tmp', { projectDir, updatedAt: project.updatedAt });
      return { kind: 'finalized' };
    } catch (err) {
      log.warn('Recovered project.json.tmp, but project.json is still held — opening it unsaved', {
        projectDir,
        error: errorText(err),
      });
      return { kind: 'loaded', project };
    }
  }

  const keptAs = `${tmpPath}.ignored-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try {
    await pfs.rename(tmpPath, keptAs);
    log.warn('Ignored project.json.tmp — kept aside', { projectDir, reason, keptAs });
  } catch (err) {
    log.warn('Ignored project.json.tmp — could not move it aside', { projectDir, reason, error: errorText(err) });
  }
  return { kind: 'ignored' };
}
