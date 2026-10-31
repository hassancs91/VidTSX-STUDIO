import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

import { STUDIO_SCHEMA_VERSION, type StudioProject } from '../../../shared/types/studio';
// The renderer's autosave, unchanged — the model runs both halves of a save.
import { createAutosave } from '../../../features/studio/services/autosave';
import { createProjectWriter, nodeProjectFs, type ProjectFs } from './project-writer';

const DIR = 'C:/fake/projects/p1';
/** The fake clock starts here; `original` was saved at T0. */
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const JSON_PATH = path.join(DIR, 'project.json');
const TMP_PATH = `${JSON_PATH}.tmp`;

function makeProject(name: string, updatedAt = '2026-10-22T10:00:00.000Z'): StudioProject {
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: 'p1',
    name,
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt,
    settings: { width: 1920, height: 1080, fps: 60, agent: {} },
    assets: [],
    timeline: { tracks: [] },
    proposals: [],
    shots: [],
  };
}

const errno = (code: string) => Object.assign(new Error(`${code}: fake`), { code });

/** project.json held open with no sharing until T0 + `holdMs` (Date.now, fake
 *  clock): a rename onto or off it is refused with EPERM, as on Windows. */
function fakeDisk(holdMs: number) {
  const lockedUntil = T0 + holdMs;
  const files = new Map<string, { data: string; mtimeMs: number }>();
  const pfs: ProjectFs = {
    readFile: async (p) => {
      const f = files.get(p);
      if (!f) throw errno('ENOENT');
      return f.data;
    },
    writeFile: async (p, data) => {
      files.set(p, { data, mtimeMs: Date.now() });
    },
    rename: async (from, to) => {
      if (Date.now() < lockedUntil && (to === JSON_PATH || from === JSON_PATH)) throw errno('EPERM');
      const f = files.get(from);
      if (!f) throw errno('ENOENT');
      files.delete(from);
      files.set(to, f);
    },
    stat: async (p) => {
      const f = files.get(p);
      if (!f) throw errno('ENOENT');
      return { mtimeMs: f.mtimeMs };
    },
  };
  const nameOf = (p: string): string | null => {
    const f = files.get(p);
    return f ? (JSON.parse(f.data) as StudioProject).name : null;
  };
  return { files, pfs, nameOf };
}

const quietLog = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

/** The renderer's autosave wired to main's writer the way the IPC wires them. */
function editor(writer: ReturnType<typeof createProjectWriter>) {
  const autosave = createAutosave<StudioProject>({
    save: async (doc) => {
      try {
        await writer.save(doc);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    onState: () => {},
    debounceMs: 600,
  });
  return autosave;
}

describe('close during a lock (B5 verifier round 1: 10 s hold, edit at +1.6 s)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([2000, 2300, 3000, 6200])('close at +%i ms → the edit is on disk after the hold', async (closeAt) => {
    vi.useFakeTimers({ now: T0 });
    const disk = fakeDisk(10_000);
    disk.files.set(JSON_PATH, { data: JSON.stringify(makeProject('original')), mtimeMs: 0 });
    const log = quietLog();
    const writer = createProjectWriter({ fs: disk.pfs, projectDir: async () => DIR, log });
    const autosave = editor(writer);
    autosave.reset(makeProject('original'));

    await vi.advanceTimersByTimeAsync(1600);
    autosave.update(makeProject('edited'));
    await vi.advanceTimersByTimeAsync(closeAt - 1600);

    // The editor's close path (useStudioProject cleanup): hand the unsaved
    // document to main, then the editor is gone.
    const unsaved = autosave.takeUnsaved();
    autosave.dispose();
    expect(unsaved?.name).toBe('edited');
    if (unsaved) writer.handOff(unsaved);

    await vi.advanceTimersByTimeAsync(9_999 - closeAt);
    expect(disk.nameOf(JSON_PATH)).toBe('original'); // still held
    await vi.advanceTimersByTimeAsync(20_000);
    expect(disk.nameOf(JSON_PATH)).toBe('edited');
    expect(disk.files.has(TMP_PATH)).toBe(false);
    expect(writer.pendingIds()).toEqual([]);
    expect(log.info).toHaveBeenCalled();
  });

  it('keeps retrying for minutes, then gives up and leaves the .tmp (bounded, logged)', async () => {
    vi.useFakeTimers({ now: T0 });
    const disk = fakeDisk(Number.POSITIVE_INFINITY);
    disk.files.set(JSON_PATH, { data: JSON.stringify(makeProject('original')), mtimeMs: 0 });
    const log = quietLog();
    const writer = createProjectWriter({ fs: disk.pfs, projectDir: async () => DIR, log, giveUpAfterMs: 5 * 60_000 });
    writer.handOff(makeProject('edited'));
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(writer.pendingIds()).toEqual(['p1']);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(writer.pendingIds()).toEqual([]);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(disk.nameOf(TMP_PATH)).toBe('edited');
    expect(disk.nameOf(JSON_PATH)).toBe('original');
    // Nothing is still scheduled once it gave up.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a later save of the reopened editor supersedes a pending hand-off', async () => {
    vi.useFakeTimers({ now: T0 });
    const disk = fakeDisk(5_000);
    disk.files.set(JSON_PATH, { data: JSON.stringify(makeProject('original')), mtimeMs: 0 });
    const writer = createProjectWriter({ fs: disk.pfs, projectDir: async () => DIR, log: quietLog() });
    writer.handOff(makeProject('handed-off'));
    await vi.advanceTimersByTimeAsync(1_000);
    // Reopen while still held: load returns the pending document, unsaved.
    const loadP = writer.load('p1');
    await vi.advanceTimersByTimeAsync(2_000);
    const loaded = await loadP;
    expect(loaded.project.name).toBe('handed-off');
    expect(loaded.unsaved).toBe(true);
    expect(loaded.recovered).toBe(true);
    expect(writer.pendingIds()).toEqual([]);
    await vi.advanceTimersByTimeAsync(3_000);
    await writer.save(makeProject('newer'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(disk.nameOf(JSON_PATH)).toBe('newer');
  });
});

describe('quit during a lock (bounded wait, then recovery on the next open)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('quit at +2.0 s leaves the edit in project.json.tmp; the next open recovers it once', async () => {
    vi.useFakeTimers({ now: T0 });
    const disk = fakeDisk(10_000);
    disk.files.set(JSON_PATH, { data: JSON.stringify(makeProject('original')), mtimeMs: 0 });
    const writer = createProjectWriter({ fs: disk.pfs, projectDir: async () => DIR, log: quietLog() });
    const autosave = editor(writer);
    autosave.reset(makeProject('original'));
    await vi.advanceTimersByTimeAsync(1600);
    autosave.update(makeProject('edited'));
    await vi.advanceTimersByTimeAsync(400);

    // The quit flush request: hand off, ack; then main's shutdown drains.
    const unsaved = autosave.takeUnsaved();
    if (unsaved) writer.handOff(unsaved);
    const drained = writer.drain(4_000);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await drained).toEqual(['p1']);
    expect(disk.nameOf(JSON_PATH)).toBe('original');
    expect(disk.nameOf(TMP_PATH)).toBe('edited');

    // Next launch, the hold is over: a fresh writer finds the newer .tmp.
    await vi.advanceTimersByTimeAsync(5_000);
    const next = createProjectWriter({ fs: disk.pfs, projectDir: async () => DIR, log: quietLog() });
    const first = await next.load('p1');
    expect(first.project.name).toBe('edited');
    expect(first.recovered).toBe(true);
    expect(first.unsaved).toBeUndefined();
    expect(disk.nameOf(JSON_PATH)).toBe('edited');
    expect(disk.files.has(TMP_PATH)).toBe(false);
    const second = await next.load('p1');
    expect(second.recovered).toBeUndefined();
  });

  it('opening while project.json is still held loads the .tmp and marks it unsaved', async () => {
    vi.useFakeTimers({ now: T0 });
    const disk = fakeDisk(60_000);
    disk.files.set(JSON_PATH, { data: JSON.stringify(makeProject('original')), mtimeMs: 0 });
    disk.files.set(TMP_PATH, {
      data: JSON.stringify(makeProject('edited', '2026-10-22T10:05:00.000Z')),
      mtimeMs: 1,
    });
    const writer = createProjectWriter({ fs: disk.pfs, projectDir: async () => DIR, log: quietLog() });
    const loadP = writer.load('p1');
    await vi.advanceTimersByTimeAsync(5_000);
    const loaded = await loadP;
    expect(loaded.project.name).toBe('edited');
    expect(loaded.recovered).toBe(true);
    expect(loaded.unsaved).toBe(true);
  });

  it('drain returns at once when nothing is pending', async () => {
    const writer = createProjectWriter({ fs: fakeDisk(0).pfs, projectDir: async () => DIR, log: quietLog() });
    expect(await writer.drain(4_000)).toEqual([]);
  });
});

describe('recovery on open (real files)', () => {
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-project-writer-test-'));
  });
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function projectFolder(name: string, json: string, tmp: string | null): Promise<string> {
    const dir = path.join(tmpDir, name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'project.json'), json, 'utf-8');
    if (tmp !== null) await fs.writeFile(path.join(dir, 'project.json.tmp'), tmp, 'utf-8');
    return dir;
  }
  const writerFor = (dir: string, log = quietLog()) =>
    createProjectWriter({ fs: nodeProjectFs, projectDir: async () => dir, log });

  it('a newer valid .tmp is finalized and reported as recovered', async () => {
    const dir = await projectFolder(
      'newer',
      JSON.stringify(makeProject('original', '2026-10-22T10:00:00.000Z')),
      JSON.stringify(makeProject('edited', '2026-10-22T10:00:02.300Z')),
    );
    const loaded = await writerFor(dir).load('p1');
    expect(loaded.project.name).toBe('edited');
    expect(loaded.recovered).toBe(true);
    const onDisk = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf-8')) as StudioProject;
    expect(onDisk.name).toBe('edited');
    await expect(fs.access(path.join(dir, 'project.json.tmp'))).rejects.toThrow();
  });

  it.each([
    ['older', JSON.stringify(makeProject('stale', '2026-10-22T09:59:00.000Z'))],
    ['corrupt', '{"schemaVersion": 1, "name": "half-writ'],
    ['not a project', JSON.stringify({ hello: 'world' })],
  ])('an %s .tmp is ignored: project.json loads, the .tmp is kept aside and logged', async (kind, tmp) => {
    const dir = await projectFolder(
      `ignored-${kind.replace(/ /g, '-')}`,
      JSON.stringify(makeProject('original', '2026-10-22T10:00:00.000Z')),
      tmp,
    );
    const log = quietLog();
    const loaded = await writerFor(dir, log).load('p1');
    expect(loaded.project.name).toBe('original');
    expect(loaded.recovered).toBeUndefined();
    expect(log.warn).toHaveBeenCalledTimes(1);
    const names = await fs.readdir(dir);
    expect(names).not.toContain('project.json.tmp');
    const kept = names.filter((n) => n.startsWith('project.json.tmp.ignored-'));
    expect(kept).toHaveLength(1);
    expect(await fs.readFile(path.join(dir, kept[0]), 'utf-8')).toBe(tmp);
  });

  it('no .tmp: a plain load, no flags', async () => {
    const dir = await projectFolder('plain', JSON.stringify(makeProject('original')), null);
    const loaded = await writerFor(dir).load('p1');
    expect(loaded).toEqual({ project: expect.objectContaining({ name: 'original' }) });
  });

  it('save writes through the same atomic path and stamps updatedAt', async () => {
    const dir = await projectFolder('save', JSON.stringify(makeProject('original')), null);
    const updatedAt = await writerFor(dir).save(makeProject('saved'));
    const onDisk = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf-8')) as StudioProject;
    expect(onDisk.name).toBe('saved');
    expect(onDisk.updatedAt).toBe(updatedAt);
    await expect(fs.access(path.join(dir, 'project.json.tmp'))).rejects.toThrow();
  });
});
