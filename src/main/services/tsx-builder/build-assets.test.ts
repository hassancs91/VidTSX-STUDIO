import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { assetRefsInArtifact, assetsProp, lintAssetFile, listAssetFiles, resolveBuildAssets } from './build-assets';
import { clearAssetRoots, registerAssetRoot } from '../asset-roots';

let dir = '';

async function put(rel: string, content: string | Buffer): Promise<void> {
  const file = path.join(dir, ...rel.split('/'));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

/** A minimal binary glTF: header + one JSON chunk. */
function glb(json: Record<string, unknown>): Buffer {
  let text = JSON.stringify({ asset: { version: '2.0' }, ...json });
  while (text.length % 4 !== 0) text += ' ';
  const chunk = Buffer.from(text, 'utf-8');
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + chunk.length, 8);
  head.writeUInt32LE(chunk.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, chunk]);
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-assets-'));
});
afterEach(async () => {
  clearAssetRoots();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('resolveBuildAssets', () => {
  it('resolves each name inside assets/ to its key, kind and size', async () => {
    await put('robot.glb', glb({ extensionsUsed: ['EXT_meshopt_compression'] }));
    await put('hdri/studio.hdr', '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n');
    await put('photo.jpg', 'jpg');
    const { assets, errors } = await resolveBuildAssets(dir, ['robot.glb', 'hdri/studio.hdr', '/photo.jpg', 'robot.glb']);
    expect(errors).toEqual([]);
    expect(assets.map((a) => [a.key, a.relPath, a.kind])).toEqual([
      ['robot', 'robot.glb', 'model'],
      ['hdri_studio', 'hdri/studio.hdr', 'environment'],
      ['photo', 'photo.jpg', 'image'],
    ]);
  });

  it('names a missing file, lists the folder, and hints at a stray assets/ prefix', async () => {
    await put('logo.png', 'png');
    const { errors } = await resolveBuildAssets(dir, ['assets/logo.png', 'nope.png']);
    expect(errors[0]).toContain(`Drop the "assets/" prefix: staticFile('logo.png')`);
    expect(errors[1]).toContain('assets/nope.png does not exist');
    expect(errors[1]).toContain('assets/ holds: logo.png');
  });

  it('refuses a path out of the folder, an unserved kind, a key clash and a computed name', async () => {
    await put('logo.png', 'png');
    await put('logo.svg', '<svg/>');
    await put('run.js', 'x');
    const { errors } = await resolveBuildAssets(dir, ['../index.tsx', 'run.js', 'logo.png', 'logo.svg'], 2);
    expect(errors.join('\n')).toContain('2 call(s) build the name at run time');
    expect(errors.join('\n')).toContain("staticFile('../index.tsx'): name a file by its path INSIDE assets/");
    expect(errors.join('\n')).toContain('.js is not a kind the renderer serves');
    expect(errors.join('\n')).toContain('look up the same key "logo"');
  });
});

describe('lintAssetFile', () => {
  it('refuses Draco and KTX2 models, which need decoders from the network', async () => {
    await put('draco.glb', glb({ extensionsRequired: ['KHR_draco_mesh_compression'] }));
    await put('ktx.glb', glb({ extensionsUsed: ['KHR_texture_basisu'] }));
    expect(await lintAssetFile(dir, 'draco.glb')).toContain('Draco');
    expect(await lintAssetFile(dir, 'ktx.glb')).toContain('KTX2');
  });

  it('wants a .gltf with its files beside it and only relative URIs', async () => {
    await put('a/scene.gltf', JSON.stringify({ buffers: [{ uri: 'scene.bin' }], images: [{ uri: 'data:image/png;base64,AA' }] }));
    expect(await lintAssetFile(dir, 'a/scene.gltf')).toContain('"scene.bin" is missing');
    await put('a/scene.bin', 'bin');
    expect(await lintAssetFile(dir, 'a/scene.gltf')).toBeNull();
    await put('b.gltf', JSON.stringify({ images: [{ uri: 'https://cdn.example.com/t.png' }] }));
    expect(await lintAssetFile(dir, 'b.gltf')).toContain('not a file beside it');
  });

  it('checks the magic of .hdr, .exr and .glb', async () => {
    await put('fake.hdr', 'PNG');
    await put('fake.exr', 'PNG!');
    await put('fake.glb', 'not a glb at all......');
    expect(await lintAssetFile(dir, 'fake.hdr')).toContain('not a Radiance .hdr');
    expect(await lintAssetFile(dir, 'fake.exr')).toContain('not an OpenEXR');
    expect(await lintAssetFile(dir, 'fake.glb')).toContain('no "glTF" magic');
  });
});

describe('artifact names and the assets prop', () => {
  it('reads the names a bundled version looks up', () => {
    const code = [
      'const __vidtsxAsset = (p) => { return p; };',
      'const M = __vidtsxAsset("models/robot.glb");',
      "const H = __vidtsxAsset('studio.hdr');",
    ].join('\n');
    expect(assetRefsInArtifact(code)).toEqual({ models_robot: 'models/robot.glb', studio: 'studio.hdr' });
  });

  it('maps each key to its URL on the given server', () => {
    const token = registerAssetRoot(dir);
    expect(assetsProp('http://localhost:9000', dir, { robot: 'robot.glb' })).toEqual({
      robot: `http://localhost:9000/asset-root/${token}/robot.glb`,
    });
  });

  it('lists the folder with kinds and sizes, empty when it does not exist', async () => {
    expect(await listAssetFiles(path.join(dir, 'missing'))).toEqual([]);
    await put('b/x.ttf', 'ttf');
    await put('a.json', '{}');
    expect(await listAssetFiles(dir)).toEqual([
      { relPath: 'a.json', kind: 'data', bytes: 2 },
      { relPath: 'b/x.ttf', kind: 'font', bytes: 3 },
    ]);
  });
});
