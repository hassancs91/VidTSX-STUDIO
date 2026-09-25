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

import { readFilterSource, resolveFilter, scanFilterRoots } from './filter-packs';

/** The shape the add-ons builder emits: a bundle with a default export. */
const MODULE = `var filter = { id: "x", name: "X", tier: "common", tagline: "", description: "", accent: "#ffffff", symbol: "",
  faceTracking: false, animated: false, defaultIntensity: 1, render(f) { f.ctx.drawImage(f.source, 0, 0); } };
export { filter as default };
`;

async function writePack(
  root: string,
  packId: string,
  options: {
    filters?: string[];
    /** Declared in pack.json but never written to disk. */
    ghosts?: string[];
    /** Declared with a requirement this build cannot meet. */
    tracked?: string[];
    extra?: Record<string, unknown>;
    entry?: Record<string, unknown>;
    source?: string;
    /** Emit a transitions-only or caption manifest instead. */
    manifest?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const dir = path.join(root, packId);
  await fs.mkdir(path.join(dir, 'filters'), { recursive: true });
  const written = [...(options.filters ?? []), ...(options.tracked ?? [])];
  const ids = [...written, ...(options.ghosts ?? [])];
  await fs.writeFile(
    path.join(dir, 'pack.json'),
    JSON.stringify(
      options.manifest ?? {
        formatVersion: 1,
        name: `Pack ${packId}`,
        version: '1.0.0',
        filters: ids.map((id) => ({
          id,
          name: id,
          category: 'filter',
          ...(options.tracked?.includes(id) ? { requires: ['subjectMask'] } : {}),
          ...options.entry,
        })),
        ...options.extra,
      },
    ),
  );
  for (const id of written) {
    await fs.writeFile(path.join(dir, 'filters', `${id}.js`), options.source ?? MODULE);
  }
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-filter-packs-'));
  builtIn = path.join(tmpDir, 'resources', 'packs');
  installed = path.join(tmpDir, 'assets', 'packs');
  await fs.mkdir(installed, { recursive: true });

  await writePack(builtIn, 'core', { filters: ['noir', 'vhs'], tracked: ['puppy'], entry: { heavy: false } });
  await writePack(installed, 'core', { filters: ['impostor'] });
  await writePack(installed, 'looks', { filters: ['teal', 'orange'], ghosts: ['ghost'] });
  await writePack(installed, 'future', { filters: ['warp'], extra: { minAppVersion: '9.0.0' } });
  await writePack(installed, 'bad-source', {
    filters: ['sneaky'],
    source: `import React from 'react';\nexport default { id: 's', render() { return Date.now(); } };\n`,
  });
  // A transitions-only pack and a caption pack sharing the installed root.
  await writePack(installed, 'wipes', { manifest: { formatVersion: 1, name: 'Wipes', version: '1.0.0', transitions: [] } });
  await writePack(installed, 'hormozi', { manifest: { id: 'hormozi', name: 'Hormozi', version: '1.0.0', type: 'caption-style' } });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('scanFilterRoots', () => {
  it('lists built-ins first, then folder drops, holding back what needs tracking', async () => {
    const items = await scanFilterRoots(builtIn, installed, '1.2.0');
    expect(items.map((i) => i.kind)).toEqual(['core/noir', 'core/vhs', 'bad-source/sneaky', 'looks/teal', 'looks/orange']);
    expect(items[0]).toMatchObject({ packId: 'core', packName: 'Pack core', category: 'filter', heavy: false });
    expect(items[0].filePath).toBe(path.join(builtIn, 'core', 'filters', 'noir.js'));
  });

  it('skips an installed pack whose id a built-in already owns — whole', async () => {
    const items = await scanFilterRoots(builtIn, installed, '1.2.0');
    expect(items.some((i) => i.id === 'impostor')).toBe(false);
  });

  it('drops a declared filter whose file is missing, keeping the rest', async () => {
    const items = await scanFilterRoots(builtIn, installed, '1.2.0');
    expect(items.filter((i) => i.packId === 'looks').map((i) => i.id)).toEqual(['teal', 'orange']);
  });

  it('holds back a pack that needs a newer app until the app catches up', async () => {
    expect((await scanFilterRoots(builtIn, installed, '1.2.0')).some((i) => i.packId === 'future')).toBe(false);
    expect((await scanFilterRoots(builtIn, installed, '9.0.0')).some((i) => i.packId === 'future')).toBe(true);
  });

  it('treats missing roots as empty', async () => {
    expect(await scanFilterRoots(path.join(tmpDir, 'nope'), path.join(tmpDir, 'nada'), '1.2.0')).toEqual([]);
  });
});

describe('resolveFilter', () => {
  it('finds an installed filter by its document kind', async () => {
    expect((await resolveFilter('looks/orange'))?.filePath).toBe(path.join(installed, 'looks', 'filters', 'orange.js'));
  });

  it('returns null for what nothing can render — the plain-picture fallback', async () => {
    for (const kind of ['noir', 'missing/noir', 'core/nope', 'core/puppy', 'core/../looks', 'wipes/x']) {
      expect(await resolveFilter(kind)).toBeNull();
    }
  });
});

describe('readFilterSource', () => {
  it('passes a bundled module through the gate', async () => {
    const read = await readFilterSource((await resolveFilter('core/noir'))!);
    expect(read.ok).toBe(true);
  });

  it('refuses a module with an import or a clock', async () => {
    const read = await readFilterSource((await resolveFilter('bad-source/sneaky'))!);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.error).toContain('Import "react" is not allowed');
    expect(!read.ok && read.error).toContain('Date.now()');
  });

  it('reports a file deleted after listing', async () => {
    const item = (await resolveFilter('looks/teal'))!;
    expect(await readFilterSource({ ...item, filePath: path.join(tmpDir, 'gone.js') })).toMatchObject({ ok: false });
  });
});

// The shipped core pack itself (resources/packs/core): the three first
// filters list, each bundle passes the gate, and the manifest carries what the
// Inspector reads without a module.
describe('the built-in core pack', () => {
  const CORE_PACK = path.join(__dirname, '../../../../resources/packs/core');
  let realBuiltIn = '';

  beforeAll(async () => {
    realBuiltIn = path.join(tmpDir, 'real', 'packs');
    await fs.cp(CORE_PACK, path.join(realBuiltIn, 'core'), { recursive: true });
  });

  it('lists noir (a filter), vhs (an animated effect) and cinematic-bloom (knobs, presets, heavy)', async () => {
    const items = await scanFilterRoots(realBuiltIn, path.join(tmpDir, 'none'), '1.2.0');
    expect(items.map((i) => i.kind)).toEqual(['core/noir', 'core/vhs', 'core/cinematic-bloom']);
    expect(items[0]).toMatchObject({ packName: 'Core', category: 'filter', animated: false, heavy: false, defaultIntensity: 1 });
    expect(items[1]).toMatchObject({ category: 'effect', animated: true, defaultIntensity: 0.85 });
    expect(items[2]).toMatchObject({ category: 'effect', heavy: true });
    expect(items[2].parameters.map((p) => p.key)).toEqual(['threshold', 'radius', 'warmth', 'strength']);
    expect(items[2].presets.map((p) => p.id)).toEqual(['neutral-glass', 'golden-diffusion', 'dreamlight']);
  });

  it('passes every shipped bundle through the gate', async () => {
    const items = await scanFilterRoots(realBuiltIn, path.join(tmpDir, 'none'), '1.2.0');
    for (const item of items) {
      const read = await readFilterSource(item);
      expect(read.ok, item.kind).toBe(true);
      if (read.ok) expect(read.source).not.toMatch(/^\s*import\s/m);
    }
  });
});
