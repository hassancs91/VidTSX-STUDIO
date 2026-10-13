import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { BUNDLE_UNUSED_MAX_MS, bundlesMadeInside, isPathInside, pruneBundleFolders, staleBundleFolders } from './bundle-cache-prune';

const DAY = 24 * 60 * 60 * 1000;

describe('staleBundleFolders', () => {
  const now = 100 * DAY;

  it('picks folders unused for more than 7 days', () => {
    const folders = [
      { name: 'v2-aaaaaaaa-1', mtimeMs: now - 8 * DAY },
      { name: 'v2-bbbbbbbb-2', mtimeMs: now - 6 * DAY },
      { name: 'bundle-old', mtimeMs: now - 30 * DAY },
    ];
    expect(staleBundleFolders(folders, { now })).toEqual(['v2-aaaaaaaa-1', 'bundle-old']);
  });

  it('keeps a folder a queued render still points at, however old', () => {
    const folders = [{ name: 'v2-aaaaaaaa-1', mtimeMs: now - 30 * DAY }];
    expect(staleBundleFolders(folders, { now, keep: new Set(['v2-aaaaaaaa-1']) })).toEqual([]);
  });

  it('defaults to 7 days', () => {
    expect(BUNDLE_UNUSED_MAX_MS).toBe(7 * DAY);
    expect(staleBundleFolders([{ name: 'x', mtimeMs: now - 7 * DAY }], { now })).toEqual([]);
  });
});

describe('pruneBundleFolders', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  it('deletes stale folders only, never files or kept ids', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bundle-prune-'));
    const old = new Date(Date.now() - 10 * DAY);
    for (const name of ['v2-aaaaaaaa-1', 'v2-bbbbbbbb-2', 'v2-cccccccc-3']) {
      await fs.mkdir(path.join(dir, name));
      await fs.writeFile(path.join(dir, name, 'index.html'), 'x');
    }
    await fs.writeFile(path.join(dir, 'stray.txt'), 'x');
    await fs.utimes(path.join(dir, 'v2-aaaaaaaa-1'), old, old);
    await fs.utimes(path.join(dir, 'v2-bbbbbbbb-2'), old, old);
    await fs.utimes(path.join(dir, 'stray.txt'), old, old);

    const removed = await pruneBundleFolders(dir, { keep: new Set(['v2-bbbbbbbb-2']) });

    expect(removed).toEqual(['v2-aaaaaaaa-1']);
    expect((await fs.readdir(dir)).sort()).toEqual(['stray.txt', 'v2-bbbbbbbb-2', 'v2-cccccccc-3']);
  });

  it('treats a missing folder as nothing to do', async () => {
    dir = '';
    expect(await pruneBundleFolders(path.join(os.tmpdir(), 'no-such-bundle-cache-dir'))).toEqual([]);
  });
});

describe('bundlesMadeInside', () => {
  it('names every bundle made from an entry in the run folder, older re-bundles of one entry included', () => {
    const run = path.resolve('/builds/run-1');
    const made = new Map([
      ['v2-aaaaaaaa-1', { entryFilePath: path.join(run, 'stills', 'composition.tsx'), bundlePath: '/cache/v2-aaaaaaaa-1' }],
      ['v2-bbbbbbbb-2', { entryFilePath: path.join(run, 'stills', 'composition.tsx'), bundlePath: '/cache/v2-bbbbbbbb-2' }],
      ['v2-cccccccc-3', { entryFilePath: path.join(run, 'looks', 'phone.tsx'), bundlePath: '/cache/v2-cccccccc-3' }],
      ['v2-dddddddd-4', { entryFilePath: path.resolve('/projects/p/v1.tsx'), bundlePath: '/cache/v2-dddddddd-4' }],
    ]);
    expect(bundlesMadeInside(made, run)).toEqual(['v2-aaaaaaaa-1', 'v2-bbbbbbbb-2', 'v2-cccccccc-3']);
  });
});

describe('isPathInside', () => {
  it('matches files under the folder, not siblings with the same prefix', () => {
    const root = path.resolve('/runs/abc');
    expect(isPathInside(path.join(root, 'stills', 'look', 'composition.tsx'), root)).toBe(true);
    expect(isPathInside(root, root)).toBe(true);
    expect(isPathInside(path.resolve('/runs/abcd/x.tsx'), root)).toBe(false);
    expect(isPathInside(path.resolve('/runs/x.tsx'), root)).toBe(false);
  });
});
