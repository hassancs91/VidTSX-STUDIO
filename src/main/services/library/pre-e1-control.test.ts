import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LibraryIndexEntry, LibraryIndexFile } from '../../../shared/types/asset-library';

/**
 * E-d5 control (END_TO_END_PLAN E1): an index written by the E1 code must be
 * read WITHOUT LOSS by the pre-E1 reader (Hasan's installed 1.1.x app and the
 * main branch read the same `assets/.vidtsx/index.json`). The pre-E1 store is
 * a frozen `git show 5d77600:…` copy under `pre-e1-control/`. This file pins
 * which E1 fields survive each OLD write, and that the new reader + the
 * migration recover what an old write dropped.
 */

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

// No real ffprobe here: every audio/video file "lasts" 2.5 s.
vi.mock('./library-probe', () => ({
  probeLibraryFile: vi.fn(async (_abs: string, kind: string) =>
    kind === 'audio' || kind === 'video' ? { duration: 2.5, hasAudio: true, codec: 'pcm_s16le' } : undefined,
  ),
}));

import * as newStore from './library-store';
import * as oldStore from './pre-e1-control/library-store';
import { getLibraryIndexBackupPath, updateIndex } from './library-index-io';
import { migrateLibraryIndex } from './library-migrate';
import { scheduleProbeBackfill } from './library-backfill';
import { getLibraryIndexPath } from './library-paths';

let root = '';

async function readRaw(): Promise<LibraryIndexFile> {
  return JSON.parse(await fs.readFile(getLibraryIndexPath(root), 'utf-8')) as LibraryIndexFile;
}

const byPath = (index: LibraryIndexFile): Map<string, LibraryIndexEntry> =>
  new Map(index.entries.map((e) => [e.relPath, e]));

const PRE_E1_FIELDS = ['hash', 'description', 'brandId', 'origin', 'addedAt'] as const;
const V2_FIELDS = ['kind', 'tags', 'audio', 'usedIn'] as const;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-pre-e1-control-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(path.join(root, 'sfx'), { recursive: true });
  await fs.mkdir(path.join(root, 'img'), { recursive: true });
  await fs.writeFile(path.join(root, 'sfx', 'a.mp3'), 'aaa-audio-bytes');
  await fs.writeFile(path.join(root, 'sfx', 'b.wav'), 'bbb-audio-bytes');
  await fs.writeFile(path.join(root, 'sfx', 'd.ogg'), 'ddd-audio-bytes');
  await fs.writeFile(path.join(root, 'img', 'c.png'), 'ccc-image-bytes');
  await fs.writeFile(path.join(root, 'clip.mp4'), 'video-bytes-here');
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('E-d5: an E1-written index under the pre-E1 code', () => {
  let e1: LibraryIndexFile;

  it('the E1 code writes version 1 + rev 2 with kinds, probes and the v2 fields', async () => {
    await newStore.scanLibrary(root);
    await newStore.setDescription(root, 'sfx/a.mp3', 'a whoosh');
    await newStore.upsertEntry(root, 'img/c.png', {
      origin: 'generated', description: 'a logo', brandId: 'acme', tags: ['logo'],
    });
    await newStore.upsertEntry(root, 'sfx/b.wav', {
      origin: 'generated', description: 'a riser', tags: ['riser'],
      audio: { category: 'tension', loudnessLufs: -20, peakDbfs: -1.5, source: 'synth' },
    });
    await updateIndex(root, (index) => {
      for (const e of index.entries) e.usedIn = ['proj-1'];
    });
    e1 = await readRaw();
    expect(e1.version).toBe(1);
    expect(e1.rev).toBe(2);
    const m = byPath(e1);
    expect([...m.values()].map((e) => [e.relPath, e.kind])).toEqual([
      ['clip.mp4', 'video'], ['img/c.png', 'image'], ['sfx/a.mp3', 'audio'], ['sfx/b.wav', 'audio'], ['sfx/d.ogg', 'audio'],
    ]);
    for (const p of ['clip.mp4', 'sfx/a.mp3', 'sfx/b.wav', 'sfx/d.ogg']) expect(m.get(p)?.probe?.duration).toBe(2.5);
    expect(m.get('img/c.png')?.probe).toBeUndefined();
    expect(m.get('sfx/b.wav')?.audio?.category).toBe('tension');
    // No index existed before → nothing to back up.
    await expect(fs.access(getLibraryIndexBackupPath(root))).rejects.toThrow();
  });

  it('the pre-E1 loadIndex reads it whole (not the empty index)', async () => {
    const old = await oldStore.loadIndex(root);
    expect(old.entries).toEqual(e1.entries);
    expect(old.tombstones).toEqual(e1.tombstones);
  });

  it('pre-E1 setDescription / upsertEntry keep every field, old and new, and rev', async () => {
    await oldStore.setDescription(root, 'sfx/a.mp3', 'a whoosh, short');
    await oldStore.upsertEntry(root, 'img/c.png', { origin: 'generated', description: 'a logo v2', brandId: 'acme' });
    const raw = await readRaw();
    expect(raw.rev).toBe(2);
    const before = byPath(e1);
    const after = byPath(raw);
    expect(after.get('sfx/a.mp3')).toEqual({ ...before.get('sfx/a.mp3'), description: 'a whoosh, short' });
    expect(after.get('img/c.png')).toMatchObject({
      ...before.get('img/c.png'), description: 'a logo v2', tags: ['logo'], usedIn: ['proj-1'], kind: 'image',
    });
    e1 = raw;
  });

  it('pre-E1 scan (touched + moved + deleted + new): every pre-E1 field survives; pins the new ones', async () => {
    await fs.appendFile(path.join(root, 'sfx', 'b.wav'), '-edited'); // touched
    await fs.mkdir(path.join(root, 'img', 'logos'));
    await fs.rename(path.join(root, 'img', 'c.png'), path.join(root, 'img', 'logos', 'c.png')); // moved
    await fs.rm(path.join(root, 'sfx', 'd.ogg')); // deleted
    await fs.writeFile(path.join(root, 'notes.txt'), 'new-file'); // new
    await oldStore.scanLibrary(root);
    const raw = await readRaw();
    const before = byPath(e1);
    const after = byPath(raw);

    expect(raw.version).toBe(1);
    expect(raw.rev).toBeUndefined(); // an old scan drops rev → the next E1 start re-migrates

    // Untouched: everything kept.
    expect(after.get('sfx/a.mp3')).toEqual(before.get('sfx/a.mp3'));
    expect(after.get('clip.mp4')).toEqual(before.get('clip.mp4'));

    // Touched: pre-E1 fields kept (hash refreshed for the new bytes), v2 fields kept, probe cleared.
    const b0 = before.get('sfx/b.wav') as LibraryIndexEntry;
    const b1 = after.get('sfx/b.wav') as LibraryIndexEntry;
    for (const f of PRE_E1_FIELDS.filter((x) => x !== 'hash')) expect(b1[f]).toEqual(b0[f]);
    expect(b1.hash).toBeDefined();
    for (const f of V2_FIELDS) expect(b1[f]).toEqual(b0[f]);
    expect(b1.probe).toBeUndefined();

    // Moved: re-keyed by hash, everything kept.
    const c0 = before.get('img/c.png') as LibraryIndexEntry;
    expect(after.get('img/logos/c.png')).toEqual({
      ...c0, relPath: 'img/logos/c.png', size: c0.size, mtimeMs: after.get('img/logos/c.png')?.mtimeMs,
    });

    // Deleted: the tombstone keeps the pre-E1 fields only.
    const d0 = before.get('sfx/d.ogg') as LibraryIndexEntry;
    const tomb = raw.tombstones.find((t) => t.relPath === 'sfx/d.ogg');
    for (const f of PRE_E1_FIELDS) expect(tomb?.[f]).toEqual(d0[f]);
    for (const f of [...V2_FIELDS, 'probe'] as const) expect(tomb?.[f]).toBeUndefined();

    // New: a pre-E1 entry (no kind).
    expect(after.get('notes.txt')).toMatchObject({ origin: 'imported' });
    expect(after.get('notes.txt')?.kind).toBeUndefined();
  });

  it('the E1 reader and the migration recover: kinds back, probe refilled, one backup', async () => {
    const oldWritten = await fs.readFile(getLibraryIndexPath(root), 'utf-8');
    const loaded = await newStore.loadIndex(root);
    expect(loaded.entries.every((e) => e.kind !== undefined)).toBe(true);
    expect(byPath(loaded).get('notes.txt')?.kind).toBe('data');

    const first = await migrateLibraryIndex(root);
    expect(first.migrated).toBe(true);
    expect(await fs.readFile(getLibraryIndexBackupPath(root), 'utf-8')).toBe(oldWritten);
    await scheduleProbeBackfill(root);

    const raw = await readRaw();
    expect(raw.rev).toBe(2);
    expect(raw.entries.every((e) => e.kind !== undefined)).toBe(true);
    expect(raw.tombstones.every((t) => t.kind !== undefined)).toBe(true);
    expect(byPath(raw).get('sfx/b.wav')?.probe?.duration).toBe(2.5);

    const migratedBytes = await fs.readFile(getLibraryIndexPath(root), 'utf-8');
    const second = await migrateLibraryIndex(root);
    expect(second.migrated).toBe(false);
    expect(await fs.readFile(getLibraryIndexPath(root), 'utf-8')).toBe(migratedBytes);
    expect(await fs.readFile(getLibraryIndexBackupPath(root), 'utf-8')).toBe(oldWritten);
  });

  // Fix round 2, W1: only tombstones the OLD scan creates lose the new fields.
  it('a tombstone the E1 code made keeps every field under every old write', async () => {
    await fs.rm(path.join(root, 'sfx', 'a.mp3'));
    await newStore.scanLibrary(root); // an E1 tombstone
    const tomb0 = (await readRaw()).tombstones.find((t) => t.relPath === 'sfx/a.mp3');
    expect(tomb0).toMatchObject({ kind: 'audio', usedIn: ['proj-1'], description: 'a whoosh, short' });
    expect(tomb0?.probe?.duration).toBe(2.5);

    await oldStore.setDescription(root, 'clip.mp4', 'a clip');
    await oldStore.upsertEntry(root, 'img/logos/c.png', { origin: 'generated' });
    await fs.writeFile(path.join(root, 'late.txt'), 'another-new-file');
    await oldStore.scanLibrary(root);
    expect((await readRaw()).tombstones.find((t) => t.relPath === 'sfx/a.mp3')).toEqual(tomb0);
  });
});
