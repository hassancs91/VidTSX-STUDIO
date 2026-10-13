import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { versionAssetFiles, versionAssetsProp, withVersionAssets } from './version-assets';
import { clearAssetRoots, registerAssetRoot } from '../asset-roots';

let folder = '';

async function put(rel: string, content = 'x'): Promise<void> {
  const file = path.join(folder, ...rel.split('/'));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

const code = (...names: string[]) => names.map((n, i) => `const a${i} = __vidtsxAsset("${n}");`).join('\n');

beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), 'version-assets-'));
});
afterEach(async () => {
  clearAssetRoots();
  await fs.rm(folder, { recursive: true, force: true });
});

describe('versionAssetFiles', () => {
  it('finds names in the version folder first, then in earlier versions, newest first', async () => {
    await put('v1.assets/robot.glb');
    await put('v1.assets/old.png');
    await put('v2.assets/robot.glb');
    await put('v3.tsx', code('robot.glb', 'old.png', 'gone.hdr'));
    const files = await versionAssetFiles(path.join(folder, 'v3.tsx'));
    expect(files.map((f) => [f.key, f.dir && path.basename(f.dir), f.kind])).toEqual([
      ['robot', 'v2.assets', 'model'],
      ['old', 'v1.assets', 'image'],
      ['gone', null, 'environment'],
    ]);
  });

  it('never looks in a later version, and is empty for code that names no files', async () => {
    await put('v4.assets/robot.glb');
    await put('v2.tsx', code('robot.glb'));
    expect((await versionAssetFiles(path.join(folder, 'v2.tsx')))[0].path).toBeNull();
    await put('v5.tsx', 'export default () => null;');
    expect(await versionAssetFiles(path.join(folder, 'v5.tsx'))).toEqual([]);
  });
});

describe('versionAssetsProp / withVersionAssets', () => {
  it('maps found files to URLs on the server and leaves out what no folder has', async () => {
    await put('v1.assets/robot.glb');
    await put('v1.tsx', code('robot.glb', 'gone.png'));
    const token = registerAssetRoot(path.join(folder, 'v1.assets'));
    const tsx = path.join(folder, 'v1.tsx');
    expect(await versionAssetsProp(tsx, 'http://127.0.0.1:3200')).toEqual({
      robot: `http://127.0.0.1:3200/asset-root/${token}/robot.glb`,
    });
    expect(await withVersionAssets(tsx, 'http://127.0.0.1:3000', { title: 'Hi', assets: { robot: 'http://dead:1/x', logo: 'u' } })).toEqual({
      title: 'Hi',
      assets: { robot: `http://127.0.0.1:3000/asset-root/${token}/robot.glb`, logo: 'u' },
    });
    expect(await withVersionAssets(tsx, null, { title: 'Hi' })).toEqual({ title: 'Hi' });
  });
});
