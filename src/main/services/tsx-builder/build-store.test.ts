import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// build-store → tsx-jobs/project-store → utils/paths → electron. Every
// function here takes its folders as parameters, so a bare app stub is enough.
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import {
  createRunDirs,
  listVersionNumbers,
  projectNameFromId,
  pruneRunDirs,
  saveBuildVersion,
  seedWorkFromVersion,
} from './build-store';
import { scanCreatorProjects } from '../studio/creator-projects';

const config = (id: string, width = 1080, height = 1350) =>
  `export const compositionConfig = { id: '${id}', durationInFrames: 240, fps: 30, width: ${width}, height: ${height} };\nexport default function ${id}() { return null; }\n`;

async function write(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf-8');
}

/** A run folder with a two-file source and one still on disk. */
async function makeRun(runsDir: string) {
  const dirs = await createRunDirs(runsDir);
  await write(path.join(dirs.workDir, 'index.tsx'), config('CoinPiles'));
  await write(path.join(dirs.workDir, 'parts', 'coin.tsx'), 'export const Coin = () => null;\n');
  await write(path.join(dirs.workDir, 'DESIGN.md'), '# Coin piles\n');
  const still = path.join(dirs.stillsDir, 'r01-f000.jpg');
  await write(still, 'jpeg-bytes');
  return { dirs, still };
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-build-store-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('run folders', () => {
  it('creates work/ and stills/ under a minted run id', async () => {
    const dirs = await createRunDirs(path.join(tmpDir, 'runs'));
    expect(dirs.runId).toMatch(/^b\d+-[0-9a-f]{6}$/);
    expect((await fs.stat(dirs.workDir)).isDirectory()).toBe(true);
    expect((await fs.stat(dirs.stillsDir)).isDirectory()).toBe(true);
  });

  it('prunes the oldest runs past the limit and leaves foreign folders alone', async () => {
    const runsDir = path.join(tmpDir, 'runs');
    for (const name of ['b1000-aaaaaa', 'b2000-bbbbbb', 'b3000-cccccc', 'keep-me']) {
      await fs.mkdir(path.join(runsDir, name), { recursive: true });
    }
    expect(await pruneRunDirs(runsDir, 2)).toBe(1);
    expect((await fs.readdir(runsDir)).sort()).toEqual(['b2000-bbbbbb', 'b3000-cccccc', 'keep-me']);
  });

  it('prunes nothing when the runs folder does not exist yet', async () => {
    expect(await pruneRunDirs(path.join(tmpDir, 'nope'))).toBe(0);
  });
});

describe('saveBuildVersion', () => {
  it('saves a new build as v1 with its source, stills and debug record', async () => {
    const { dirs, still } = await makeRun(path.join(tmpDir, 'runs'));
    const projectsDir = path.join(tmpDir, 'projects');
    const saved = await saveBuildVersion({
      target: { parentDir: projectsDir, name: projectNameFromId('CoinPiles') },
      code: config('CoinPiles'),
      dirs,
      stills: [{ round: 1, frame: 0, size: 'model', path: still }],
      debug: { kind: 'tsx-builder', rounds: 1 },
    });

    expect(saved.version.number).toBe(1);
    expect(saved.version.folderPath).toBe(path.join(projectsDir, 'coin-piles'));
    expect(await fs.readFile(saved.version.tsxPath, 'utf-8')).toBe(config('CoinPiles'));
    expect(await fs.readFile(path.join(saved.version.srcDir, 'parts', 'coin.tsx'), 'utf-8')).toContain('Coin');
    expect(saved.stills).toEqual([{ round: 1, frame: 0, size: 'model', file: 'v1.stills/r01-f000.jpg' }]);
    expect(await fs.readFile(path.join(saved.version.folderPath, 'v1.stills', 'r01-f000.jpg'), 'utf-8')).toBe('jpeg-bytes');
    const debug = JSON.parse(await fs.readFile(saved.version.debugPath, 'utf-8'));
    expect(debug).toMatchObject({ kind: 'tsx-builder', rounds: 1, stills: saved.stills });
  });

  it('adds the next version to an existing folder', async () => {
    const folder = path.join(tmpDir, 'projects', 'coin-piles');
    await write(path.join(folder, 'v1.tsx'), config('CoinPiles'));
    await write(path.join(folder, 'v2.tsx'), config('CoinPiles'));
    const { dirs } = await makeRun(path.join(tmpDir, 'runs'));
    const saved = await saveBuildVersion({ target: { folderPath: folder }, code: config('CoinPiles'), dirs, stills: [], debug: {} });
    expect(saved.version.number).toBe(3);
    expect(await listVersionNumbers(folder)).toEqual([1, 2, 3]);
  });

  it('skips a still that is missing on disk instead of failing the save', async () => {
    const { dirs } = await makeRun(path.join(tmpDir, 'runs'));
    const saved = await saveBuildVersion({
      target: { parentDir: path.join(tmpDir, 'projects'), name: 'x-piece' },
      code: config('XPiece'),
      dirs,
      stills: [{ round: 1, frame: 0, size: 'model', path: path.join(dirs.stillsDir, 'gone.jpg') }],
      debug: {},
    });
    expect(saved.stills).toEqual([]);
  });

  it('shows in the Creator picker as one project at its latest version', async () => {
    const projectsDir = path.join(tmpDir, 'projects');
    for (let i = 0; i < 2; i += 1) {
      const { dirs, still } = await makeRun(path.join(tmpDir, 'runs'));
      await saveBuildVersion({
        target: i === 0 ? { parentDir: projectsDir, name: 'coin-piles' } : { folderPath: path.join(projectsDir, 'coin-piles') },
        code: config('CoinPiles'),
        dirs,
        stills: [{ round: 1, frame: 0, size: 'model', path: still }],
        debug: {},
      });
    }
    const projects = await scanCreatorProjects(projectsDir);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ name: 'coin-piles', latestVersion: 2 });
  });
});

describe('vN.assets/', () => {
  it('saves assets/ beside the source, never inside vN.src/, and records the files', async () => {
    const { dirs } = await makeRun(path.join(tmpDir, 'runs'));
    await write(path.join(dirs.workDir, 'assets', 'models', 'robot.glb'), 'glb-v1');
    await write(path.join(dirs.workDir, 'assets', 'studio.hdr'), 'hdr');
    const saved = await saveBuildVersion({ target: { parentDir: path.join(tmpDir, 'projects'), name: 'robot' }, code: config('Robot'), dirs, stills: [], debug: {} });
    expect(saved.version.assetsDir).toBe(path.join(saved.version.folderPath, 'v1.assets'));
    expect(await fs.readFile(path.join(saved.version.assetsDir!, 'models', 'robot.glb'), 'utf-8')).toBe('glb-v1');
    await expect(fs.stat(path.join(saved.version.srcDir, 'assets'))).rejects.toThrow();
    const debug = JSON.parse(await fs.readFile(saved.version.debugPath, 'utf-8'));
    expect(debug.assets).toEqual({ files: ['models/robot.glb', 'studio.hdr'], linkedFromPrevious: 0 });
  });

  it('links a file the version before had byte for byte, and copies a changed one', async () => {
    const folder = path.join(tmpDir, 'projects', 'robot');
    await write(path.join(folder, 'v1.tsx'), config('Robot'));
    await write(path.join(folder, 'v1.assets', 'studio.hdr'), 'same-hdr');
    await write(path.join(folder, 'v1.assets', 'robot.glb'), 'glb-v1');
    const { dirs } = await makeRun(path.join(tmpDir, 'runs'));
    await write(path.join(dirs.workDir, 'assets', 'studio.hdr'), 'same-hdr');
    await write(path.join(dirs.workDir, 'assets', 'robot.glb'), 'glb-v2');
    const saved = await saveBuildVersion({ target: { folderPath: folder }, code: config('Robot'), dirs, stills: [], debug: {} });
    const [hdrBefore, hdrNow, glbBefore, glbNow] = await Promise.all(
      [path.join(folder, 'v1.assets', 'studio.hdr'), path.join(folder, 'v2.assets', 'studio.hdr'), path.join(folder, 'v1.assets', 'robot.glb'), path.join(folder, 'v2.assets', 'robot.glb')].map((p) => fs.stat(p)),
    );
    expect(hdrNow.ino).toBe(hdrBefore.ino);
    expect(glbNow.ino).not.toBe(glbBefore.ino);
    expect(await fs.readFile(path.join(saved.version.assetsDir!, 'robot.glb'), 'utf-8')).toBe('glb-v2');
    expect(JSON.parse(await fs.readFile(saved.version.debugPath, 'utf-8')).assets.linkedFromPrevious).toBe(1);
  });

  it('clears a stale vN.assets/ left by a deleted version when the new one has none', async () => {
    const folder = path.join(tmpDir, 'projects', 'robot');
    await write(path.join(folder, 'v1.tsx'), config('Robot'));
    await write(path.join(folder, 'v2.assets', 'old.png'), 'stale');
    const { dirs } = await makeRun(path.join(tmpDir, 'runs'));
    const saved = await saveBuildVersion({ target: { folderPath: folder }, code: config('Robot'), dirs, stills: [], debug: {} });
    expect(saved.version.number).toBe(2);
    expect(saved.version.assetsDir).toBeUndefined();
    await expect(fs.stat(path.join(folder, 'v2.assets'))).rejects.toThrow();
  });

  it('seeds an edit with a COPY of the version files (a rewrite must not reach the saved version)', async () => {
    const folder = path.join(tmpDir, 'projects', 'robot');
    await write(path.join(folder, 'v1.tsx'), config('Robot'));
    await write(path.join(folder, 'v1.src', 'index.tsx'), '// src\n');
    await write(path.join(folder, 'v1.assets', 'data.json'), '{"a":1}');
    const work = path.join(tmpDir, 'work');
    await fs.mkdir(work);
    await seedWorkFromVersion({ folderPath: folder }, work);
    await fs.writeFile(path.join(work, 'assets', 'data.json'), '{"a":2}');
    expect(await fs.readFile(path.join(folder, 'v1.assets', 'data.json'), 'utf-8')).toBe('{"a":1}');
  });
});

describe('seedWorkFromVersion', () => {
  it("continues from the builder's own vN.src/ and its recorded format", async () => {
    const folder = path.join(tmpDir, 'projects', 'coin-piles');
    await write(path.join(folder, 'v1.tsx'), config('CoinPiles'));
    await write(path.join(folder, 'v1.src', 'index.tsx'), '// the source, not the bundle\n');
    await write(path.join(folder, 'v1.src', 'DESIGN.md'), '# round log\n');
    const format = { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true };
    await write(path.join(folder, 'v1.debug.json'), JSON.stringify({ kind: 'tsx-builder', request: { format } }));

    const work = path.join(tmpDir, 'work');
    await fs.mkdir(work);
    const seed = await seedWorkFromVersion({ folderPath: folder }, work);
    expect(seed).toMatchObject({ version: 1, fromSrc: true, format });
    expect(seed.config?.id).toBe('CoinPiles');
    expect(await fs.readFile(path.join(work, 'index.tsx'), 'utf-8')).toBe('// the source, not the bundle\n');
    expect(await fs.readFile(path.join(work, 'DESIGN.md'), 'utf-8')).toBe('# round log\n');
  });

  it('seeds a pre-builder version as its one file, format from its config', async () => {
    const folder = path.join(tmpDir, 'projects', 'old-one');
    await write(path.join(folder, 'v1.tsx'), config('OldOne', 1920, 1080));
    await write(path.join(folder, 'v2.tsx'), config('OldOne', 1080, 1080));
    await write(path.join(folder, 'v2.debug.json'), JSON.stringify({ model: 'one-shot', turns: [] }));

    const work = path.join(tmpDir, 'work');
    await fs.mkdir(work);
    const seed = await seedWorkFromVersion({ folderPath: folder }, work);
    expect(seed).toMatchObject({ version: 2, fromSrc: false });
    expect(seed.format).toEqual({ width: 1080, height: 1080, fps: 30, durationInFrames: 240 });
    expect(await fs.readFile(path.join(work, 'index.tsx'), 'utf-8')).toBe(config('OldOne', 1080, 1080));
  });

  it('seeds the version asked for, and refuses one that is not there', async () => {
    const folder = path.join(tmpDir, 'projects', 'old-one');
    await write(path.join(folder, 'v1.tsx'), config('OldOne', 1920, 1080));
    await write(path.join(folder, 'v2.tsx'), config('OldOne', 1080, 1080));
    const work = path.join(tmpDir, 'work');
    await fs.mkdir(work);
    expect((await seedWorkFromVersion({ folderPath: folder, version: 1 }, work)).format?.width).toBe(1920);
    await expect(seedWorkFromVersion({ folderPath: folder, version: 7 }, work)).rejects.toThrow('v7.tsx not found');
    await expect(seedWorkFromVersion({ folderPath: path.join(tmpDir, 'empty') }, work)).rejects.toThrow('No version to edit');
  });
});

describe('projectNameFromId', () => {
  it('turns a PascalCase composition id into a folder name', () => {
    expect(projectNameFromId('CompoundInterestCoins')).toBe('compound-interest-coins');
    expect(projectNameFromId('DBIndexTree')).toBe('db-index-tree');
    expect(projectNameFromId('Vaccine_Memory2')).toBe('vaccine-memory2');
  });
});
