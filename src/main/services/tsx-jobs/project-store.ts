import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { getProjectsDir } from '../../utils/paths';

const MAX_NAME_ATTEMPTS = 100;

function sanitizeProjectName(name: string): string {
  const cleaned = name.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return cleaned.length >= 2 ? cleaned : `motion-${Date.now()}`;
}

/**
 * Atomically reserve a project folder. A non-recursive mkdir throws EEXIST on
 * collision (unlike the fileCreateFolder IPC handler's mkdir -p), so two jobs
 * finishing with the same LLM-generated name get "-2", "-3", ... suffixes
 * instead of silently writing into each other's folders.
 */
export async function reserveProjectFolder(
  baseName: string,
  parentDir?: string,
): Promise<{ folderPath: string; name: string }> {
  const projectsDir = parentDir ?? getProjectsDir();
  await fs.mkdir(projectsDir, { recursive: true });

  const base = sanitizeProjectName(baseName);
  for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
    const name = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const folderPath = path.join(projectsDir, name);
    try {
      await fs.mkdir(folderPath);
      return { folderPath, name };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error(`Could not reserve a unique project folder for "${base}"`);
}

/**
 * Write the next vN.tsx in a project folder. The version number comes from the
 * directory listing at write time (not any in-memory count) and the write uses
 * the 'wx' flag, so concurrent writers never overwrite each other's versions.
 */
export async function writeNextVersion(folderPath: string, content: string): Promise<string> {
  const entries = await fs.readdir(folderPath);
  let maxVersion = 0;
  for (const entry of entries) {
    const match = entry.match(/^v(\d+)\.tsx$/);
    if (match) maxVersion = Math.max(maxVersion, Number(match[1]));
  }

  for (let next = maxVersion + 1; next <= maxVersion + MAX_NAME_ATTEMPTS; next++) {
    const versionPath = path.join(folderPath, `v${next}.tsx`);
    try {
      await fs.writeFile(versionPath, content, { encoding: 'utf-8', flag: 'wx' });
      return versionPath;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error(`Could not allocate a version slot in "${folderPath}"`);
}

/** Write the .debug.json sidecar next to a version file. */
export async function writeDebugSidecar(versionPath: string, data: unknown): Promise<void> {
  const debugPath = versionPath.replace(/\.tsx$/, '.debug.json');
  await fs.writeFile(debugPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Sidecar fields for the exact system prompt a version was generated with:
 * full text for forensics, a hash for cheap cross-version "did it change?",
 * and the ordered `## ` section titles as a table of contents. Empty object
 * when the pipeline didn't report one (older engine paths).
 */
export function describeSystemPrompt(systemPrompt: string | undefined): Record<string, unknown> {
  if (!systemPrompt) return {};
  const sections = systemPrompt
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
  return {
    systemPrompt,
    systemPromptSha256: createHash('sha256').update(systemPrompt).digest('hex'),
    systemPromptSections: sections,
  };
}
