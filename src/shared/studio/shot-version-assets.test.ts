import { describe, expect, it } from 'vitest';
import { mergeVersionAssets } from './shot-version-assets';

describe('mergeVersionAssets', () => {
  it("puts the version's files under the props, the shot's assetRefs winning for the same key", () => {
    const props = { assets: { logo: 'http://a/asset?path=logo.png' } };
    const files = { logo: 'http://a/asset-root/t/logo.png', avocado: 'http://a/asset-root/t/avocado.glb' };
    expect(mergeVersionAssets(props, files)).toEqual({
      assets: { logo: 'http://a/asset?path=logo.png', avocado: 'http://a/asset-root/t/avocado.glb' },
    });
    // The serializer's object is not changed.
    expect(props).toEqual({ assets: { logo: 'http://a/asset?path=logo.png' } });
  });

  it('gives props to a clip that had none, and keeps other props', () => {
    expect(mergeVersionAssets(undefined, { avocado: 'u' })).toEqual({ assets: { avocado: 'u' } });
    const captions = { words: [], style: {} } as never;
    expect(mergeVersionAssets({ captions }, { avocado: 'u' })).toEqual({ captions, assets: { avocado: 'u' } });
  });

  it('returns the props themselves when there are no files', () => {
    const props = { assets: { logo: 'x' } };
    expect(mergeVersionAssets(props, undefined)).toBe(props);
    expect(mergeVersionAssets(props, null)).toBe(props);
    expect(mergeVersionAssets(props, {})).toBe(props);
    expect(mergeVersionAssets(undefined, {})).toBeUndefined();
  });
});
