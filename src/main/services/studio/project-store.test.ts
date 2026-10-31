import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
  shell: { trashItem: async () => {} },
}));
// Bypass settings-db/sqlite — the store only needs a projects root.
vi.mock('../settings', () => ({
  getStudioProjectsRoot: async () => path.join(tmpDir, 'studio'),
}));

import { createProject, loadProject, migrateProject, saveProject } from './project-store';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-project-store-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('project settings brandId (D11 snapshot-at-creation)', () => {
  it('createProject copies the given brandId into settings; absent stays absent', async () => {
    const branded = await createProject('Branded', 1920, 1080, 30, 'acme');
    expect(branded.settings.brandId).toBe('acme');
    const plain = await createProject('Plain', 1920, 1080, 30);
    expect('brandId' in plain.settings).toBe(false);
  });

  it('brandId survives the disk round-trip through migrateProject', async () => {
    const created = await createProject('Round Trip', 1280, 720, 24, 'acme-2');
    const loaded = await loadProject(created.id);
    expect(loaded.settings.brandId).toBe('acme-2');
  });

  it('migrateProject carries settings wholesale — unknown-at-write fields included', () => {
    const migrated = migrateProject(
      {
        schemaVersion: 1,
        name: 'Legacy',
        settings: { width: 1920, height: 1080, fps: 30, brandId: 'kept', sttModelId: 'also-kept' },
      },
      'legacy-folder',
    );
    expect(migrated.settings.brandId).toBe('kept');
    expect(migrated.settings.sttModelId).toBe('also-kept');
    expect(migrated.settings.agent).toEqual({});
  });

  it('carries the script (W4) as a string, drops a blank one, caps a huge one', () => {
    const base = { schemaVersion: 1, name: 'S', settings: { width: 1, height: 1, fps: 1 } };
    expect(migrateProject({ ...base, script: 'Welcome to VidTSX.' }, 's').script).toBe('Welcome to VidTSX.');
    expect('script' in migrateProject({ ...base, script: '   ' }, 's')).toBe(false);
    expect('script' in migrateProject({ ...base, script: 42 }, 's')).toBe(false);
    expect(migrateProject({ ...base, script: 'x'.repeat(70_000) }, 's').script).toHaveLength(60_000);
  });
});

describe('saveProject on Windows file locks (B5 Problem 5)', () => {
  it('lands the save when the rename over project.json is refused twice (a reader holds the file)', async () => {
    const created = await createProject('Locked', 1920, 1080, 30);
    const realRename = fs.rename.bind(fs);
    let refusals = 0;
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (refusals < 2) {
        refusals += 1;
        const err: NodeJS.ErrnoException = new Error('EPERM: operation not permitted, rename');
        err.code = 'EPERM';
        throw err;
      }
      await realRename(from, to);
    });
    try {
      await saveProject({ ...created, name: 'Locked — saved' });
    } finally {
      spy.mockRestore();
    }
    expect(refusals).toBe(2);
    expect((await loadProject(created.id)).name).toBe('Locked — saved');
  });

  it('still rejects when the lock never clears, and the old file stays intact', async () => {
    const created = await createProject('Always Locked', 1920, 1080, 30);
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async () => {
      const err: NodeJS.ErrnoException = new Error('EBUSY: resource busy or locked, rename');
      err.code = 'EBUSY';
      throw err;
    });
    try {
      await expect(saveProject({ ...created, name: 'never written' })).rejects.toThrow(/EBUSY/);
      expect(spy.mock.calls.length).toBeGreaterThan(1);
    } finally {
      spy.mockRestore();
    }
    expect((await loadProject(created.id)).name).toBe('Always Locked');
  });
});
