import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// creator-projects → utils/paths → electron. The scan half takes its root as a
// parameter, so a bare app stub is enough (caption-packs pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import { scanCreatorProjects } from './creator-projects';

let root = '';

/** A Creator project folder: versions plus the debris the Creator leaves. */
async function writeProject(
  name: string,
  versions: number[],
  extras: string[] = [],
): Promise<string> {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  for (const version of versions) {
    await fs.writeFile(path.join(dir, `v${version}.tsx`), `// v${version}\n`, 'utf-8');
  }
  for (const extra of extras) {
    await fs.writeFile(path.join(dir, extra), '{}', 'utf-8');
  }
  return dir;
}

/** mtime is the sort key — set it explicitly so ordering is not a race. */
async function touch(filePath: string, iso: string): Promise<void> {
  const when = new Date(iso);
  await fs.utimes(filePath, when, when);
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'creator-projects-test-'));
  root = path.join(tmpDir, 'projects');
  await fs.mkdir(root, { recursive: true });

  await writeProject('spinning-logo', [1, 2, 3], ['v3.debug.json', 'chat.json']);
  await touch(path.join(root, 'spinning-logo', 'v3.tsx'), '2026-08-10T12:00:00.000Z');

  await writeProject('kinetic-type', [1]);
  await touch(path.join(root, 'kinetic-type', 'v1.tsx'), '2026-08-14T09:30:00.000Z');

  await writeProject('empty-project', []);
  await fs.mkdir(path.join(root, '.hidden'), { recursive: true });
  await fs.writeFile(path.join(root, 'loose.tsx'), '// not a project\n', 'utf-8');
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('scanCreatorProjects', () => {
  it('lists folders with a version file, newest first, pointing at the latest version', async () => {
    const projects = await scanCreatorProjects(root);
    expect(projects.map((p) => p.id)).toEqual(['kinetic-type', 'spinning-logo']);

    const logo = projects[1];
    expect(logo.name).toBe('spinning-logo');
    expect(logo.latestVersion).toBe(3);
    expect(logo.filePath).toBe(path.join(root, 'spinning-logo', 'v3.tsx'));
    expect(logo.updatedAt).toBe('2026-08-10T12:00:00.000Z');
  });

  it('skips folders with no version file, hidden folders, and loose files', async () => {
    const projects = await scanCreatorProjects(root);
    expect(projects.some((p) => p.id === 'empty-project')).toBe(false);
    expect(projects.some((p) => p.id === '.hidden')).toBe(false);
    expect(projects.some((p) => p.id === 'loose.tsx')).toBe(false);
  });

  it('returns an empty list when the Creator never ran (missing root)', async () => {
    expect(await scanCreatorProjects(path.join(tmpDir, 'nope'))).toEqual([]);
  });
});
