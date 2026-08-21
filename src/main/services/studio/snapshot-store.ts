// Rotating project.json snapshots (NEXT_FEATURES_DESIGN.md Q10).
//
// Snapshots live in <project>/snapshots/ beside project.json — NEVER under
// cache/ (Clear Cache must not eat history; the agent-chat rotation
// precedent). They are taken on project open (pre-edit safety copy) and every
// 10 minutes of active editing (the save handler checks staleness, so there
// is no timer churn while idle). Retention keeps the newest 20 whole and
// thins older ones to the newest per UTC day.

import fs from 'fs/promises';
import path from 'path';
import type { StudioProject } from '../../../shared/types/studio';
import type { StudioProjectSnapshotInfo } from '../../../shared/ipc/types/studio';
import { migrateProject } from './project-store';
import { getProjectDir } from './studio-paths';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('SnapshotStore');

export const SNAPSHOT_KEEP_RECENT = 20;
export const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

// project.<ISO-ts>.json with ':' and '.' flattened to '-' so the stamp is a
// legal Windows file name: project.2026-08-21T14-30-05-123Z.json
const SNAPSHOT_PATTERN = /^project\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.json$/;

function stampToFileName(iso: string): string {
  return `project.${iso.replace(/[:.]/g, '-')}.json`;
}

/** Reverse of the file-name flattening — ISO timestamp, or null for foreign files. */
export function snapshotSavedAt(file: string): string | null {
  const stamp = SNAPSHOT_PATTERN.exec(file)?.[1];
  if (!stamp) return null;
  return stamp.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)$/, '$1:$2:$3.$4');
}

async function getSnapshotsDir(projectId: string): Promise<string> {
  return path.join(await getProjectDir(projectId), 'snapshots');
}

/** Newest first. Foreign or corrupt file names are ignored, never deleted. */
export async function listSnapshots(projectId: string): Promise<StudioProjectSnapshotInfo[]> {
  const dir = await getSnapshotsDir(projectId);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return []; // No snapshots yet.
  }
  const infos: StudioProjectSnapshotInfo[] = [];
  for (const name of names) {
    const savedAt = snapshotSavedAt(name);
    if (!savedAt) continue;
    try {
      const stat = await fs.stat(path.join(dir, name));
      infos.push({ file: name, savedAt, sizeBytes: stat.size });
    } catch {
      // Deleted between readdir and stat — skip.
    }
  }
  infos.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return infos;
}

/**
 * Which snapshot files retention deletes: the newest `keepRecent` stay whole,
 * older ones thin to the newest per UTC day. Pure — unit-tested directly.
 */
export function selectSnapshotsToPrune(
  files: Array<{ file: string; savedAt: string }>,
  keepRecent = SNAPSHOT_KEEP_RECENT,
): string[] {
  const sorted = [...files].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const keptDays = new Set<string>();
  const prune: string[] = [];
  for (const entry of sorted.slice(keepRecent)) {
    const day = entry.savedAt.slice(0, 10);
    if (keptDays.has(day)) prune.push(entry.file);
    else keptDays.add(day);
  }
  return prune;
}

/** Atomic snapshot write (temp + rename), then retention prune. Returns the file name. */
export async function writeSnapshot(project: StudioProject): Promise<string> {
  const dir = await getSnapshotsDir(project.id);
  await fs.mkdir(dir, { recursive: true });
  const file = stampToFileName(new Date().toISOString());
  const finalPath = path.join(dir, file);
  const tmpPath = `${finalPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(project, null, 2), 'utf-8');
  await fs.rename(tmpPath, finalPath);

  for (const name of selectSnapshotsToPrune(await listSnapshots(project.id))) {
    await fs.unlink(path.join(dir, name)).catch(() => {});
  }
  return file;
}

/**
 * Pre-edit safety copy on project open. Skips when the newest snapshot is at
 * or after the document's last save — reopening an untouched project must not
 * churn identical copies through retention.
 */
export async function snapshotOnOpen(project: StudioProject): Promise<void> {
  try {
    const newest = (await listSnapshots(project.id))[0];
    if (newest && newest.savedAt >= project.updatedAt) return;
    await writeSnapshot(project);
  } catch (err) {
    log.warn('Open snapshot failed (non-fatal)', { projectId: project.id, error: msg(err) });
  }
}

/** Called per autosave: writes only when the newest snapshot has gone stale,
 *  which is what turns "every save" into "every ~10 minutes of editing". */
export async function snapshotIfDue(project: StudioProject): Promise<void> {
  try {
    const newest = (await listSnapshots(project.id))[0];
    if (newest && Date.now() - Date.parse(newest.savedAt) < SNAPSHOT_INTERVAL_MS) return;
    await writeSnapshot(project);
  } catch (err) {
    log.warn('Interval snapshot failed (non-fatal)', { projectId: project.id, error: msg(err) });
  }
}

/** Read + validate one snapshot. The file name becomes a path segment, so it
 *  must match the snapshot pattern exactly — anything else is refused. */
export async function readSnapshot(projectId: string, file: string): Promise<StudioProject> {
  if (!SNAPSHOT_PATTERN.test(file)) {
    throw new Error(`Invalid snapshot file name: ${file}`);
  }
  const raw = await fs.readFile(path.join(await getSnapshotsDir(projectId), file), 'utf-8');
  return migrateProject(JSON.parse(raw), projectId);
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
