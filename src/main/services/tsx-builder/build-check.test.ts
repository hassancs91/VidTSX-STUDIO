// `check` for real (esbuild + every gate) on a temp work folder: the kit is
// inlined from the installed source (P3 part 5, 3a), and a Studio shot build
// refuses a file Studio cannot register as media (2a).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const appRoot = path.resolve(__dirname, '../../../..');
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => appRoot, getPath: () => os.tmpdir() } }));

import { checkBuild, kitSourceDir, studioMediaErrors } from './build-check';

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

  it('refuses a model file in a Studio shot build, and not in any other build', async () => {
    await write(
      'index.tsx',
      [
        "import React from 'react';",
        "import { AbsoluteFill, Img, staticFile } from 'remotion';",
        "export const compositionConfig = { id: 'Media', durationInFrames: 60, fps: 30, width: 1920, height: 1080 };",
        "const DATA = [staticFile('logo.png'), staticFile('points.csv')];",
        'export default function Media() { return <AbsoluteFill><Img src={DATA[0]} /></AbsoluteFill>; }',
      ].join('\n'),
    );
    await write('assets/logo.png', 'png');
    await write('assets/points.csv', 'a,b\n1,2\n');
    expect((await checkBuild(workDir)).errors).toEqual([]);
    const studio = await checkBuild(workDir, undefined, { studioShot: true });
    expect(studio.ok).toBe(false);
    expect(studio.errors).toEqual([
      "staticFile('points.csv'): a data file cannot play in a Studio shot yet; draw it in code (a shot loads images, video and audio).",
    ]);
  });
});

describe('studioMediaErrors', () => {
  it('lets images, video and audio through and names every other kind', () => {
    const errors = studioMediaErrors([
      { ref: 'a.png', relPath: 'a.png', kind: 'image' },
      { ref: 'clip.mp4', relPath: 'clip.mp4', kind: 'video' },
      { ref: 'vo.mp3', relPath: 'vo.mp3', kind: 'audio' },
      { ref: 'robot.glb', relPath: 'robot.glb', kind: 'model' },
      { ref: 'sky.hdr', relPath: 'sky.hdr', kind: 'environment' },
      { ref: 'Inter.woff2', relPath: 'Inter.woff2', kind: 'font' },
    ]);
    expect(errors.map((e) => e.split(':')[0])).toEqual(["staticFile('robot.glb')", "staticFile('sky.hdr')", "staticFile('Inter.woff2')"]);
    expect(errors[0]).toContain('a model file cannot play in a Studio shot yet');
  });
});
