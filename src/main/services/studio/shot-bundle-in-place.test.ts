// The in-place bundle (P3 part 8, D10), run for real: esbuild over a shot
// folder, the shot lint as the gate. A Creator 2D source lands as vN+1 in the
// SAME folder with the original kept; media beside it is registered; what the
// bundler refuses (tone) writes nothing and says why.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const NODE_MODULES = path.resolve(__dirname, '../../../../node_modules');

// The gate without the transpile worker: the same lint + config parse the shot gate runs.
vi.mock('./shot-generator', async () => {
  const { lintShotSource } = await import('../../../shared/studio/shot-lint');
  const { parseCompositionConfig } = await import('../composition-config-parser');
  return {
    validateShotCode: async (code: string) => {
      const lint = lintShotSource(code);
      if (!lint.ok) return { success: false, error: lint.errors.join(' ') };
      return parseCompositionConfig(code) ? { success: true } : { success: false, error: 'compositionConfig could not be parsed' };
    },
  };
});
vi.mock('./shot-import-land', () => ({ ORIGINAL_FILE_NAME: 'original.tsx', bundleNodePaths: () => [NODE_MODULES] }));
const media = vi.hoisted(() => ({ registered: [] as string[][] }));
vi.mock('./media-import', () => ({
  importMediaFiles: async (_projectId: string, paths: string[]) => {
    media.registered.push(paths);
    return { assets: paths.map((p, i) => ({ id: `asset-${i + 1}`, kind: 'image', path: p })), errors: [] };
  },
}));

import { bundleShotInPlace, keepOriginal } from './shot-bundle-in-place';
import { lintShotSource } from '../../../shared/studio/shot-lint';

let root = '';
const CONFIG = "export const compositionConfig = { id: 'Shot', durationInFrames: 30, fps: 30, width: 1080, height: 1080 };";

async function shotFolder(id: string, files: Record<string, string>): Promise<string> {
  const dir = path.join(root, 'shots', id);
  await fs.mkdir(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) await fs.writeFile(path.join(dir, name), text, 'utf-8');
  return dir;
}

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-in-place-'));
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('bundleShotInPlace', () => {
  it('lands a chroma-js shot as v2 in the same folder, keeps v1 and the original, and the result passes the lint', async () => {
    const source = [
      "import React from 'react';",
      "import chroma from 'chroma-js';",
      CONFIG,
      "export default () => <div style={{ color: chroma('#e86a55').darken().hex() }}>A</div>;",
    ].join('\n');
    const dir = await shotFolder('chroma-card', { 'v1.tsx': source });
    const outcome = await bundleShotInPlace({ projectId: 'p', folderPath: dir, version: 1, source });

    expect(outcome).toMatchObject({ ok: true, version: 2, assetRefs: {}, report: { inlinedPackages: ['chroma-js'] } });
    const v2 = await fs.readFile(path.join(dir, 'v2.tsx'), 'utf-8');
    expect(outcome.ok && outcome.code).toBe(v2);
    expect(lintShotSource(v2).errors).toEqual([]);
    expect(await fs.readFile(path.join(dir, 'v1.tsx'), 'utf-8')).toBe(source);
    expect(await fs.readFile(path.join(dir, 'original.tsx'), 'utf-8')).toBe(source);
  }, 30_000);

  it('registers the media its staticFile() calls find beside it, and reports the missing ones', async () => {
    const source = [
      "import React from 'react';",
      "import { Img, staticFile } from 'remotion';",
      "import chroma from 'chroma-js';",
      CONFIG,
      "export default () => <div style={{ color: chroma('red').hex() }}><Img src={staticFile('pic.png')} /><Img src={staticFile('gone.png')} /></div>;",
    ].join('\n');
    const dir = await shotFolder('with-media', { 'v3.tsx': source, 'pic.png': 'png' });
    media.registered.length = 0;
    const outcome = await bundleShotInPlace({ projectId: 'p', folderPath: dir, version: 3, source });

    expect(outcome).toMatchObject({ ok: true, version: 4, assetRefs: { pic: 'asset-1' }, report: { media: 1, missingMedia: ['gone.png'] } });
    expect(media.registered).toEqual([[path.join(dir, 'pic.png')]]);
  }, 30_000);

  it('writes nothing for a source the bundler refuses (tone), and says why', async () => {
    const source = `import * as Tone from 'tone';\n${CONFIG}\nexport default () => { void Tone; return null; };`;
    const dir = await shotFolder('tone-beat', { 'v1.tsx': source });
    const outcome = await bundleShotInPlace({ projectId: 'p', folderPath: dir, version: 1, source });

    expect(outcome).toEqual({ ok: false, reason: expect.stringMatching(/Package "tone" is not available to shots/) });
    expect((await fs.readdir(dir)).sort()).toEqual(['v1.tsx']);
  });

  it('writes nothing when the bundled file still fails the gate (no compositionConfig)', async () => {
    const source = "import chroma from 'chroma-js';\nexport default () => chroma('red').hex();";
    const dir = await shotFolder('no-config', { 'v1.tsx': source });
    const outcome = await bundleShotInPlace({ projectId: 'p', folderPath: dir, version: 1, source });

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toMatch(/still fails the shot gate|compositionConfig/);
    expect((await fs.readdir(dir)).sort()).toEqual(['v1.tsx']);
  }, 30_000);
});

describe('keepOriginal', () => {
  it('keeps the first original: a later pass does not overwrite it', async () => {
    const dir = await shotFolder('twice', {});
    await keepOriginal(dir, 'first');
    await keepOriginal(dir, 'second');
    expect(await fs.readFile(path.join(dir, 'original.tsx'), 'utf-8')).toBe('first');
  });
});
