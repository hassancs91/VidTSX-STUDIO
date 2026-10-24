import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { StudioMediaAsset, StudioProject } from '../../../../shared/types/studio';
import type { StudioToolContext } from './types';

let libRoot = '';

const mocks = vi.hoisted(() => ({
  markLibraryUsedIn: vi.fn(async (): Promise<void> => undefined),
  loadProject: vi.fn(),
  importMediaFiles: vi.fn(),
  hashFileHead: vi.fn(async () => 'h-new'),
  loadIndex: vi.fn(),
}));

// The module chain reaches settings-db / electron through library-paths and
// media-import; everything with IO behind it is mocked, the temp library root
// holds a real file so `fs.access` passes.
vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false },
}));
vi.mock('../../library/library-paths', () => ({
  getLibraryRoot: () => libRoot,
  resolveLibraryPath: (root: string, rel: string) => path.resolve(root, rel),
  toLibraryRelPath: (root: string, abs: string) => path.relative(root, abs).split(path.sep).join('/'),
}));
vi.mock('../../library/library-used-in', () => ({ markLibraryUsedIn: mocks.markLibraryUsedIn }));
vi.mock('../../library/library-store', () => ({ loadIndex: mocks.loadIndex }));
vi.mock('../project-store', () => ({ loadProject: mocks.loadProject }));
vi.mock('../media-import', () => ({
  hashFileHead: mocks.hashFileHead,
  importMediaFiles: mocks.importMediaFiles,
}));

import { importLibraryFile } from './library-import';

const REL = 'generated/sfx-a.mp3';
let absPath = '';

function makeCtx(): { ctx: StudioToolContext; events: unknown[] } {
  const events: unknown[] = [];
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: (e: unknown) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return { ctx, events };
}

function project(assets: StudioMediaAsset[]): StudioProject {
  return { id: 'p1', assets } as unknown as StudioProject;
}

function audioAsset(id: string, hash?: string): StudioMediaAsset {
  return { id, kind: 'audio', path: absPath, probe: { duration: 2.97, hasAudio: true }, ...(hash ? { hash } : {}) };
}

beforeAll(async () => {
  libRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-library-import-test-'));
  absPath = path.join(libRoot, 'generated', 'sfx-a.mp3');
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, Buffer.from('not really an mp3'));
});

afterAll(async () => {
  await fs.rm(libRoot, { recursive: true, force: true });
});

beforeEach(() => {
  mocks.markLibraryUsedIn.mockClear();
  mocks.loadProject.mockReset();
  mocks.importMediaFiles.mockReset();
  mocks.hashFileHead.mockClear();
  mocks.loadIndex.mockReset();
  mocks.loadIndex.mockResolvedValue({
    version: 1,
    entries: [{ relPath: REL, origin: 'generated', addedAt: '2026-10-24T09:00:00.000Z', description: 'a whoosh' }],
    tombstones: [],
  });
});

describe('importLibraryFile — the usedIn landing for every library: ref (insert_asset, generate_sfx, the W3 tools)', () => {
  it('returns the project asset already there AND marks usedIn (the re-mark is a no-op in the index)', async () => {
    const existing = audioAsset('asset-1', 'h-new');
    mocks.loadProject.mockResolvedValue(project([existing]));
    const { ctx, events } = makeCtx();

    const got = await importLibraryFile(ctx, REL);

    expect(got).toBe(existing);
    expect(mocks.importMediaFiles).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    expect(mocks.markLibraryUsedIn).toHaveBeenCalledTimes(1);
    expect(mocks.markLibraryUsedIn).toHaveBeenCalledWith(libRoot, [REL], 'p1');
  });

  it('imports a fresh file, carries the index description, emits it, and marks usedIn with the canonical key', async () => {
    mocks.loadProject.mockResolvedValue(project([]));
    mocks.importMediaFiles.mockResolvedValue({ assets: [audioAsset('asset-9')], errors: [] });
    const { ctx, events } = makeCtx();

    const got = await importLibraryFile(ctx, `./${REL}`); // unnormalized spelling → the index key

    expect(got.id).toBe('asset-9');
    expect(got.description).toBe('a whoosh');
    expect(mocks.importMediaFiles).toHaveBeenCalledWith('p1', [absPath]);
    expect(ctx.state.importedAssets.get('asset-9')).toBe(got);
    expect(events).toEqual([{ projectId: 'p1', kind: 'assets-imported', assets: [got] }]);
    expect(mocks.markLibraryUsedIn).toHaveBeenCalledTimes(1);
    expect(mocks.markLibraryUsedIn).toHaveBeenCalledWith(libRoot, [REL], 'p1');
  });

  it('a missing file throws before anything is marked', async () => {
    mocks.loadProject.mockResolvedValue(project([]));
    const { ctx } = makeCtx();
    await expect(importLibraryFile(ctx, 'generated/nope.mp3')).rejects.toThrow(/not found/i);
    expect(mocks.markLibraryUsedIn).not.toHaveBeenCalled();
  });

  it('a failed import throws and marks nothing', async () => {
    mocks.loadProject.mockResolvedValue(project([]));
    mocks.importMediaFiles.mockResolvedValue({ assets: [], errors: ['ffprobe said no'] });
    const { ctx } = makeCtx();
    await expect(importLibraryFile(ctx, REL)).rejects.toThrow(/ffprobe said no/);
    expect(mocks.markLibraryUsedIn).not.toHaveBeenCalled();
  });
});
