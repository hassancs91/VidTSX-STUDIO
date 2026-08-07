import path from 'path';
import fs from 'fs/promises';
import { getStudioProjectsRoot } from '../settings';

/** Folder-name ids only — blocks path traversal through project ids. */
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidProjectId(id: string): boolean {
  return PROJECT_ID_PATTERN.test(id);
}

export async function getStudioProjectsDir(): Promise<string> {
  return path.join(await getStudioProjectsRoot(), 'projects');
}

export async function getProjectDir(projectId: string): Promise<string> {
  if (!isValidProjectId(projectId)) {
    throw new Error(`Invalid project id: ${projectId}`);
  }
  return path.join(await getStudioProjectsDir(), projectId);
}

export async function getProjectCacheDir(projectId: string): Promise<string> {
  return path.join(await getProjectDir(projectId), 'cache');
}

export function getProjectFilePath(projectDir: string): string {
  return path.join(projectDir, 'project.json');
}

/** Create the standard per-project subfolders (idempotent). */
export async function ensureProjectScaffold(projectDir: string): Promise<void> {
  await fs.mkdir(path.join(projectDir, 'cache', 'thumbs'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'shots'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'renders'), { recursive: true });
}

/** Resolve a cache-relative path, refusing anything that escapes cache/. */
export async function safeResolveCachePath(projectId: string, relPath: string): Promise<string> {
  const cacheDir = await getProjectCacheDir(projectId);
  const resolved = path.resolve(cacheDir, relPath);
  if (resolved !== cacheDir && !resolved.startsWith(cacheDir + path.sep)) {
    throw new Error('Cache path escapes the project cache folder');
  }
  return resolved;
}
