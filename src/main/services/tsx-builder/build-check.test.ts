// `check` for real (esbuild + every gate) on a temp work folder: the kit is
// inlined from the installed source (P3 part 5, 3a), and every file kind loads
// (a Studio shot plays a version's files from its folder since P3 part 6).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const appRoot = path.resolve(__dirname, '../../../..');
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => appRoot, getPath: () => os.tmpdir() } }));

import { checkBuild, kitSourceDir } from './build-check';

let workDir = '';
const write = async (rel: string, text: string) => {
  const file = path.join(workDir, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
};

const KIT_PIECE = [
  "import React from 'react';",
  "import { AbsoluteFill } from 'remotion';",
  "import { TerminalWindow } from '@vidtsx/kit';",
  "export const compositionConfig = { id: 'KitShot', durationInFrames: 60, fps: 30, width: 1920, height: 1080 };",
  'export default function KitShot() { return <AbsoluteFill><TerminalWindow lines={[]} /></AbsoluteFill>; }',
].join('\n');

beforeAll(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-build-check-'));
});
afterAll(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('checkBuild', () => {
  it('finds the installed kit source', () => {
    expect(kitSourceDir()).toBe(path.join(appRoot, 'resources', 'shot-kit', 'core'));
  });

  it('inlines @vidtsx/kit, so the artifact passes the Creator import lint too', async () => {
    await write('index.tsx', KIT_PIECE);
    const result = await checkBuild(workDir, { width: 1920, height: 1080, fps: 30, durationInFrames: 60 });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.code).not.toContain('@vidtsx/kit');
    expect(result.inlinedPackages).toContain('@vidtsx/kit');
  });

  it('passes a piece that loads a model, an environment map, a font and data (a Studio shot plays them from its folder)', async () => {
    await write(
      'index.tsx',
      [
        "import React from 'react';",
        "import { AbsoluteFill, Img, staticFile } from 'remotion';",
        "export const compositionConfig = { id: 'Files', durationInFrames: 60, fps: 30, width: 1920, height: 1080 };",
        "const FILES = [staticFile('logo.png'), staticFile('robot.glb'), staticFile('studio.hdr'), staticFile('Inter.ttf'), staticFile('points.json')];",
        'export default function Files() { return <AbsoluteFill><Img src={FILES[0]} /></AbsoluteFill>; }',
      ].join('\n'),
    );
    await write('assets/logo.png', 'png');
    await fs.writeFile(path.join(workDir, 'assets', 'robot.glb'), minimalGlb());
    await write('assets/studio.hdr', '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n');
    await write('assets/Inter.ttf', 'ttf');
    await write('assets/points.json', '[1,2,3]');
    const result = await checkBuild(workDir, { width: 1920, height: 1080, fps: 30, durationInFrames: 60 });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.assets.map((a) => [a.relPath, a.kind])).toEqual([
      ['logo.png', 'image'],
      ['robot.glb', 'model'],
      ['studio.hdr', 'environment'],
      ['Inter.ttf', 'font'],
      ['points.json', 'data'],
    ]);
  });
});

/** The smallest binary glTF 2.0: the 12-byte header and one JSON chunk. */
function minimalGlb(): Buffer {
  const json = Buffer.from('{"asset":{"version":"2.0"}}  ', 'utf8'); // padded to a multiple of 4
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + json.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, json]);
}