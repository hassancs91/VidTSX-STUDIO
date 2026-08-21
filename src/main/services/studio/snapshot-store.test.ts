import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { StudioProject } from '../../../shared/types/studio';

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
  shell: { trashItem: async () => {} },
}));

// Bypass settings-db/sqlite — the paths module only needs a projects root.
vi.mock('../settings', () => ({
  getStudioProjectsRoot: async () => path.join(tmpDir, 'studio'),
}));

import {
  listSnapshots,
  readSnapshot,
  selectSnapshotsToPrune,
  snapshotIfDue,
  snapshotOnOpen,
  snapshotSavedAt,
  writeSnapshot,
  SNAPSHOT_KEEP_RECENT,
} from './snapshot-store';

function makeProject(id: string, updatedAt: string): StudioProject {
  return {
    schemaVersion: 1,
    id,
    name: id,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt,
    settings: { width: 1920, height: 1080, fps: 30, agent: {} },
    assets: [],
    timeline: { tracks: [] },
    proposals: [],
    shots: [],
  };
}

async function snapshotsDir(id: string): Promise<string> {
  return path.join(tmpDir, 'studio', 'projects', id, 'snapshots');
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-snapshot-store-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-21T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('snapshot file names', () => {
  it('round-trips the ISO stamp through the flattened file name', async () => {
    const project = makeProject('stamp-roundtrip', '2026-08-20T00:00:00.000Z');
    const file = await writeSnapshot(project);
    expect(file).toBe('project.2026-08-21T10-00-00-000Z.json');
    expect(snapshotSavedAt(file)).toBe('2026-08-21T10:00:00.000Z');
  });

  it('ignores foreign file names when listing', async () => {
    const project = makeProject('foreign-files', '2026-08-20T00:00:00.000Z');
    await writeSnapshot(project);
    const dir = await snapshotsDir(project.id);
    await fs.writeFile(path.join(dir, 'notes.txt'), 'hi', 'utf-8');
    await fs.writeFile(path.join(dir, 'project.json'), '{}', 'utf-8');
    const listed = await listSnapshots(project.id);
    expect(listed).toHaveLength(1);
  });
});

describe('write / read round-trip', () => {
  it('restores the exact document, re-validated through migrateProject', async () => {
    const project = makeProject('round-trip', '2026-08-20T00:00:00.000Z');
    const file = await writeSnapshot(project);
    const restored = await readSnapshot(project.id, file);
    expect(restored.id).toBe('round-trip');
    expect(restored.settings.fps).toBe(30);
  });

  it('refuses file names outside the snapshot pattern (path safety)', async () => {
    await expect(readSnapshot('round-trip', '..\\project.json')).rejects.toThrow(
      /Invalid snapshot file name/,
    );
    await expect(readSnapshot('round-trip', 'evil.json')).rejects.toThrow(
      /Invalid snapshot file name/,
    );
  });

  it('throws on a corrupt snapshot instead of returning garbage', async () => {
    const project = makeProject('corrupt', '2026-08-20T00:00:00.000Z');
    await writeSnapshot(project);
    const dir = await snapshotsDir(project.id);
    const badName = 'project.2026-08-21T09-00-00-000Z.json';
    await fs.writeFile(path.join(dir, badName), 'not json', 'utf-8');
    await expect(readSnapshot(project.id, badName)).rejects.toThrow();
  });
});

describe('snapshotOnOpen', () => {
  it('writes a pre-edit copy on first open and skips unchanged reopens', async () => {
    const project = makeProject('on-open', '2026-08-20T00:00:00.000Z');
    await snapshotOnOpen(project);
    expect(await listSnapshots(project.id)).toHaveLength(1);

    // Reopen with no edits since the snapshot — no churn.
    await snapshotOnOpen(project);
    expect(await listSnapshots(project.id)).toHaveLength(1);

    // Edited (saved) after the snapshot — the next open snapshots again.
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));
    const edited = { ...project, updatedAt: '2026-08-21T11:00:00.000Z' };
    await snapshotOnOpen(edited);
    expect(await listSnapshots(project.id)).toHaveLength(2);
  });
});

describe('snapshotIfDue', () => {
  it('writes only when the newest snapshot is older than the interval', async () => {
    const project = makeProject('interval', '2026-08-20T00:00:00.000Z');
    await writeSnapshot(project);

    vi.setSystemTime(new Date('2026-08-21T10:05:00.000Z'));
    await snapshotIfDue(project);
    expect(await listSnapshots(project.id)).toHaveLength(1); // 5 min — not due

    vi.setSystemTime(new Date('2026-08-21T10:11:00.000Z'));
    await snapshotIfDue(project);
    expect(await listSnapshots(project.id)).toHaveLength(2); // 11 min — due
  });

  it('writes the first snapshot when none exist', async () => {
    const project = makeProject('interval-first', '2026-08-20T00:00:00.000Z');
    await snapshotIfDue(project);
    expect(await listSnapshots(project.id)).toHaveLength(1);
  });
});

describe('selectSnapshotsToPrune', () => {
  const entry = (iso: string) => ({ file: `project.${iso.replace(/[:.]/g, '-')}.json`, savedAt: iso });

  it('keeps everything under the recent cap', () => {
    const files = Array.from({ length: SNAPSHOT_KEEP_RECENT }, (_, i) =>
      entry(`2026-08-21T10:${String(i).padStart(2, '0')}:00.000Z`),
    );
    expect(selectSnapshotsToPrune(files)).toEqual([]);
  });

  it('thins older-than-recent snapshots to the newest per UTC day', () => {
    // 3 recent + cap 2 → 1 older entry beyond the cap per day group.
    const files = [
      entry('2026-08-21T10:00:00.000Z'),
      entry('2026-08-21T09:00:00.000Z'),
      // Older than the cap: two on the 20th, one on the 19th.
      entry('2026-08-20T18:00:00.000Z'),
      entry('2026-08-20T09:00:00.000Z'),
      entry('2026-08-19T09:00:00.000Z'),
    ];
    const pruned = selectSnapshotsToPrune(files, 2);
    // The newest of the 20th survives as that day's representative; the 19th's
    // only entry survives too.
    expect(pruned).toEqual([entry('2026-08-20T09:00:00.000Z').file]);
  });

  it('sorts unsorted input itself', () => {
    const files = [
      entry('2026-08-19T09:00:00.000Z'),
      entry('2026-08-21T10:00:00.000Z'),
      entry('2026-08-19T08:00:00.000Z'),
    ];
    expect(selectSnapshotsToPrune(files, 1)).toEqual([entry('2026-08-19T08:00:00.000Z').file]);
  });
});

describe('retention on write', () => {
  it('prunes same-day snapshots beyond the recent cap down to one', async () => {
    const project = makeProject('retention', '2026-08-20T00:00:00.000Z');
    const writes = SNAPSHOT_KEEP_RECENT + 2;
    for (let i = 0; i < writes; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 7, 21, 10, i, 0)));
      await writeSnapshot(project);
    }
    // Newest 20 whole + the single same-day representative of the older two.
    expect(await listSnapshots(project.id)).toHaveLength(SNAPSHOT_KEEP_RECENT + 1);
  });
});
