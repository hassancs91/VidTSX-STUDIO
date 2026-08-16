import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// Same bare app stub as library-store.test.ts — the apply path takes its
// root explicitly and never reads settings.
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import { applyMoves } from './organize-apply';
import { scanLibrary, setDescription } from './library-store';
import { collectInUse } from './organize-plan';
import type { LibraryOrganizeMove } from '../../../shared/ipc/types/library';

let root = '';

const move = (relPath: string, toRelPath: string): LibraryOrganizeMove => ({
  relPath,
  toRelPath,
  fromFolder: relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '',
  toFolder: toRelPath.includes('/') ? toRelPath.slice(0, toRelPath.lastIndexOf('/')) : '',
  reason: 'test',
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-organize-test-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(path.join(root, 'logos'), { recursive: true });
  await fs.writeFile(path.join(root, 'logos', 'dashboard.png'), 'dashboard-bytes');
  await fs.writeFile(path.join(root, 'logos', 'acme.png'), 'acme-logo-bytes');
  await fs.writeFile(path.join(root, 'loose.png'), 'loose-bytes');
  await scanLibrary(root);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const entryFor = (entries: Awaited<ReturnType<typeof scanLibrary>>, relPath: string) =>
  entries.find((e) => e.relPath === relPath);

describe('applyMoves — real disk moves + index re-key', () => {
  it('moves the file, creates the destination folder, and re-keys the index', async () => {
    await setDescription(root, 'logos/dashboard.png', 'a UI screenshot, not a logo');
    const before = await scanLibrary(root);
    const hashBefore = entryFor(before, 'logos/dashboard.png')?.hash;
    expect(hashBefore).toBeTruthy();

    const result = await applyMoves(root, [
      move('logos/dashboard.png', 'screenshots/dashboard.png'),
    ]);

    expect(result.moved).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.refused).toEqual([]);

    // Disk: the file is at the new path and gone from the old one.
    await expect(fs.readFile(path.join(root, 'screenshots', 'dashboard.png'), 'utf-8')).resolves.toBe(
      'dashboard-bytes',
    );
    await expect(fs.access(path.join(root, 'logos', 'dashboard.png'))).rejects.toThrow();

    // Index: re-keyed to the new path, same hash, description carried across
    // — and no tombstone, because the file was matched as a MOVE.
    const moved = entryFor(result.entries, 'screenshots/dashboard.png');
    expect(moved).toBeDefined();
    expect(moved?.hash).toBe(hashBefore);
    expect(moved?.description).toBe('a UI screenshot, not a logo');
    expect(entryFor(result.entries, 'logos/dashboard.png')).toBeUndefined();

    const index = JSON.parse(
      await fs.readFile(path.join(root, '.vidtsx', 'index.json'), 'utf-8'),
    ) as { tombstones: unknown[] };
    expect(index.tombstones).toEqual([]);
  });

  it('moves a nested file to the root and a root file into a folder', async () => {
    const result = await applyMoves(root, [
      move('logos/acme.png', 'acme.png'),
      move('loose.png', 'misc/loose.png'),
    ]);
    expect(result.moved).toBe(2);
    expect(result.entries.map((e) => e.relPath).sort()).toEqual([
      'acme.png',
      'logos/dashboard.png',
      'misc/loose.png',
    ]);
  });

  // L7 Rev 2: re-checked at apply time, because the user can open a project
  // between reviewing a plan and accepting it.
  it('refuses a move whose asset became in-use, and still applies the rest', async () => {
    const inUse = collectInUse(root, [
      { path: path.join(root, 'logos', 'acme.png'), hash: 'whatever' },
    ]);
    const result = await applyMoves(
      root,
      [move('logos/acme.png', 'brand/acme.png'), move('loose.png', 'misc/loose.png')],
      inUse,
    );

    expect(result.refused).toEqual(['logos/acme.png']);
    expect(result.moved).toBe(1);
    // The refused asset never left its folder.
    await expect(fs.access(path.join(root, 'logos', 'acme.png'))).resolves.toBeUndefined();
    expect(entryFor(result.entries, 'misc/loose.png')).toBeDefined();
  });

  it('isolates a per-move failure — a vanished source does not stop the batch', async () => {
    await fs.rm(path.join(root, 'logos', 'dashboard.png'));
    const result = await applyMoves(root, [
      move('logos/dashboard.png', 'screenshots/dashboard.png'),
      move('loose.png', 'misc/loose.png'),
    ]);

    expect(result.moved).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].relPath).toBe('logos/dashboard.png');
    expect(entryFor(result.entries, 'misc/loose.png')).toBeDefined();
  });

  it('never overwrites an occupied destination', async () => {
    await fs.mkdir(path.join(root, 'screenshots'), { recursive: true });
    await fs.writeFile(path.join(root, 'screenshots', 'dashboard.png'), 'existing-bytes');
    const result = await applyMoves(root, [
      move('logos/dashboard.png', 'screenshots/dashboard.png'),
    ]);

    expect(result.moved).toBe(0);
    expect(result.failures[0].error).toBe('Destination already exists');
    await expect(fs.readFile(path.join(root, 'screenshots', 'dashboard.png'), 'utf-8')).resolves.toBe(
      'existing-bytes',
    );
    await expect(fs.readFile(path.join(root, 'logos', 'dashboard.png'), 'utf-8')).resolves.toBe(
      'dashboard-bytes',
    );
  });

  it('refuses a destination that escapes the assets root', async () => {
    const result = await applyMoves(root, [move('loose.png', '../escaped.png')]);
    expect(result.moved).toBe(0);
    expect(result.failures[0].error).toMatch(/escapes the assets root/);
  });

  it('rescans even with nothing to move, so the caller always gets fresh entries', async () => {
    const result = await applyMoves(root, []);
    expect(result.moved).toBe(0);
    expect(result.entries).toHaveLength(3);
  });
});
