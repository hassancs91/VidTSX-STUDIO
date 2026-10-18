import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// build-seed → version-assets → asset-roots → electron. Every function here
// takes its folders as parameters, so a bare app stub is enough.
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import { HAND_EDITS_FILE, HAND_EDITS_MAX_LINES, seedWorkFromVersion } from './build-seed';
import { sha256Text } from './build-store';

const config = (id: string, width = 1080, height = 1350) =>
  `export const compositionConfig = { id: '${id}', durationInFrames: 240, fps: 30, width: ${width}, height: ${height} };\nexport default function ${id}() { return null; }\n`;

/** A saved builder bundle: a header, the config, then many lines of inlined code. */
const bundleOf = (id: string, body: string[] = Array.from({ length: 60 }, (_, i) => `const line${i} = ${i};`)) =>
  ['// Imported into VidTSX Studio: bundled to one file.', ...config(id).trim().split('\n'), ...body, ''].join('\n');

const format = { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true };

async function write(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf-8');
}

/** vN as the builder saves it: bundle, src/, debug record (with the bundle's hash unless `hash: false`). */
async function builderVersion(
  folder: string,
  n: number,
  bundle: string,
  opts: { hash?: boolean; assets?: Record<string, string>; request?: Record<string, unknown> } = {},
) {
  await write(path.join(folder, `v${n}.tsx`), bundle);
  await write(path.join(folder, `v${n}.src`, 'index.tsx'), `// v${n} source\n`);
  await write(path.join(folder, `v${n}.src`, 'DESIGN.md'), `# v${n} round log\n`);
  for (const [name, content] of Object.entries(opts.assets ?? {})) await write(path.join(folder, `v${n}.assets`, name), content);
  const debug = { kind: 'tsx-builder', request: { format, ...opts.request }, ...(opts.hash === false ? {} : { artifactSha256: sha256Text(bundle) }) };
  await write(path.join(folder, `v${n}.debug.json`), JSON.stringify(debug));
}

async function workDir(): Promise<string> {
  const work = path.join(tmpDir, `work-${Math.random().toString(36).slice(2, 8)}`);
  await fs.mkdir(work);
  return work;
}

const exists = (p: string) => fs.stat(p).then(() => true, () => false);

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-build-seed-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('seedWorkFromVersion', () => {
  it("continues from the builder's own vN.src/ and its recorded format while vN.tsx is still its bundle", async () => {
    const folder = path.join(tmpDir, 'projects', 'coin-piles');
    await builderVersion(folder, 1, bundleOf('CoinPiles'));
    const work = await workDir();
    const seed = await seedWorkFromVersion({ folderPath: folder }, work);
    expect(seed).toMatchObject({ version: 1, kind: 'src', srcVersion: 1, format });
    expect(seed.config?.id).toBe('CoinPiles');
    expect(await fs.readFile(path.join(work, 'index.tsx'), 'utf-8')).toBe('// v1 source\n');
    expect(await fs.readFile(path.join(work, 'DESIGN.md'), 'utf-8')).toBe('# v1 round log\n');
    expect(await exists(path.join(work, HAND_EDITS_FILE))).toBe(false);
  });

  it('takes a builder version saved before the hash as unchanged', async () => {
    const folder = path.join(tmpDir, 'projects', 'coin-piles');
    await builderVersion(folder, 1, bundleOf('CoinPiles'), { hash: false });
    await fs.appendFile(path.join(folder, 'v1.tsx'), '// typed by hand\n');
    expect((await seedWorkFromVersion({ folderPath: folder }, await workDir())).kind).toBe('src');
  });

  it('seeds a pre-builder version as its one file, format from its config', async () => {
    const folder = path.join(tmpDir, 'projects', 'old-one');
    await write(path.join(folder, 'v1.tsx'), config('OldOne', 1920, 1080));
    await write(path.join(folder, 'v2.tsx'), config('OldOne', 1080, 1080));
    await write(path.join(folder, 'v2.debug.json'), JSON.stringify({ model: 'one-shot', turns: [] }));
    const work = await workDir();
    const seed = await seedWorkFromVersion({ folderPath: folder }, work);
    expect(seed).toMatchObject({ version: 2, kind: 'file' });
    expect(seed.bundle).toBeUndefined();
    expect(seed.format).toEqual({ width: 1080, height: 1080, fps: 30, durationInFrames: 240 });
    expect(await fs.readFile(path.join(work, 'index.tsx'), 'utf-8')).toBe(config('OldOne', 1080, 1080));
    expect(await exists(path.join(work, 'DESIGN.md'))).toBe(false);
  });

  it('seeds the version asked for, and refuses one that is not there', async () => {
    const folder = path.join(tmpDir, 'projects', 'old-one');
    await write(path.join(folder, 'v1.tsx'), config('OldOne', 1920, 1080));
    await write(path.join(folder, 'v2.tsx'), config('OldOne', 1080, 1080));
    const work = await workDir();
    expect((await seedWorkFromVersion({ folderPath: folder, version: 1 }, work)).format?.width).toBe(1920);
    await expect(seedWorkFromVersion({ folderPath: folder, version: 7 }, work)).rejects.toThrow('v7.tsx not found');
    await expect(seedWorkFromVersion({ folderPath: path.join(tmpDir, 'empty') }, work)).rejects.toThrow('No version to edit');
  });

  it('seeds an edit with a COPY of the version files (a rewrite must not reach the saved version)', async () => {
    const folder = path.join(tmpDir, 'projects', 'robot');
    await builderVersion(folder, 1, bundleOf('Robot'), { assets: { 'data.json': '{"a":1}' } });
    const work = await workDir();
    await seedWorkFromVersion({ folderPath: folder }, work);
    await fs.writeFile(path.join(work, 'assets', 'data.json'), '{"a":2}');
    expect(await fs.readFile(path.join(folder, 'v1.assets', 'data.json'), 'utf-8')).toBe('{"a":1}');
  });

  it('carries a "Save as new version" of a builder version as vK.src/ + HAND-EDITS.diff, with vK.assets/', async () => {
    const folder = path.join(tmpDir, 'projects', 'bounce');
    const v1 = bundleOf('Bounce');
    await builderVersion(folder, 1, v1, { assets: { 'ball.png': 'png' } });
    await write(path.join(folder, 'v2.tsx'), v1.replace('const line30 = 30;', "const line30 = 30; const title = 'Bounce!';"));
    const work = await workDir();
    const seed = await seedWorkFromVersion({ folderPath: folder }, work);
    expect(seed).toMatchObject({ version: 2, kind: 'hand-edits', srcVersion: 1, handEditLines: 2 });
    expect(seed.format).toEqual(format);
    expect(await fs.readFile(path.join(work, 'index.tsx'), 'utf-8')).toBe('// v1 source\n');
    expect(await fs.readFile(path.join(work, 'assets', 'ball.png'), 'utf-8')).toBe('png');
    const diff = await fs.readFile(path.join(work, HAND_EDITS_FILE), 'utf-8');
    expect(diff).toContain('--- v1.tsx (as the builder saved it)');
    expect(diff).toContain('+++ v2.tsx (as it is now)');
    expect(diff).toContain('-const line30 = 30;');
    expect(diff).toContain("+const line30 = 30; const title = 'Bounce!';");
  });

  it("carries the version's craft packs and style words for an edit that names none; a hand-saved copy keeps vK's", async () => {
    const folder = path.join(tmpDir, 'projects', 'piles');
    const v1 = bundleOf('Piles');
    const craft = { packs: ['core/infographic-loop', 'core/concept-to-picture', 'core/style-custom'], style: 'Chalkboard, wobbly lines' };
    await builderVersion(folder, 1, v1, { request: { packs: ['Infographic loop'], craftPacks: craft.packs, style: craft.style } });
    expect((await seedWorkFromVersion({ folderPath: folder }, await workDir())).craft).toEqual(craft);

    await write(path.join(folder, 'v2.tsx'), v1.replace('const line30 = 30;', 'const line30 = 31;'));
    const handSaved = await seedWorkFromVersion({ folderPath: folder }, await workDir());
    expect(handSaved).toMatchObject({ version: 2, kind: 'hand-edits', craft });

    // A builder version from before P4 (pack names only) has none.
    await builderVersion(folder, 3, bundleOf('Piles3'), { request: { packs: [] } });
    expect((await seedWorkFromVersion({ folderPath: folder }, await workDir())).craft).toBeUndefined();
  });

  it('treats a saved-as-new copy with no change as the builder version itself', async () => {
    const folder = path.join(tmpDir, 'projects', 'bounce');
    await builderVersion(folder, 1, bundleOf('Bounce'));
    await write(path.join(folder, 'v2.tsx'), bundleOf('Bounce'));
    const seed = await seedWorkFromVersion({ folderPath: folder }, await workDir());
    expect(seed).toMatchObject({ version: 2, kind: 'src', srcVersion: 1 });
  });

  it('diffs a bundle changed in place (Overwrite, the Code tab) against vN.src/ bundled again', async () => {
    const folder = path.join(tmpDir, 'projects', 'bounce');
    const v1 = bundleOf('Bounce');
    await builderVersion(folder, 1, v1);
    // The Code tab auto-saved a hand change into v1.tsx, and made it 6 s long.
    await fs.writeFile(path.join(folder, 'v1.tsx'), v1.replace('durationInFrames: 240', 'durationInFrames: 180').replace('const line5 = 5;', 'const line5 = 50;'));
    const rebundle = vi.fn(async () => v1);
    const work = await workDir();
    const seed = await seedWorkFromVersion({ folderPath: folder }, work, { rebundle });
    expect(rebundle).toHaveBeenCalledWith(path.join(folder, 'v1.src'));
    expect(seed).toMatchObject({ version: 1, kind: 'hand-edits', srcVersion: 1, handEditLines: 4 });
    // Its own config is the format now; the loop comes from the builder's record.
    expect(seed.format).toEqual({ ...format, durationInFrames: 180 });
    const diff = await fs.readFile(path.join(work, HAND_EDITS_FILE), 'utf-8');
    expect(diff).toContain('+const line5 = 50;');
  });

  it('starts from the file, with vK\'s DESIGN.md and its named files, when the hand change is a rewrite', async () => {
    const folder = path.join(tmpDir, 'projects', 'robot');
    await builderVersion(folder, 1, bundleOf('Robot'), { assets: { 'robot.glb': 'glb', 'unused.png': 'png' } });
    const rewrite = bundleOf('Robot', [
      "const model = __vidtsxAsset('robot.glb');",
      ...Array.from({ length: HAND_EDITS_MAX_LINES }, (_, i) => `const other${i} = ${i};`),
    ]);
    await write(path.join(folder, 'v2.tsx'), rewrite);
    const work = await workDir();
    const seed = await seedWorkFromVersion({ folderPath: folder }, work);
    expect(seed).toMatchObject({ version: 2, kind: 'file', bundle: true, bundleAssets: true, srcVersion: 1 });
    expect(await fs.readFile(path.join(work, 'index.tsx'), 'utf-8')).toBe(rewrite);
    expect(await fs.readFile(path.join(work, 'DESIGN.md'), 'utf-8')).toBe('# v1 round log\n');
    expect(await fs.readFile(path.join(work, 'assets', 'robot.glb'), 'utf-8')).toBe('glb');
    expect(await exists(path.join(work, 'assets', 'unused.png'))).toBe(false);
  });

  it('starts from the file when a bundle changed in place cannot be bundled again', async () => {
    const folder = path.join(tmpDir, 'projects', 'bounce');
    await builderVersion(folder, 1, bundleOf('Bounce'));
    await fs.appendFile(path.join(folder, 'v1.tsx'), '// typed by hand\n');
    const seed = await seedWorkFromVersion({ folderPath: folder }, await workDir(), { rebundle: async () => null });
    expect(seed).toMatchObject({ kind: 'file', bundle: true, srcVersion: 1 });
  });
});
