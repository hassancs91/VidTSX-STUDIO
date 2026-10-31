import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { StudioMediaAsset, StudioProject } from '../../../shared/types/studio';

let libRoot = '';

const mocks = vi.hoisted(() => ({
  markLibraryUsedIn: vi.fn(async (): Promise<void> => undefined),
  importMediaFiles: vi.fn(),
  hashFileHead: vi.fn(async () => 'h-fresh'),
  loadIndex: vi.fn(),
}));

// Module chain reaches settings-db/electron (library-paths, media-import) —
// the pure functions under test never touch it (library-store.test.ts pattern);
// resolveShotAssetRefs runs against a temp library root with everything behind
// IO mocked (the import, the hash, the index, the usedIn mark).
vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false },
}));
vi.mock('../library/library-paths', () => ({
  getLibraryRoot: () => libRoot,
  resolveLibraryPath: (root: string, rel: string) => path.resolve(root, rel),
  toLibraryRelPath: (root: string, abs: string) => path.relative(root, abs).split(path.sep).join('/'),
}));
vi.mock('../library/library-used-in', () => ({ markLibraryUsedIn: mocks.markLibraryUsedIn }));
vi.mock('../library/library-store', () => ({ loadIndex: mocks.loadIndex }));
vi.mock('./media-import', () => ({
  hashFileHead: mocks.hashFileHead,
  importMediaFiles: mocks.importMediaFiles,
}));

import {
  buildPromptAssets,
  isValidRefKey,
  matchExistingAsset,
  parseLibraryRef,
  resolveShotAssetRefs,
} from './shot-asset-refs';

function asset(overrides: Partial<StudioMediaAsset> = {}): StudioMediaAsset {
  return {
    id: 'a1',
    kind: 'image',
    path: 'C:/lib/logos/logo.png',
    probe: { duration: 0, width: 1024, height: 1024, hasAudio: false },
    hash: 'hash-1',
    ...overrides,
  };
}

describe('parseLibraryRef', () => {
  it('extracts the relPath from a library: ref, normalizing separators', () => {
    expect(parseLibraryRef('library:generated/logo.png')).toBe('generated/logo.png');
    expect(parseLibraryRef('library:captures\\a.com\\page.png')).toBe('captures/a.com/page.png');
  });

  it('returns null for plain ids and empty refs', () => {
    expect(parseLibraryRef('a1')).toBeNull();
    expect(parseLibraryRef('library:')).toBeNull();
    expect(parseLibraryRef('library:  ')).toBeNull();
  });
});

describe('isValidRefKey', () => {
  it('accepts identifier-shaped keys and rejects the rest', () => {
    expect(isValidRefKey('logo')).toBe(true);
    expect(isValidRefKey('screenshot1')).toBe(true);
    expect(isValidRefKey('_x')).toBe(true);
    expect(isValidRefKey('1bad')).toBe(false);
    expect(isValidRefKey('with-dash')).toBe(false);
    expect(isValidRefKey('with space')).toBe(false);
    expect(isValidRefKey('')).toBe(false);
  });
});

describe('matchExistingAsset (import-on-use idempotency)', () => {
  const winPath = 'C:/lib/logos/logo.png';

  it('matches by normalized path', () => {
    const existing = asset();
    const probed = path.win32.join('C:/lib', 'logos', 'logo.png'); // backslashes
    expect(matchExistingAsset([existing], probed, undefined)).toBe(existing);
  });

  it('matches by content hash when the path differs (moved file)', () => {
    const existing = asset({ path: 'C:/elsewhere/old-name.png', hash: 'same' });
    expect(matchExistingAsset([existing], winPath, 'same')).toBe(existing);
  });

  it('returns undefined when neither path nor hash match — a fresh import', () => {
    const existing = asset({ path: 'C:/other.png', hash: 'other' });
    expect(matchExistingAsset([existing], winPath, 'new-hash')).toBeUndefined();
    expect(matchExistingAsset([], winPath, undefined)).toBeUndefined();
  });

  it('never matches on both hashes being undefined', () => {
    const existing = asset({ path: 'C:/other.png' });
    delete existing.hash;
    expect(matchExistingAsset([existing], winPath, undefined)).toBeUndefined();
  });
});

describe('buildPromptAssets', () => {
  it('builds the model-facing table with dims, video duration, and description', () => {
    const byId = new Map<string, StudioMediaAsset>([
      ['a1', asset({ description: 'white logo' })],
      [
        'a2',
        asset({
          id: 'a2',
          kind: 'video',
          path: 'C:/demo.mp4',
          probe: { duration: 8, width: 1920, height: 1080, hasAudio: true },
        }),
      ],
    ]);
    expect(buildPromptAssets({ logo: 'a1', demo: 'a2' }, byId)).toEqual([
      { key: 'logo', kind: 'image', width: 1024, height: 1024, description: 'white logo' },
      { key: 'demo', kind: 'video', width: 1920, height: 1080, durationSeconds: 8 },
    ]);
  });

  it('rejects audio refs — shots are visual-only (D2)', () => {
    const byId = new Map<string, StudioMediaAsset>([
      ['a3', asset({ id: 'a3', kind: 'audio', probe: { duration: 3, hasAudio: true } })],
    ]);
    expect(() => buildPromptAssets({ vo: 'a3' }, byId)).toThrow(/visual-only/i);
  });

  it('rejects unknown ids', () => {
    expect(() => buildPromptAssets({ x: 'nope' }, new Map())).toThrow(/unknown asset/i);
  });
});

describe('resolveShotAssetRefs — the usedIn landing for generate_tsx_shot assetRefs (E2)', () => {
  let existingAbs = '';
  let freshAbs = '';

  beforeAll(async () => {
    libRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-shot-refs-test-'));
    existingAbs = path.join(libRoot, 'logos', 'logo.png');
    freshAbs = path.join(libRoot, 'logos', 'fresh.png');
    await fs.mkdir(path.dirname(existingAbs), { recursive: true });
    await fs.writeFile(existingAbs, Buffer.from('png-1'));
    await fs.writeFile(freshAbs, Buffer.from('png-2'));
  });

  afterAll(async () => {
    await fs.rm(libRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    mocks.markLibraryUsedIn.mockClear();
    mocks.importMediaFiles.mockReset();
    mocks.loadIndex.mockReset();
    mocks.loadIndex.mockResolvedValue({
      version: 1,
      entries: [{ relPath: 'logos/fresh.png', origin: 'imported', addedAt: '', description: 'fresh logo' }],
      tombstones: [],
    });
  });

  it('marks every library relPath it resolved — existing or imported — ONCE, with the project id', async () => {
    const existing = asset({ id: 'a1', path: existingAbs, hash: 'h-existing' });
    const project = { id: 'p1', assets: [existing] } as unknown as StudioProject;
    mocks.importMediaFiles.mockResolvedValue({
      assets: [asset({ id: 'a2', path: freshAbs, hash: 'h-fresh' })],
      errors: [],
    });

    const out = await resolveShotAssetRefs(project, {
      logo: 'library:logos/logo.png',
      other: 'library:logos/fresh.png',
      plain: 'a1',
    });

    expect(out.refs).toEqual({ logo: 'a1', other: 'a2', plain: 'a1' });
    expect(out.imported.map((a) => a.id)).toEqual(['a2']);
    expect(out.imported[0].description).toBe('fresh logo');
    expect(mocks.importMediaFiles).toHaveBeenCalledTimes(1);
    expect(mocks.importMediaFiles).toHaveBeenCalledWith('p1', [freshAbs]);
    expect(mocks.markLibraryUsedIn).toHaveBeenCalledTimes(1);
    expect(mocks.markLibraryUsedIn).toHaveBeenCalledWith(libRoot, ['logos/logo.png', 'logos/fresh.png'], 'p1');
  });

  it('marks nothing when no library ref is present', async () => {
    const project = { id: 'p1', assets: [asset({ id: 'a1' })] } as unknown as StudioProject;
    const out = await resolveShotAssetRefs(project, { logo: 'a1' });
    expect(out.refs).toEqual({ logo: 'a1' });
    expect(mocks.markLibraryUsedIn).not.toHaveBeenCalled();
    expect(mocks.importMediaFiles).not.toHaveBeenCalled();
  });

  it('a missing library file throws before anything is marked', async () => {
    const project = { id: 'p1', assets: [] } as unknown as StudioProject;
    await expect(resolveShotAssetRefs(project, { x: 'library:logos/nope.png' })).rejects.toThrow(/not found/i);
    expect(mocks.markLibraryUsedIn).not.toHaveBeenCalled();
  });

  it('a library AUDIO ref beside a valid image ref throws "visual-only" and marks NOTHING (verifier round 1, F2)', async () => {
    const soundAbs = path.join(libRoot, 'sfx', 'hit.mp3');
    await fs.mkdir(path.dirname(soundAbs), { recursive: true });
    await fs.writeFile(soundAbs, Buffer.from('mp3-1'));
    const existing = asset({ id: 'a1', path: existingAbs, hash: 'h-existing' });
    const project = { id: 'p1', assets: [existing] } as unknown as StudioProject;
    mocks.importMediaFiles.mockResolvedValue({
      assets: [asset({ id: 'a9', kind: 'audio', path: soundAbs, hash: 'h-fresh', probe: { duration: 1, hasAudio: true } })],
      errors: [],
    });

    await expect(
      resolveShotAssetRefs(project, { logo: 'library:logos/logo.png', snd: 'library:sfx/hit.mp3' }),
    ).rejects.toThrow(/visual-only/);
    expect(mocks.markLibraryUsedIn).not.toHaveBeenCalled();
  });
});
