// P3 part 4: a composition copied anywhere keeps its source and its files
// (composition-copy.ts), the folder helpers the composition tools share
// (composition-file.ts), and what the players are given to show the files
// (`compositionAssetsIn`).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmp = '';
vi.mock('electron', () => ({ app: { getPath: () => tmp, isPackaged: false } }));
vi.mock('../module-server', () => ({
  ensureModuleServer: async () => 4001,
  getModuleServerBaseUrl: () => 'http://127.0.0.1:4001',
  storeTranspileResult: () => 'http://127.0.0.1:4001/modules/h.js',
}));

const { compositionSlug, copyCompositionFolder, copyCompositionVersion, copyVersionAssets } = await import('./composition-copy');
const { compositionVersionOf, releaseEmptyFolder, reserveCompositionFolder } = await import('./tools/composition-file');
const { compositionAssetsIn } = await import('./artifact-paths');

const CODE = "const a = __vidtsxAsset('logo.png'); export const compositionConfig = {};";

async function write(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf-8');
}

async function tree(dir: string, rel = ''): Promise<string[]> {
  const out: string[] = [];
  for (const e of (await fs.readdir(path.join(dir, rel), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await tree(dir, child)));
    else out.push(child);
  }
  return out;
}

let src = '';
let dest = '';

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'composition-copy-'));
  src = path.join(tmp, 'src-work');
  dest = path.join(tmp, 'dest-work');
  const folder = path.join(src, 'compositions', 'promo');
  await write(path.join(folder, 'v1.tsx'), CODE);
  await write(path.join(folder, 'v1.assets', 'logo.png'), 'png-1');
  await write(path.join(folder, 'v2.tsx'), CODE);
  await write(path.join(folder, 'v2.src', 'index.tsx'), 'source');
  await write(path.join(folder, 'v2.src', 'DESIGN.md'), 'design');
  await write(path.join(folder, 'v2.assets', 'logo.png'), 'png-2');
  await write(path.join(folder, 'v2.debug.json'), '{}');
  await write(path.join(folder, 'v2.stills', 'r01-f000.jpg'), 'jpeg');
  await write(path.join(folder, 'chat.json'), '[]');
  await write(path.join(src, 'compositions', 'old.tsx'), 'flat');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('copyCompositionVersion', () => {
  it('copies vN.tsx with its source, files and build record into <parent>/<slug>/', async () => {
    const rel = await copyCompositionVersion(path.join(src, 'compositions', 'promo', 'v2.tsx'), dest, 'context');
    expect(rel).toBe('context/promo/v2.tsx');
    expect(await tree(path.join(dest, 'context', 'promo'))).toEqual([
      'v2.assets/logo.png',
      'v2.debug.json',
      'v2.src/DESIGN.md',
      'v2.src/index.tsx',
      'v2.tsx',
    ]);
    expect(await fs.readFile(path.join(dest, 'context', 'promo', 'v2.assets', 'logo.png'), 'utf-8')).toBe('png-2');
  });

  it('two versions both called v2.tsx get two folders', async () => {
    const tsx = path.join(src, 'compositions', 'promo', 'v2.tsx');
    expect(await copyCompositionVersion(tsx, dest, 'flows/run-1')).toBe('flows/run-1/promo/v2.tsx');
    expect(await copyCompositionVersion(tsx, dest, 'flows/run-1')).toBe('flows/run-1/promo-2/v2.tsx');
  });

  it('a flat legacy file is copied alone, into a folder named after it', async () => {
    const rel = await copyCompositionVersion(path.join(src, 'compositions', 'old.tsx'), dest, 'agents/s-1');
    expect(rel).toBe('agents/s-1/old/old.tsx');
    expect(await tree(path.join(dest, 'agents', 's-1', 'old'))).toEqual(['old.tsx']);
  });

  it('slugs: the version folder, or the flat file', () => {
    expect(compositionSlug('/w/compositions/promo/v3.tsx')).toBe('promo');
    expect(compositionSlug('/w/compositions/old.tsx')).toBe('old');
  });
});

describe('copyVersionAssets', () => {
  it('without an own folder, takes each file from where the player finds it (an earlier version)', async () => {
    const folder = path.join(src, 'compositions', 'promo');
    await write(path.join(folder, 'v3.tsx'), CODE);
    const target = path.join(dest, 'lib', 'promo.assets');
    expect(await copyVersionAssets(path.join(folder, 'v3.tsx'), target)).toBe(true);
    expect(await fs.readFile(path.join(target, 'logo.png'), 'utf-8')).toBe('png-2');
  });

  it('copies nothing for code that loads no files', async () => {
    expect(await copyVersionAssets(path.join(src, 'compositions', 'old.tsx'), path.join(dest, 'old.assets'))).toBe(false);
    await expect(fs.stat(path.join(dest, 'old.assets'))).rejects.toThrow();
  });
});

describe('copyCompositionFolder (Open in Creator)', () => {
  it('copies every version, the stills and chat.json, and returns the same version', async () => {
    const project = path.join(dest, 'projects', 'promo');
    await fs.mkdir(project, { recursive: true });
    const opened = await copyCompositionFolder(path.join(src, 'compositions', 'promo', 'v1.tsx'), project);
    expect(opened).toBe(path.join(project, 'v1.tsx'));
    expect(await tree(project)).toEqual([
      'chat.json',
      'v1.assets/logo.png',
      'v1.tsx',
      'v2.assets/logo.png',
      'v2.debug.json',
      'v2.src/DESIGN.md',
      'v2.src/index.tsx',
      'v2.stills/r01-f000.jpg',
      'v2.tsx',
    ]);
  });

  it('a flat file becomes v1.tsx', async () => {
    const project = path.join(dest, 'projects', 'old');
    const opened = await copyCompositionFolder(path.join(src, 'compositions', 'old.tsx'), project);
    expect(opened).toBe(path.join(project, 'v1.tsx'));
    expect(await fs.readFile(opened, 'utf-8')).toBe('flat');
  });
});

describe('composition-file helpers', () => {
  it('reads a version folder from a relPath, two levels down or more', () => {
    expect(compositionVersionOf('compositions/promo/v12.tsx')).toEqual({ folderRel: 'compositions/promo', version: 12 });
    expect(compositionVersionOf('flows/run-1/promo/v1.tsx')).toEqual({ folderRel: 'flows/run-1/promo', version: 1 });
    expect(compositionVersionOf('compositions\\promo\\v2.tsx')).toEqual({ folderRel: 'compositions/promo', version: 2 });
    expect(compositionVersionOf('compositions/promo.tsx')).toBeNull();
    // A legacy title that slugged to "v1".
    expect(compositionVersionOf('compositions/v1.tsx')).toBeNull();
  });

  it('reserves compositions/<slug>/ by mkdir, -2 next; an unused one can be released', async () => {
    const first = await reserveCompositionFolder(dest, 'Promo Loop!');
    const second = await reserveCompositionFolder(dest, 'Promo Loop!');
    expect([first.relDir, second.relDir]).toEqual(['compositions/promo-loop', 'compositions/promo-loop-2']);
    await releaseEmptyFolder(second.absDir);
    await write(path.join(first.absDir, 'v1.tsx'), 'x');
    await releaseEmptyFolder(first.absDir);
    expect(await fs.readdir(path.join(dest, 'compositions'))).toEqual(['promo-loop']);
  });
});

describe('compositionAssetsIn (the players)', () => {
  it("serves a builder version's files under their lookup keys; none for code without files", async () => {
    const version = (relPath: string) => ({
      id: 'composition-1',
      kind: 'composition' as const,
      title: 'Promo',
      createdAt: 'now',
      producer: { tool: 'generate_composition', callId: 'c' },
      payload: { relPath, config: { id: 'main', durationInFrames: 30, fps: 30, width: 100, height: 100 } },
    });
    const assets = await compositionAssetsIn(src, version('compositions/promo/v2.tsx'));
    expect(Object.keys(assets ?? {})).toEqual(['logo']);
    expect(assets?.logo).toMatch(/^http:\/\/127\.0\.0\.1:4001\/asset-root\/[0-9a-f]+\/logo\.png$/);
    expect(await compositionAssetsIn(src, version('compositions/old.tsx'))).toBeUndefined();
  });
});
