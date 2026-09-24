import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';
let builtIn = '';
let installed = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, getVersion: () => '1.2.0', isPackaged: false },
}));
vi.mock('../library/library-paths', () => ({ getInstalledPacksDir: () => installed }));
vi.mock('../../utils/paths', () => ({ getBuiltinPacksDir: () => builtIn }));

import { readTransitionSource, resolveTransition, scanTransitionRoots } from './transition-packs';

const CORE_PACK = path.join(__dirname, '../../../../resources/packs/core');

const COMPONENT = `import React from 'react';
export default function T() { return React.createElement('div'); }
`;

async function writePack(
  root: string,
  packId: string,
  options: {
    transitions?: string[];
    /** Declared in pack.json but never written to disk. */
    ghosts?: string[];
    extra?: Record<string, unknown>;
    source?: string;
  } = {},
): Promise<void> {
  const dir = path.join(root, packId);
  await fs.mkdir(path.join(dir, 'transitions'), { recursive: true });
  const ids = [...(options.transitions ?? []), ...(options.ghosts ?? [])];
  await fs.writeFile(
    path.join(dir, 'pack.json'),
    JSON.stringify({
      formatVersion: 1,
      name: `Pack ${packId}`,
      version: '1.0.0',
      transitions: ids.map((id) => ({ id, name: id, durationSeconds: 0.5 })),
      ...options.extra,
    }),
  );
  for (const id of options.transitions ?? []) {
    await fs.writeFile(path.join(dir, 'transitions', `${id}.tsx`), options.source ?? COMPONENT);
  }
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-transition-packs-'));
  builtIn = path.join(tmpDir, 'resources', 'packs');
  installed = path.join(tmpDir, 'assets', 'packs');
  await fs.mkdir(installed, { recursive: true });
  // The real shipped pack, so the built-in half is tested against what ships.
  await fs.cp(CORE_PACK, path.join(builtIn, 'core'), { recursive: true });

  await writePack(installed, 'core', { transitions: ['impostor'] });
  await writePack(installed, 'wipes', { transitions: ['wipe-up', 'wipe-down'], ghosts: ['wipe-left'] });
  await writePack(installed, 'future', { transitions: ['warp'], extra: { minAppVersion: '9.0.0' } });
  await writePack(installed, 'bad-imports', {
    transitions: ['sneaky'],
    source: `import React from 'react';\nimport fs from 'fs';\nexport default function S() { return null; }\n`,
  });
  // A caption pack sharing the installed root.
  await fs.mkdir(path.join(installed, 'hormozi'), { recursive: true });
  await fs.writeFile(
    path.join(installed, 'hormozi', 'pack.json'),
    JSON.stringify({ id: 'hormozi', name: 'Hormozi', version: '1.0.0', type: 'caption-style' }),
  );
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('scanTransitionRoots', () => {
  it('lists built-ins first, then folder drops', async () => {
    const items = await scanTransitionRoots(builtIn, installed, '1.2.0');
    expect(items.map((i) => i.kind)).toEqual([
      'core/push-left',
      'core/wipe-right',
      'core/zoom-through',
      'core/iris-open',
      'bad-imports/sneaky',
      'wipes/wipe-up',
      'wipes/wipe-down',
    ]);
    const push = items[0];
    expect(push).toMatchObject({ packId: 'core', packName: 'Core Transitions', durationSeconds: 0.7, sceneCopies: 'single' });
    expect(push.filePath).toBe(path.join(builtIn, 'core', 'transitions', 'push-left.tsx'));
  });

  it('skips an installed pack whose id a built-in already owns — whole', async () => {
    const items = await scanTransitionRoots(builtIn, installed, '1.2.0');
    expect(items.some((i) => i.id === 'impostor')).toBe(false);
  });

  it('drops a declared transition whose file is missing, keeping the rest', async () => {
    const items = await scanTransitionRoots(builtIn, installed, '1.2.0');
    expect(items.filter((i) => i.packId === 'wipes').map((i) => i.id)).toEqual(['wipe-up', 'wipe-down']);
  });

  it('holds back a pack that needs a newer app until the app catches up', async () => {
    expect((await scanTransitionRoots(builtIn, installed, '1.2.0')).some((i) => i.packId === 'future')).toBe(false);
    expect((await scanTransitionRoots(builtIn, installed, '9.0.0')).some((i) => i.packId === 'future')).toBe(true);
  });

  it('treats missing roots as empty', async () => {
    expect(await scanTransitionRoots(path.join(tmpDir, 'nope'), path.join(tmpDir, 'nada'), '1.2.0')).toEqual([]);
  });
});

describe('resolveTransition', () => {
  it('finds an installed transition by its document kind', async () => {
    expect((await resolveTransition('wipes/wipe-down'))?.filePath).toBe(
      path.join(installed, 'wipes', 'transitions', 'wipe-down.tsx'),
    );
  });

  it('returns null for what nothing can render — the crossfade fallback', async () => {
    for (const kind of ['crossfade', 'dip-to-black', 'missing/push-left', 'core/nope', 'core/../wipes']) {
      expect(await resolveTransition(kind)).toBeNull();
    }
  });
});

describe('readTransitionSource', () => {
  it('passes every shipped component through the import gate', async () => {
    for (const kind of ['core/push-left', 'core/wipe-right', 'core/zoom-through', 'core/iris-open']) {
      const item = await resolveTransition(kind);
      expect(item).not.toBeNull();
      const read = await readTransitionSource(item!);
      expect(read.ok).toBe(true);
    }
  });

  it('refuses a component that imports outside react/remotion', async () => {
    const read = await readTransitionSource((await resolveTransition('bad-imports/sneaky'))!);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toContain('Import "fs" is not allowed');
  });

  it('reports a file deleted after listing', async () => {
    const item = (await resolveTransition('wipes/wipe-up'))!;
    const read = await readTransitionSource({ ...item, filePath: path.join(tmpDir, 'gone.tsx') });
    expect(read).toMatchObject({ ok: false });
  });
});
