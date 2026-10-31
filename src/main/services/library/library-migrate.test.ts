import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LibraryIndexFile } from '../../../shared/types/asset-library';

/** E1: migration (backup, kinds, rev 2, idempotent), probe on upsert / scan, and the back-fill. */

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

const probeMock = vi.hoisted(() => ({
  fail: new Set<string>(),
  calls: [] as string[],
}));

vi.mock('./library-probe', () => ({
  probeLibraryFile: vi.fn(async (abs: string, kind: string) => {
    probeMock.calls.push(path.basename(abs));
    if (probeMock.fail.has(path.basename(abs))) return undefined;
    return kind === 'audio' || kind === 'video' ? { duration: 1.25, hasAudio: true } : undefined;
  }),
}));

import * as oldStore from './pre-e1-control/library-store';
import { SCAN_PROBE_BUDGET, scanLibrary, upsertEntry } from './library-store';
import { getLibraryIndexBackupPath } from './library-index-io';
import { migrateLibraryIndex } from './library-migrate';
import { scheduleProbeBackfill } from './library-backfill';
import { getLibraryIndexPath } from './library-paths';

let root = '';
let n = 0;

const readRaw = async (): Promise<LibraryIndexFile> =>
  JSON.parse(await fs.readFile(getLibraryIndexPath(root), 'utf-8')) as LibraryIndexFile;
const exists = async (p: string): Promise<boolean> => fs.access(p).then(() => true, () => false);

async function put(rel: string, bytes = `bytes-of-${rel}`): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), bytes);
}

beforeEach(async () => {
  if (!tmpDir) tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-library-migrate-'));
  n += 1;
  root = path.join(tmpDir, `assets-${n}`); // fresh root per test (the io module caches per root)
  await fs.mkdir(root, { recursive: true });
  probeMock.fail.clear();
  probeMock.calls.length = 0;
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('migrateLibraryIndex', () => {
  it('a pre-E1 index: one raw backup, kinds back-filled, rev 2, then durations from the back-fill', async () => {
    for (const f of ['a.mp3', 'b.wav', 'c.m4a', 'd.ogg', 'e.opus', 'f.flac', 'g.png', 'h.mp4']) await put(f);
    await oldStore.scanLibrary(root);
    await oldStore.setDescription(root, 'g.png', 'a logo');
    const preE1 = await fs.readFile(getLibraryIndexPath(root), 'utf-8');

    const res = await migrateLibraryIndex(root);
    expect(res).toEqual({ migrated: true, backedUp: true, kindsFilled: 8 });
    expect(await fs.readFile(getLibraryIndexBackupPath(root), 'utf-8')).toBe(preE1);
    const fill = await scheduleProbeBackfill(root);
    expect(fill).toMatchObject({ candidates: 7, probed: 7, written: 7, failed: 0 });

    const raw = await readRaw();
    expect(raw.version).toBe(1);
    expect(raw.rev).toBe(2);
    expect(raw.entries.map((e) => [e.relPath, e.kind, e.probe?.duration])).toEqual([
      ['a.mp3', 'audio', 1.25], ['b.wav', 'audio', 1.25], ['c.m4a', 'audio', 1.25], ['d.ogg', 'audio', 1.25],
      ['e.opus', 'audio', 1.25], ['f.flac', 'audio', 1.25], ['g.png', 'image', undefined], ['h.mp4', 'video', 1.25],
    ]);
    expect(raw.entries.find((e) => e.relPath === 'g.png')?.description).toBe('a logo');

    const again = await migrateLibraryIndex(root);
    expect(again).toMatchObject({ migrated: false, skipped: 'current' });
    expect(await fs.readFile(getLibraryIndexBackupPath(root), 'utf-8')).toBe(preE1);
  });

  it('no index → nothing written (no backup, no index)', async () => {
    await put('a.mp3');
    expect(await migrateLibraryIndex(root)).toMatchObject({ migrated: false, skipped: 'no-index' });
    await scheduleProbeBackfill(root);
    expect(await exists(getLibraryIndexPath(root))).toBe(false);
    expect(await exists(getLibraryIndexBackupPath(root))).toBe(false);
  });

  it('an unreadable or non-v1 index is left alone', async () => {
    await fs.mkdir(path.dirname(getLibraryIndexPath(root)), { recursive: true });
    for (const bytes of ['{ not json', JSON.stringify({ version: 3, entries: [], tombstones: [] })]) {
      await fs.writeFile(getLibraryIndexPath(root), bytes);
      expect(await migrateLibraryIndex(root)).toMatchObject({ migrated: false, skipped: 'not-v1' });
      expect(await fs.readFile(getLibraryIndexPath(root), 'utf-8')).toBe(bytes);
      expect(await exists(getLibraryIndexBackupPath(root))).toBe(false);
    }
  });

  it('a later E1 write backs up a pre-E1 index too, once, even without the migration', async () => {
    await put('a.mp3');
    await oldStore.scanLibrary(root);
    const preE1 = await fs.readFile(getLibraryIndexPath(root), 'utf-8');
    await put('b.mp3');
    await scanLibrary(root);
    expect(await fs.readFile(getLibraryIndexBackupPath(root), 'utf-8')).toBe(preE1);
  });
});

describe('probe on upsert / scan + back-fill', () => {
  it('upsertEntry writes kind + probe; tags / audio pass through', async () => {
    await put('gen/riser.wav');
    const entry = await upsertEntry(root, 'gen/riser.wav', {
      origin: 'generated', tags: ['riser'], audio: { category: 'tension', loudnessLufs: -20 },
    });
    expect(entry).toMatchObject({ kind: 'audio', probe: { duration: 1.25 }, tags: ['riser'], audio: { category: 'tension' } });
    expect((await readRaw()).entries[0]).toMatchObject({ kind: 'audio', probe: { duration: 1.25 } });
  });

  it('a failed probe on upsert leaves no probe; the back-fill does not retry an unchanged failure', async () => {
    await put('bad.mp3');
    probeMock.fail.add('bad.mp3');
    const entry = await upsertEntry(root, 'bad.mp3', { origin: 'generated' });
    expect(entry.probe).toBeUndefined();
    await scheduleProbeBackfill(root);
    const calls = probeMock.calls.length;
    await scheduleProbeBackfill(root);
    expect(probeMock.calls.length).toBe(calls);
  });

  it(`a scan probes inline up to ${SCAN_PROBE_BUDGET} files; the back-fill probes the rest`, async () => {
    const count = SCAN_PROBE_BUDGET + 5;
    for (let i = 0; i < count; i += 1) await put(`drop/s${String(i).padStart(2, '0')}.mp3`);
    const entries = await scanLibrary(root);
    expect(entries.filter((e) => e.probe).length).toBe(SCAN_PROBE_BUDGET);
    await scheduleProbeBackfill(root);
    expect((await readRaw()).entries.every((e) => e.probe?.duration === 1.25)).toBe(true);
  });

  it('the back-fill skips an entry whose file changed since the index saw it', async () => {
    await put('a.mp3');
    await put('b.mp3');
    await oldStore.scanLibrary(root); // pre-E1: no probes
    await fs.appendFile(path.join(root, 'b.mp3'), '-edited'); // index still holds the old size
    const res = await scheduleProbeBackfill(root);
    expect(res).toMatchObject({ candidates: 2, probed: 2, written: 1 });
    const raw = await readRaw();
    expect(raw.entries.find((e) => e.relPath === 'a.mp3')?.probe).toBeDefined();
    expect(raw.entries.find((e) => e.relPath === 'b.mp3')?.probe).toBeUndefined();
  });

  it('the back-fill never recreates a library whose index is gone', async () => {
    await put('a.mp3');
    await oldStore.scanLibrary(root);
    await fs.rm(path.join(root, '.vidtsx'), { recursive: true, force: true });
    await scheduleProbeBackfill(root);
    expect(await exists(path.join(root, '.vidtsx'))).toBe(false);
  });
});
