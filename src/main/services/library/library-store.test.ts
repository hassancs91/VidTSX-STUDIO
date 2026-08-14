import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// media-import → studio-paths → settings → settings-db → electron; the store
// itself never touches settings (root is explicit), so a bare app stub is
// enough (tsx-job-engine.test.ts pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import {
  findLibraryFileByHash,
  loadIndex,
  scanLibrary,
  setDescription,
  upsertEntry,
} from './library-store';
import { getLibrarySizes, invalidateLibrarySizes } from './library-sizes';

let root = '';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-library-test-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(path.join(root, 'logos'), { recursive: true });
  await fs.writeFile(path.join(root, 'logos', 'logo.png'), 'logo-bytes');
  await fs.writeFile(path.join(root, 'intro.mp4'), 'video-bytes-longer');
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('library-store scan + describe + move + heal', () => {
  it('scan indexes files with hashes and persists .vidtsx/index.json', async () => {
    const entries = await scanLibrary(root);
    expect(entries.map((e) => e.relPath).sort()).toEqual(['intro.mp4', 'logos/logo.png']);
    expect(entries.every((e) => e.hash)).toBe(true);
    const onDisk = await loadIndex(root);
    expect(onDisk.entries).toHaveLength(2);
  });

  it('setDescription persists and survives a re-scan', async () => {
    await setDescription(root, 'logos/logo.png', 'primary logo, white on transparent');
    const entries = await scanLibrary(root);
    expect(entries.find((e) => e.relPath === 'logos/logo.png')?.description).toBe(
      'primary logo, white on transparent'
    );
  });

  it('an Explorer-style move re-keys by hash and keeps the description', async () => {
    await fs.mkdir(path.join(root, 'brand'), { recursive: true });
    await fs.rename(path.join(root, 'logos', 'logo.png'), path.join(root, 'brand', 'logo.png'));
    const entries = await scanLibrary(root);
    const moved = entries.find((e) => e.relPath === 'brand/logo.png');
    expect(moved?.description).toBe('primary logo, white on transparent');
    expect(entries.find((e) => e.relPath === 'logos/logo.png')).toBeUndefined();
  });

  it('findLibraryFileByHash locates a file even when the index is stale', async () => {
    const entries = await loadIndex(root);
    const hash = entries.entries.find((e) => e.relPath === 'brand/logo.png')?.hash;
    expect(hash).toBeTruthy();
    // Move again WITHOUT rescanning — the finder must fall back to a scan.
    await fs.rename(path.join(root, 'brand', 'logo.png'), path.join(root, 'logo.png'));
    const found = await findLibraryFileByHash(root, hash as string);
    expect(found).toBe(path.join(root, 'logo.png'));
  });

  it('rejects description writes outside the root', async () => {
    await expect(setDescription(root, '../escape.txt', 'nope')).rejects.toThrow();
  });
});

describe('library-sizes', () => {
  it('computes per-folder recursive sizes, skipping the .vidtsx overlay', async () => {
    invalidateLibrarySizes(root);
    const sizes = await getLibrarySizes(root);
    const introBytes = 'video-bytes-longer'.length;
    const logoBytes = 'logo-bytes'.length;
    expect(sizes.total).toBe(introBytes + logoBytes);
    expect(sizes.folders['']).toBe(sizes.total);
    expect(sizes.folders['brand']).toBe(0); // logo moved out in the tests above
  });
});

describe('upsertEntry — born-managed content (D12)', () => {
  it('registers a new file with origin, description, brand tag, and hash bookkeeping', async () => {
    await fs.mkdir(path.join(root, 'generated'), { recursive: true });
    await fs.writeFile(path.join(root, 'generated', 'card.png'), 'generated-bytes');
    const entry = await upsertEntry(root, 'generated/card.png', {
      origin: 'generated',
      description: 'dark navy stat card',
      brandId: 'acme-test',
    });
    expect(entry).toMatchObject({
      relPath: 'generated/card.png',
      origin: 'generated',
      description: 'dark navy stat card',
      brandId: 'acme-test',
    });
    expect(entry.hash).toBeTruthy();
    expect(entry.size).toBe('generated-bytes'.length);
  });

  it('survives a reconcile scan without being downgraded to imported', async () => {
    const entries = await scanLibrary(root);
    const kept = entries.find((e) => e.relPath === 'generated/card.png');
    expect(kept?.origin).toBe('generated');
    expect(kept?.description).toBe('dark navy stat card');
    expect(kept?.brandId).toBe('acme-test');
  });

  it('updates in place on re-upsert and refuses paths outside the root', async () => {
    const entry = await upsertEntry(root, 'generated/card.png', {
      origin: 'generated',
      description: 'updated caption',
    });
    expect(entry.description).toBe('updated caption');
    expect(entry.brandId).toBe('acme-test'); // untouched fields survive
    const index = await loadIndex(root);
    expect(index.entries.filter((e) => e.relPath === 'generated/card.png')).toHaveLength(1);
    await expect(
      upsertEntry(root, '../outside.png', { origin: 'generated' })
    ).rejects.toThrow();
  });

  it('throws when the file is not on disk', async () => {
    await expect(
      upsertEntry(root, 'generated/ghost.png', { origin: 'generated' })
    ).rejects.toThrow();
  });
});
