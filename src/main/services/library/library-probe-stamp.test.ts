import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LibraryIndexEntry, LibraryIndexFile } from '../../../shared/types/asset-library';

/**
 * E1 fix round 1 — the probe stamp (verifier V1-4 / V1-5): a probe (or a failed probe)
 * is stamped with the size + mtime it was measured on. A failed probe is not retried
 * (across processes) until the file changes and lists as "unreadable", not "probing";
 * a probe an OLDER app kept across an in-place rewrite is noticed as stale and re-probed.
 */

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

const probeMock = vi.hoisted(() => ({
  fail: new Set<string>(),
  durations: new Map<string, number>(),
  calls: [] as string[],
}));

vi.mock('./library-probe', () => ({
  probeLibraryFile: vi.fn(async (abs: string, kind: string) => {
    const name = path.basename(abs);
    probeMock.calls.push(name);
    if (probeMock.fail.has(name)) return undefined;
    if (kind !== 'audio' && kind !== 'video') return undefined;
    return { duration: probeMock.durations.get(name) ?? 1.25, hasAudio: true };
  }),
}));

import * as oldStore from './pre-e1-control/library-store';
import { scanLibrary, upsertEntry } from './library-store';
import { getLibraryIndexPath } from './library-paths';
import { formatLibraryRow } from '../studio/agent-tools/library-listing';

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

async function put(rel: string, bytes = `bytes-of-${rel}`): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), bytes);
}

/** A fresh back-fill module = a new app process (no in-memory state carried over). */
async function backfillInNewProcess(): Promise<void> {
  vi.resetModules();
  const fresh = await import('./library-backfill');
  await fresh.scheduleProbeBackfill(root);
}

beforeEach(async () => {
  if (!tmpDir) tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-library-stamp-'));
  n += 1;
  root = path.join(tmpDir, `assets-${n}`);
  await fs.mkdir(root, { recursive: true });
  probeMock.fail.clear();
  probeMock.durations.clear();
  probeMock.calls.length = 0;
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('failed probes (V1-4)', () => {
  it('lists an unprobeable file as unreadable, not probing, and never retries it unchanged', async () => {
    await put('broken.mp3', 'not an mp3');
    probeMock.fail.add('broken.mp3');
    await upsertEntry(root, 'broken.mp3', { origin: 'imported' });
    const stat = await fs.stat(path.join(root, 'broken.mp3'));
    const entry = await entryOf('broken.mp3');
    expect(entry.probe).toBeUndefined();
    expect(entry.probeStamp).toEqual({ size: stat.size, mtimeMs: stat.mtimeMs, failed: true });
    expect(row(entry)).toContain('length unknown (unreadable)');
    expect(row(entry)).not.toContain('probing');

    const calls = probeMock.calls.length;
    await backfillInNewProcess();
    await backfillInNewProcess();
    expect(probeMock.calls.length).toBe(calls);
  });

  it('a back-fill failure is stamped too; the file is retried once it changes', async () => {
    await put('late.wav');
    await oldStore.scanLibrary(root); // pre-E1 entry: no probe
    probeMock.fail.add('late.wav');
    await backfillInNewProcess();
    expect(row(await entryOf('late.wav'))).toContain('(unreadable)');

    probeMock.fail.delete('late.wav');
    probeMock.durations.set('late.wav', 2.5);
    await put('late.wav', 'a fixed, longer file');
    await scanLibrary(root); // touched → probed inline
    const fixed = await entryOf('late.wav');
    expect(fixed.probe?.duration).toBe(2.5);
    expect(fixed.probeStamp?.failed).toBeUndefined();
    expect(row(fixed)).toContain('2.50 s');
  });
});

describe('a probe kept by an older app across a rewrite (V1-5)', () => {
  it('is listed as probing, not the stale duration, and the back-fill re-probes it', async () => {
    await put('hires.flac', 'two and a half seconds');
    probeMock.durations.set('hires.flac', 2.5);
    await upsertEntry(root, 'hires.flac', { origin: 'imported' });
    expect((await entryOf('hires.flac')).probe?.duration).toBe(2.5);

    // The pre-E1 app rewrites it in place: size/mtime refreshed, E1's probe kept.
    await put('hires.flac', 'four whole seconds of audio now');
    await oldStore.upsertEntry(root, 'hires.flac', { origin: 'imported' });
    const stale = await entryOf('hires.flac');
    expect(stale.probe?.duration).toBe(2.5);
    expect(row(stale)).toContain('length unknown (probing)');
    expect(row(stale)).not.toContain('2.50 s');

    probeMock.durations.set('hires.flac', 4);
    await scanLibrary(root); // Refresh: untouched per size/mtime, but the stale probe is noticed
    await backfillInNewProcess();
    const fresh = await entryOf('hires.flac');
    expect(fresh.probe?.duration).toBe(4);
    expect(row(fresh)).toContain('4.00 s');
  });

  it('a move keeps a fresh probe fresh; an unstamped probe (pre-fix E1) is trusted', async () => {
    await put('a.mp3');
    await scanLibrary(root);
    await fs.rename(path.join(root, 'a.mp3'), path.join(root, 'b.mp3'));
    await scanLibrary(root);
    const moved = await entryOf('b.mp3');
    expect(row(moved)).toContain('1.25 s');

    const unstamped: LibraryIndexEntry = { ...moved, probeStamp: undefined };
    expect(row(unstamped)).toContain('1.25 s');
  });
});
