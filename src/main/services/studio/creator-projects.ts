// Creator projects, listed for Studio's import picker (TSX_SHOTS_DESIGN.md
// §D14). The Creator writes folders of `v*.tsx` under getProjectsDir(), so
// "list what can be imported" is a folder scan — folder-as-truth, like the
// caption-pack loader and the shot version list.
//
// This is a SOURCE ADAPTER, not the import path: it only turns folders into
// {name, updatedAt, latest version, file}. The accept path (shot-import.ts)
// takes a file and a name from anywhere and never learns the Creator exists.

import fs from 'fs/promises';
import path from 'path';
import type { StudioCreatorProject } from '../../../shared/ipc/types';
import { getProjectsDir } from '../../utils/paths';

const VERSION_PATTERN = /^v(\d+)\.tsx$/;

/** Latest `v<n>.tsx` in a folder with its mtime, or null when there is none. */
async function readLatestVersion(
  folderPath: string,
): Promise<{ version: number; filePath: string; updatedAt: string } | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(folderPath);
  } catch {
    return null;
  }
  let latest = 0;
  for (const entry of entries) {
    const match = VERSION_PATTERN.exec(entry);
    if (match) latest = Math.max(latest, Number(match[1]));
  }
  if (latest === 0) return null;

  const filePath = path.join(folderPath, `v${latest}.tsx`);
  try {
    const stat = await fs.stat(filePath);
    return { version: latest, filePath, updatedAt: stat.mtime.toISOString() };
  } catch {
    return null;
  }
}

/**
 * Every importable Creator project under one root, newest first. The root is a
 * parameter so this half is testable without electron (caption-packs pattern).
 * Folders with no version file are simply skipped — an empty or half-written
 * project is not an error, it is just nothing to import.
 */
export async function scanCreatorProjects(root: string): Promise<StudioCreatorProject[]> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return []; // Creator never ran on this machine — an empty picker, not a failure.
  }

  const projects: StudioCreatorProject[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const latest = await readLatestVersion(path.join(root, entry.name));
    if (!latest) continue;
    projects.push({
      id: entry.name,
      name: entry.name,
      updatedAt: latest.updatedAt,
      latestVersion: latest.version,
      filePath: latest.filePath,
    });
  }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Importable Creator projects. Scanned per call — the picker asks on open. */
export async function listCreatorProjects(): Promise<StudioCreatorProject[]> {
  return scanCreatorProjects(getProjectsDir());
}
