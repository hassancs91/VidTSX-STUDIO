import { describe, expect, it } from 'vitest';
import type { AssetEntry } from '../types';
import { moduleAssetUrl, selectedAssetUrls } from './asset-urls';

const SERVER = 'http://127.0.0.1:5199';
const file = (path: string, category: AssetEntry['category'], ext: string): AssetEntry => ({
  node: { id: path, name: path.split(/[\\/]/).pop() ?? path, type: 'file', path, mtimeMs: 0 },
  category,
  ext,
});

describe('moduleAssetUrl', () => {
  it("builds the module server's /asset URL with the path encoded", () => {
    expect(moduleAssetUrl(SERVER, 'C:\\lib\\sfx\\whoosh soft.mp3')).toBe(
      `${SERVER}/asset?path=C%3A%5Clib%5Csfx%5Cwhoosh%20soft.mp3`
    );
  });

  it('no server URL → null (the caller shows its quiet fallback)', () => {
    expect(moduleAssetUrl(null, 'C:\\lib\\a.mp3')).toBeNull();
  });
});

describe('selectedAssetUrls', () => {
  it('an audio entry gets an audio URL only', () => {
    expect(selectedAssetUrls(file('C:\\lib\\a.mp3', 'audio', '.mp3'), SERVER)).toEqual({
      image: null,
      glb: null,
      audio: `${SERVER}/asset?path=C%3A%5Clib%5Ca.mp3`,
    });
  });

  it('an image gets an image URL; a .glb a viewer URL; a .gltf none', () => {
    expect(selectedAssetUrls(file('/l/a.png', 'image', '.png'), SERVER).image).toBe(`${SERVER}/asset?path=%2Fl%2Fa.png`);
    expect(selectedAssetUrls(file('/l/m.GLB', 'model3d', '.GLB'), SERVER).glb).toBe(`${SERVER}/asset?path=%2Fl%2Fm.GLB`);
    expect(selectedAssetUrls(file('/l/m.gltf', 'model3d', '.gltf'), SERVER).glb).toBeNull();
  });

  it('no entry, a video, or no server → all null', () => {
    const none = { image: null, glb: null, audio: null };
    expect(selectedAssetUrls(undefined, SERVER)).toEqual(none);
    expect(selectedAssetUrls(file('/l/v.mp4', 'video', '.mp4'), SERVER)).toEqual(none);
    expect(selectedAssetUrls(file('/l/a.mp3', 'audio', '.mp3'), null)).toEqual(none);
  });
});
