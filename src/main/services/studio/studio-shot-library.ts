// The Creator library's "Studio" section (SHOT_QUALITY_DESIGN.md Q2):
// every Studio project's shot folders, listed IN PLACE — a live view, not a
// copy. The formats already agree (folder of v*.tsx on both sides), so the
// Creator can open a shot version like any of its own and its save appends
// v(n+1) into the same folder; Studio's version picker folder-scans, so the
// new version shows up there with no sync step. Unregistered folders (fresh
// drop-ins) list too — visibility must not depend on adoption having run.

import fs from 'fs/promises';
import path from 'path';
import type { StudioProject } from '../../../shared/types/studio';
import { isValidShotId } from '../../../shared/studio/shots';
import { getStudioProjectsDir } from './studio-paths';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('StudioShotLibrary');

export interface StudioShotLibraryShot {
  shotId: string;
  /** Registry display name when adopted; unslugged folder name otherwise. */
  name: string;
  folderPath: string;
  /** Absolute version paths, ascending (v1 first). */
  versions: string[];
}

export interface StudioShotLibraryProject {
  projectId: string;
  projectName: string;
  shots: StudioShotLibraryShot[];
}

async function listVersionPaths(folderPath: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(folderPath);
  } catch {
    return [];
  }
  return entries
    .map((entry) => /^v(\d+)\.tsx$/.exec(entry)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number)
    .sort((a, b) => a - b)
    .map((v) => path.join(folderPath, `v${v}.tsx`));
}

function unslug(shotId: string): string {
  return shotId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Scan every Studio project for shot folders holding at least one version. */
export async function listStudioShotLibrary(): Promise<StudioShotLibraryProject[]> {
  const projectsDir = await getStudioProjectsDir();
  let projectFolders: Array<{ name: string; isDirectory(): boolean }>;
  try {
    projectFolders = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return []; // No Studio root yet.
  }

  const result: StudioShotLibraryProject[] = [];
  for (const entry of projectFolders) {
    if (!entry.isDirectory()) continue;
    const projectId = entry.name;
    const projectDir = path.join(projectsDir, projectId);

    let projectName = projectId;
    const registryNames = new Map<string, string>();
    try {
      const raw = await fs.readFile(path.join(projectDir, 'project.json'), 'utf-8');
      const project = JSON.parse(raw) as Partial<StudioProject>;
      if (typeof project.name === 'string' && project.name.trim()) projectName = project.name;
      for (const shot of project.shots ?? []) {
        if (shot && typeof shot.id === 'string' && typeof shot.name === 'string') {
          registryNames.set(shot.id, shot.name);
        }
      }
    } catch {
      continue; // Not a project folder (or unreadable) — skip it entirely.
    }

    const shotsDir = path.join(projectDir, 'shots');
    let shotFolders: Array<{ name: string; isDirectory(): boolean }>;
    try {
      shotFolders = await fs.readdir(shotsDir, { withFileTypes: true });
    } catch {
      continue; // No shots/ scaffold — nothing to list.
    }

    const shots: StudioShotLibraryShot[] = [];
    for (const shotEntry of shotFolders) {
      if (!shotEntry.isDirectory() || !isValidShotId(shotEntry.name)) continue;
      const folderPath = path.join(shotsDir, shotEntry.name);
      const versions = await listVersionPaths(folderPath);
      if (versions.length === 0) continue; // Reserved-but-empty producer window.
      shots.push({
        shotId: shotEntry.name,
        name: registryNames.get(shotEntry.name) ?? unslug(shotEntry.name),
        folderPath,
        versions,
      });
    }
    if (shots.length > 0) {
      result.push({ projectId, projectName, shots });
    }
  }

  log.debug('Listed Studio shot library', { projects: result.length });
  return result;
}
