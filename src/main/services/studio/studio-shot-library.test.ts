import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('./studio-paths', () => ({
  getStudioProjectsDir: () => Promise.resolve(tmpProjects),
}));

import { listStudioShotLibrary } from './studio-shot-library';

let tmpProjects: string;

async function makeProject(
  id: string,
  name: string,
  shots: Record<string, { registryName?: string; files: string[] }>,
): Promise<void> {
  const dir = path.join(tmpProjects, id);
  await fs.mkdir(path.join(dir, 'shots'), { recursive: true });
  const registry = Object.entries(shots)
    .filter(([, s]) => s.registryName)
    .map(([shotId, s]) => ({
      id: shotId,
      name: s.registryName,
      kind: 'cutaway',
      createdAt: 'x',
      activeVersion: 1,
      status: 'ready',
    }));
  await fs.writeFile(
    path.join(dir, 'project.json'),
    JSON.stringify({ id, name, shots: registry }),
    'utf-8',
  );
  for (const [shotId, spec] of Object.entries(shots)) {
    const shotDir = path.join(dir, 'shots', shotId);
    await fs.mkdir(shotDir, { recursive: true });
    for (const file of spec.files) {
      await fs.writeFile(path.join(shotDir, file), '// tsx', 'utf-8');
    }
  }
}

beforeEach(async () => {
  tmpProjects = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-library-'));
});

describe('listStudioShotLibrary', () => {
  it('lists shot folders with registry names and ascending versions', async () => {
    await makeProject('raw-test', 'Raw Footage Test', {
      'intro-title': { registryName: 'Intro title', files: ['v1.tsx', 'v2.tsx', 'chat.json'] },
      'dropped-in': { files: ['v1.tsx'] }, // unregistered drop-in still listed
      'reserved-empty': { files: ['chat.json'] }, // no versions — hidden
    });

    const projects = await listStudioShotLibrary();
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ projectId: 'raw-test', projectName: 'Raw Footage Test' });

    const byId = new Map(projects[0]!.shots.map((s) => [s.shotId, s]));
    expect([...byId.keys()].sort()).toEqual(['dropped-in', 'intro-title']);
    expect(byId.get('intro-title')!.name).toBe('Intro title');
    expect(byId.get('dropped-in')!.name).toBe('Dropped In'); // unslugged fallback
    const versions = byId.get('intro-title')!.versions;
    expect(versions.map((v) => path.basename(v))).toEqual(['v1.tsx', 'v2.tsx']);
  });

  it('skips projects without shots and folders that are not projects', async () => {
    await makeProject('no-shots', 'Empty', {});
    await fs.mkdir(path.join(tmpProjects, 'not-a-project'), { recursive: true });
    expect(await listStudioShotLibrary()).toEqual([]);
  });

  it('returns [] when the projects root does not exist yet', async () => {
    tmpProjects = path.join(tmpProjects, 'missing');
    expect(await listStudioShotLibrary()).toEqual([]);
  });
});
