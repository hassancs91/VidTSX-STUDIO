import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { LibraryIndexEntry, LibraryIndexFile } from '../../../shared/types/asset-library';

/**
 * E1 fix round 2 (verifier V2-1): ffprobe "reads" some broken files — random bytes named
 * `.flac` give rc 0, a flac stream with `sample_rate=0` and `format.duration` N/A — and
 * `probeMedia` turns that into `{ duration: 0 }`. The LIBRARY probe treats an audio / video
 * probe without a finite duration > 0 as a FAILED probe: stamped failed, listed
 * "length unknown (unreadable)", never "0.00 s". The REAL `probeLibraryFile`, store,
 * back-fill and listing run here; only the app's ffprobe (`probeMedia`) is replaced.
 */

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

/** file name → what `probeMedia` returns for it (absent = ffprobe exits non-zero). */
const ffprobe = vi.hoisted(() => ({ results: new Map<string, unknown>(), calls: [] as string[] }));

vi.mock('../studio/media-import', async (importOriginal) => {
  const real = await importOriginal<typeof import('../studio/media-import')>();
  return {
    ...real,
    probeMedia: vi.fn(async (abs: string) => {
      const name = path.basename(abs);
      ffprobe.calls.push(name);
      if (!ffprobe.results.has(name)) throw new Error('ffprobe exited with code 1');
      return ffprobe.results.get(name);
    }),
  };
});

import { probeLibraryFile } from './library-probe';
import { scanLibrary, upsertEntry } from './library-store';
import { scheduleProbeBackfill } from './library-backfill';
import { getLibraryIndexPath } from './library-paths';
import { probeStateOf } from './library-probe-state';
import { formatLibraryRow } from '../studio/agent-tools/library-listing';
import * as oldStore from './pre-e1-control/library-store';

let root = '';
let n = 0;

const readRaw = async (): Promise<LibraryIndexFile> =>
  JSON.parse(await fs.readFile(getLibraryIndexPath(root), 'utf-8')) as LibraryIndexFile;
const entryOf = async (rel: string): Promise<LibraryIndexEntry> => {
  const e = (await readRaw()).entries.find((x) => x.relPath === rel);
  if (!e) throw new Error(`no entry ${rel}`);
  return e;
};
const row = (e: LibraryIndexEntry): string => formatLibraryRow(e, 'audio', 'library:');

/** A garbage media file: random bytes under a media name. */
async function putGarbage(rel: string): Promise<{ size: number; mtimeMs: number }> {
  await fs.writeFile(path.join(root, rel), crypto.randomBytes(4096));
  const st = await fs.stat(path.join(root, rel));
  return { size: st.size, mtimeMs: st.mtimeMs };
}

/** What the fix-round-1 code wrote for such a file: a 0 s probe, stamped as good. */
async function plantZeroProbe(rel: string, stamped: boolean): Promise<void> {
  const index = await readRaw();
  const e = index.entries.find((x) => x.relPath === rel);
  if (!e || e.size === undefined || e.mtimeMs === undefined) throw new Error(`no entry ${rel}`);
  e.kind = 'audio';
  e.probe = { duration: 0, hasAudio: true, codec: 'flac' };
  if (stamped) e.probeStamp = { size: e.size, mtimeMs: e.mtimeMs };
  await fs.writeFile(getLibraryIndexPath(root), JSON.stringify(index, null, 2));
}

beforeEach(async () => {
  if (!tmpDir) tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-library-duration-'));
  n += 1;
  root = path.join(tmpDir, `assets-${n}`);
  await fs.mkdir(root, { recursive: true });
  ffprobe.results.clear();
  ffprobe.calls.length = 0;
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('probeLibraryFile: a probe without a finite duration > 0 is a failed probe (V2-1)', () => {
  it.each([
    ['0', 0],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
    ['missing', undefined],
  ])('audio with duration %s → undefined', async (_label, duration) => {
    ffprobe.results.set('garbage.flac', { duration, hasAudio: true, codec: 'flac' });
    expect(await probeLibraryFile(path.join(root, 'garbage.flac'), 'audio')).toBeUndefined();
  });

  it('a video with duration 0 is failed too; a real duration passes through', async () => {
    ffprobe.results.set('broken.mp4', { duration: 0, hasAudio: false, codec: 'h264', width: 64, height: 64 });
    expect(await probeLibraryFile(path.join(root, 'broken.mp4'), 'video')).toBeUndefined();
    ffprobe.results.set('fine.flac', { duration: 2.5, hasAudio: true, codec: 'flac' });
    expect((await probeLibraryFile(path.join(root, 'fine.flac'), 'audio'))?.duration).toBe(2.5);
  });
});

describe('the library never lists a duration-less probe as 0.00 s (V2-1)', () => {
  it('upsert: stamped failed, listed unreadable', async () => {
    const st = await putGarbage('garbage.flac');
    ffprobe.results.set('garbage.flac', { duration: 0, hasAudio: true, codec: 'flac' });
    await upsertEntry(root, 'garbage.flac', { origin: 'imported' });
    const entry = await entryOf('garbage.flac');
    expect(entry.probe).toBeUndefined();
    expect(entry.probeStamp).toEqual({ ...st, failed: true });
    expect(row(entry)).toContain('length unknown (unreadable)');
    expect(row(entry)).not.toContain('0.00 s');
  });

  it('back-fill: a pre-E1 entry whose ffprobe has no duration is stamped failed, not retried unchanged', async () => {
    await putGarbage('garbage.wav');
    await oldStore.scanLibrary(root); // pre-E1 entry: no kind, no probe
    ffprobe.results.set('garbage.wav', { duration: 0, hasAudio: true, codec: 'pcm_s16le' });
    await scheduleProbeBackfill(root);
    const entry = await entryOf('garbage.wav');
    expect(entry.probe).toBeUndefined();
    expect(entry.probeStamp?.failed).toBe(true);
    expect(row(entry)).toContain('(unreadable)');
    const calls = ffprobe.calls.length;
    await scheduleProbeBackfill(root);
    expect(ffprobe.calls.length).toBe(calls);
  });

  it('scan: a new garbage file is never written with a 0 s probe', async () => {
    await putGarbage('garbage.aac');
    ffprobe.results.set('garbage.aac', { duration: 0, hasAudio: true, codec: 'aac' });
    await scanLibrary(root);
    await scheduleProbeBackfill(root);
    const entry = await entryOf('garbage.aac');
    expect(entry.probe).toBeUndefined();
    expect(row(entry)).toContain('(unreadable)');
  });

  it.each([
    ['stamped', true],
    ['unstamped', false],
  ])('a 0 s probe already in the index (%s, fix-round-1 code) is not ok: probing, then unreadable', async (_l, stamped) => {
    await putGarbage('old.flac');
    await oldStore.scanLibrary(root);
    await plantZeroProbe('old.flac', stamped);
    const planted = await entryOf('old.flac');
    expect(probeStateOf(planted)).toBe('stale');
    expect(row(planted)).toContain('length unknown (probing)');
    expect(row(planted)).not.toContain('0.00 s');

    ffprobe.results.set('old.flac', { duration: 0, hasAudio: true, codec: 'flac' });
    await scheduleProbeBackfill(root);
    const after = await entryOf('old.flac');
    expect(after.probe).toBeUndefined();
    expect(after.probeStamp?.failed).toBe(true);
    expect(row(after)).toContain('(unreadable)');
  });

  it('upsert of an unchanged file does not keep an old 0 s probe when the re-probe fails', async () => {
    await putGarbage('kept.flac');
    await oldStore.scanLibrary(root);
    await plantZeroProbe('kept.flac', true);
    await upsertEntry(root, 'kept.flac', { origin: 'imported' }); // ffprobe exits non-zero
    const entry = await entryOf('kept.flac');
    expect(entry.probe).toBeUndefined();
    expect(entry.probeStamp?.failed).toBe(true);
    expect(row(entry)).toContain('(unreadable)');
  });
});
