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

import { createProject, loadProject, migrateProject } from './project-store';

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
});
