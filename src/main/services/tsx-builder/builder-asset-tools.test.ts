import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let libraryRoot = '';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir(), isPackaged: false } }));
vi.mock('../library/library-paths', () => ({
  getLibraryRoot: () => libraryRoot,
  resolveLibraryPath: (root: string, rel: string) => path.join(root, ...rel.split('/')),
}));
vi.mock('../library/library-store', () => ({ scanLibrary: vi.fn() }));
vi.mock('../library/generate-image-asset', () => ({ generateImageAsset: vi.fn() }));
const checkReady = vi.fn();
vi.mock('../../../image-engine', () => ({ imageEngine: { checkReady: (...args: unknown[]) => checkReady(...args) } }));

import { attachRequestAssets, cleanAssetName, copyIntoAssets, imageGenerationAvailable, rankLibrary } from './builder-asset-tools';

let tmp = '';
let assets = '';

async function put(file: string, content = 'x'): Promise<string> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
  return file;
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'builder-asset-tools-'));
  libraryRoot = path.join(tmp, 'library');
  assets = path.join(tmp, 'work', 'assets');
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('imageGenerationAvailable', () => {
  it('is off when the active provider is registered but cannot run, with its reason (P2 problem 3)', async () => {
    checkReady.mockResolvedValueOnce({ ready: false, providerId: 'local-sd', reason: 'sd-cli is not installed.' });
    expect(await imageGenerationAvailable()).toEqual({ ok: false, reason: 'sd-cli is not installed.' });
    checkReady.mockResolvedValueOnce({ ready: true, providerId: 'fal' });
    expect(await imageGenerationAvailable()).toEqual({ ok: true, provider: 'fal' });
    checkReady.mockRejectedValueOnce(new Error('engine not started'));
    expect(await imageGenerationAvailable()).toEqual({ ok: false, reason: 'engine not started' });
  });
});

describe('cleanAssetName', () => {
  it('keeps a relative name of a served kind and drops a stray assets/ prefix', () => {
    expect(cleanAssetName('models/robot.glb')).toBe('models/robot.glb');
    expect(cleanAssetName('./assets/logo.png')).toBe('logo.png');
    expect(cleanAssetName('a\\b.png')).toBe('a/b.png');
  });

  it('refuses a way out, a hidden file, an absolute path and an unserved kind', () => {
    expect(cleanAssetName('../x.png')).toBeNull();
    expect(cleanAssetName('.secret.png')).toBeNull();
    expect(cleanAssetName('C:/x.png')).toBeNull();
    expect(cleanAssetName('tool.exe')).toBeNull();
  });
});

describe('rankLibrary', () => {
  const entries = [
    { relPath: 'brand/logo-dark.svg', description: 'The company logo, white on navy' },
    { relPath: 'brand/logo-light.png', description: 'Logo for light backgrounds', probe: { duration: 0, width: 800, height: 200, hasAudio: false } },
    { relPath: '3d/robot.glb', description: 'A friendly robot', size: 2_000_000 },
    { relPath: 'notes/readme.md' },
  ];

  it('ranks file-name matches over description matches and filters by kind', () => {
    expect(rankLibrary(entries, 'logo dark').map((h) => h.relPath)).toEqual(['brand/logo-dark.svg', 'brand/logo-light.png']);
    expect(rankLibrary(entries, 'logo', 'image')[1]).toMatchObject({ width: 800, height: 200 });
    expect(rankLibrary(entries, 'friendly').map((h) => h.relPath)).toEqual(['3d/robot.glb']);
    expect(rankLibrary(entries, '', 'model').map((h) => h.relPath)).toEqual(['3d/robot.glb']);
  });

  it('never lists a file the renderer cannot serve', () => {
    expect(rankLibrary(entries, 'readme')).toEqual([]);
  });
});

describe('placing files in assets/', () => {
  it('copies a .gltf with the buffer and textures it names', async () => {
    const gltf = await put(
      path.join(libraryRoot, 'scan', 'chair.gltf'),
      JSON.stringify({ buffers: [{ uri: 'chair.bin' }], images: [{ uri: 'tex/wood%20grain.jpg' }, { uri: 'data:image/png;base64,AA' }] }),
    );
    await put(path.join(libraryRoot, 'scan', 'chair.bin'), 'bin');
    await put(path.join(libraryRoot, 'scan', 'tex', 'wood grain.jpg'), 'jpg');
    const placed = await copyIntoAssets(assets, gltf, 'models/chair.gltf');
    expect(placed.map((p) => p.relPath)).toEqual(['models/chair.gltf', 'models/chair.bin', 'models/tex/wood grain.jpg']);
    await expect(copyIntoAssets(assets, gltf, 'models/chair.gltf')).rejects.toThrow('already exists');
  });

  it("attaches the request's files by path or library ref, and refuses a clash or a bad name", async () => {
    const photo = await put(path.join(tmp, 'in', 'photo.jpg'));
    await put(path.join(libraryRoot, 'brand', 'logo.svg'), '<svg/>');
    await attachRequestAssets(assets, [{ path: photo }, { path: 'library:brand/logo.svg', name: 'brand/logo.svg' }]);
    expect((await fs.readdir(assets, { recursive: true })).map((p) => p.split(path.sep).join('/')).sort()).toEqual([
      'brand',
      'brand/logo.svg',
      'photo.jpg',
    ]);
    await expect(attachRequestAssets(assets, [{ path: photo }])).rejects.toThrow('already exists');
    await expect(attachRequestAssets(assets, [{ path: photo, name: '../out.jpg' }])).rejects.toThrow('not a usable name');
    await expect(attachRequestAssets(assets, [{ path: path.join(tmp, 'nope.png') }])).rejects.toThrow('was not found');
    await expect(attachRequestAssets(assets, [{ path: 'relative.png' }])).rejects.toThrow('absolute path');
  });
});
