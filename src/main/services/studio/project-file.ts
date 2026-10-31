import fs from 'fs/promises';
import type { StudioProject } from '../../../shared/types/studio';
import { renameWithRetry } from '../../utils/rename-retry';
import { getProjectFilePath } from './studio-paths';

/** The file operations project.json writes and recovery need — node's fs in
 *  the app, an in-memory disk with a simulated Windows lock in tests. */
export interface ProjectFs {
  readFile(file: string): Promise<string>;
  writeFile(file: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  stat(file: string): Promise<{ mtimeMs: number }>;
}

export const nodeProjectFs: ProjectFs = {
  readFile: (file) => fs.readFile(file, 'utf-8'),
  writeFile: (file, data) => fs.writeFile(file, data, 'utf-8'),
  rename: (from, to) => fs.rename(from, to),
  stat: (file) => fs.stat(file),
};

/** Where a write lands before its rename over project.json. A `.tmp` that is
 *  still there means the last write's rename never happened (B5 fix round 1:
 *  project.json was held open) — it holds the newest document. */
export function projectTmpPath(projectDir: string): string {
  return `${getProjectFilePath(projectDir)}.tmp`;
}

/** Atomic write: temp file in the same folder, then rename over project.json.
 *  The rename retries Windows' transient lock errors (an AV scan, an indexer,
 *  a sync client or a script reading project.json) for ~1.4 s — B5 Problem 5;
 *  longer holds are main's project-writer's job. */
export async function writeProjectFileWith(
  pfs: ProjectFs,
  projectDir: string,
  project: StudioProject,
): Promise<void> {
  const tmpPath = projectTmpPath(projectDir);
  await pfs.writeFile(tmpPath, JSON.stringify(project, null, 2));
  await renameWithRetry(tmpPath, getProjectFilePath(projectDir), { renameImpl: pfs.rename });
}
