// Import TSX of a TSX builder version (P3 part 6, 1a + 3a): the files a shot
// cannot hold as project media are copied into the new shot's v1.assets/ (a
// .gltf with what it names), images / video / audio stay registered in place,
// and vN.src/ + vN.debug.json travel as v1.src/ + v1.debug.json.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

const importMediaFiles = vi.hoisted(() => vi.fn());
vi.mock('./media-import', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./media-import')>()),
  importMediaFiles,
}));
vi.mock('./studio-paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./studio-paths')>()),
  getProjectDir: async (id: string) => path.join(tmpDir, 'projects', id),
}));
const emit = vi.hoisted(() => vi.fn());
vi.mock('./shot-job-events', () => ({ shotJobEvents: { emit } }));

import { carryBuilderFiles } from './shot-import-files';
import { importShot } from './shot-import';
import { describeImportReport } from '../../../shared/studio/shot-import';

const VERSION = [
  "import React from 'react';",
  "import { AbsoluteFill, Img, staticFile } from 'remotion';",
  "export const compositionConfig = { id: 'probe', durationInFrames: 60, fps: 30, width: 1080, height: 1350 };",
  "const FILES = { logo: staticFile('logo.png'), model: staticFile('robot.glb'), sky: staticFile('studio.hdr'), scene: staticFile('scene.gltf') };",
  'export default function Probe() { return <AbsoluteFill><Img src={FILES.logo} /></AbsoluteFill>; }',
  '',
].join('\n');

const write = async (file: string, data: string | Buffer) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
};

let creatorDir = '';
let sourcePath = '';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-import-files-'));
  creatorDir = path.join(tmpDir, 'creator', 'probe-three');
  sourcePath = path.join(creatorDir, 'v1.tsx');
  await write(sourcePath, VERSION);
  await write(path.join(creatorDir, 'v1.assets', 'logo.png'), 'png');
  await write(path.join(creatorDir, 'v1.assets', 'robot.glb'), Buffer.alloc(64, 1));
  await write(path.join(creatorDir, 'v1.assets', 'studio.hdr'), '#?RADIANCE\n');
  await write(
    path.join(creatorDir, 'v1.assets', 'scene.gltf'),
    JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'scene.bin' }], images: [{ uri: 'tex/wood.png' }, { uri: 'data:image/png;base64,AA==' }] }),
  );
  await write(path.join(creatorDir, 'v1.assets', 'scene.bin'), Buffer.alloc(16, 2));
  await write(path.join(creatorDir, 'v1.assets', 'tex', 'wood.png'), 'wood');
  await write(path.join(creatorDir, 'v1.assets', 'unused.json'), '{}');
  await write(path.join(creatorDir, 'v1.src', 'index.tsx'), '// the real source');
  await write(path.join(creatorDir, 'v1.src', 'parts', 'Robot.tsx'), '// a part');
  await write(path.join(creatorDir, 'v1.debug.json'), JSON.stringify({ format: { loop: false }, turns: [] }));
  await fs.mkdir(path.join(tmpDir, 'projects', 'p1', 'shots'), { recursive: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  importMediaFiles.mockReset();
  emit.mockReset();
  importMediaFiles.mockImplementation(async (_projectId: string, paths: string[]) => ({
    assets: paths.map((p, i) => ({ id: `asset-${i}`, kind: 'image', path: p, probe: { width: 10, height: 10 } })),
  }));
});

describe('carryBuilderFiles', () => {
  it('copies the non-media files the code names (and what a .gltf names), the source and the record', async () => {
    const target = path.join(tmpDir, 'carry', 'v1.tsx');
    await write(target, VERSION);
    const carried = await carryBuilderFiles(sourcePath, VERSION, target);
    expect(carried.copied.sort()).toEqual(['robot.glb', 'scene.bin', 'scene.gltf', 'studio.hdr', 'tex/wood.png']);
    expect(carried).toMatchObject({ source: true, record: true });
    const folder = path.dirname(target);
    expect(await fs.readFile(path.join(folder, 'v1.assets', 'tex', 'wood.png'), 'utf-8')).toBe('wood');
    // The media file stays out (it is registered in place), and so does a file the code never names.
    await expect(fs.stat(path.join(folder, 'v1.assets', 'logo.png'))).rejects.toThrow();
    await expect(fs.stat(path.join(folder, 'v1.assets', 'unused.json'))).rejects.toThrow();
    expect(await fs.readFile(path.join(folder, 'v1.src', 'parts', 'Robot.tsx'), 'utf-8')).toBe('// a part');
    expect(JSON.parse(await fs.readFile(path.join(folder, 'v1.debug.json'), 'utf-8'))).toEqual({ format: { loop: false }, turns: [] });
  });

  it('carries nothing for a plain file with no files and no sidecars', async () => {
    const plain = path.join(tmpDir, 'plain', 'logo-spin.tsx');
    await write(plain, "export const compositionConfig = { id: 'x', durationInFrames: 1, fps: 30, width: 10, height: 10 };");
    const target = path.join(tmpDir, 'plain-shot', 'v1.tsx');
    await write(target, '');
    expect(await carryBuilderFiles(plain, await fs.readFile(plain, 'utf-8'), target)).toEqual({ copied: [], source: false, record: false });
    expect((await fs.readdir(path.dirname(target))).sort()).toEqual(['v1.tsx']);
  });
});

describe('importShot of a builder version', () => {
  it('registers media in place, copies the rest into v1.assets/ with v1.src/ + v1.debug.json, and says so', async () => {
    const onReserved = vi.fn();
    const outcome = await importShot({ projectId: 'p1', sourcePath, onReserved });
    expect(outcome.error).toBeUndefined();
    // No early handshake: the import returns whole, so the IPC response carries the report to the panel.
    expect(onReserved).not.toHaveBeenCalled();
    expect(outcome.shotId).toBe('probe-three');
    const folder = path.join(tmpDir, 'projects', 'p1', 'shots', 'probe-three');
    expect((await fs.readdir(folder)).sort()).toEqual(['v1.assets', 'v1.debug.json', 'v1.src', 'v1.tsx']);
    expect((await fs.readdir(path.join(folder, 'v1.assets'))).sort()).toEqual(['robot.glb', 'scene.bin', 'scene.gltf', 'studio.hdr', 'tex']);
    expect(await fs.readFile(path.join(folder, 'v1.src', 'index.tsx'), 'utf-8')).toBe('// the real source');

    // logo.png is project media, registered where it is (the source folder), never copied.
    expect(importMediaFiles).toHaveBeenCalledWith('p1', [path.join(creatorDir, 'v1.assets', 'logo.png')]);
    const ready = emit.mock.calls.map((c) => c[0]).find((e) => e.status === 'ready');
    expect(ready.shot.assetRefs).toEqual({ logo: 'asset-0' });

    expect(outcome.report?.copiedFiles?.slice().sort()).toEqual(['robot.glb', 'scene.bin', 'scene.gltf', 'studio.hdr', 'tex/wood.png']);
    const notice = describeImportReport(outcome.report!);
    expect(notice).toContain('1 media file attached as project asset.');
    expect(notice).toContain("Copied into the shot's folder: ");
    expect(notice).toContain('(they play from there; they are not project media)');
    expect(notice).not.toMatch(/images, video and audio only/);
  });
});
