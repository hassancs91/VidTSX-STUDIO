import { afterEach, describe, expect, it } from 'vitest';
import path from 'path';
import { assetRootUrl, clearAssetRoots, registerAssetRoot, resolveAssetRootRequest } from './asset-roots';

const root = path.resolve('/tmp/proj/v3.assets');

afterEach(() => clearAssetRoots());

describe('asset roots', () => {
  it('gives a folder one stable token and a path URL ending in the file name', () => {
    const token = registerAssetRoot(root);
    expect(registerAssetRoot(root)).toBe(token);
    expect(assetRootUrl('http://127.0.0.1:3200/', root, 'models/robot arm.glb')).toBe(
      `http://127.0.0.1:3200/asset-root/${token}/models/robot%20arm.glb`,
    );
  });

  it('serves a registered file and nothing outside the folder or of another kind', () => {
    const token = registerAssetRoot(root);
    expect(resolveAssetRootRequest(token, 'models/robot.glb')).toEqual({ file: path.join(root, 'models', 'robot.glb') });
    expect(resolveAssetRootRequest(token, 'scene.bin')).toEqual({ file: path.join(root, 'scene.bin') });
    expect(resolveAssetRootRequest(token, '../v2.src/index.tsx')).toMatchObject({ status: 400 });
    expect(resolveAssetRootRequest(token, '../../secrets.json')).toMatchObject({ status: 400 });
    expect(resolveAssetRootRequest(token, 'payload.js')).toMatchObject({ status: 400, error: 'Invalid file type' });
    expect(resolveAssetRootRequest('0000000000000000', 'robot.glb')).toMatchObject({ status: 404 });
  });
});
