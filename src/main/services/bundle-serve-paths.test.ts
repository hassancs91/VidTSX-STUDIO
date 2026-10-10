import { describe, expect, it } from 'vitest';
import {
  BUNDLE_ID_VERSION,
  BUNDLE_ROUTE,
  bundleIdFromUrl,
  bundleIdPrefix,
  bundlePublicPath,
  bundleServeUrl,
  isBundleId,
  makeBundleId,
} from './bundle-serve-paths';

const HASH = '0123456789abcdef0123456789abcdef';

describe('bundle ids', () => {
  it('names a bundle by layout version, 8 hash chars and a timestamp', () => {
    expect(makeBundleId(HASH, 1700000000000)).toBe(`${BUNDLE_ID_VERSION}-01234567-1700000000000`);
    expect(bundleIdPrefix(HASH)).toBe(`${BUNDLE_ID_VERSION}-01234567-`);
    expect(makeBundleId(HASH, 5).startsWith(bundleIdPrefix(HASH))).toBe(true);
  });

  it('accepts only ids of this layout version', () => {
    expect(isBundleId(makeBundleId(HASH))).toBe(true);
    // The pre-change layout (publicPath "/") must never be served under a sub-path.
    expect(isBundleId('bundle-01234567-1700000000000')).toBe(false);
    expect(isBundleId('v1-01234567-1700000000000')).toBe(false);
    // Nothing that could leave the cache dir.
    expect(isBundleId('..')).toBe(false);
    expect(isBundleId(`${BUNDLE_ID_VERSION}-01234567-1/..`)).toBe(false);
    expect(isBundleId(`${BUNDLE_ID_VERSION}-0123456-1`)).toBe(false);
    expect(isBundleId(`${BUNDLE_ID_VERSION}-0123456G-1`)).toBe(false);
    expect(isBundleId('')).toBe(false);
  });
});

describe('bundle paths and urls', () => {
  const id = makeBundleId(HASH, 42);

  it('builds with a publicPath that ends in a slash, inside the bundle route', () => {
    expect(bundlePublicPath(id)).toBe(`${BUNDLE_ROUTE}/${id}/`);
  });

  it('serves without a trailing slash so Remotion and the preview iframe both append cleanly', () => {
    const url = bundleServeUrl('http://127.0.0.1:3100', id);
    expect(url).toBe(`http://127.0.0.1:3100${BUNDLE_ROUTE}/${id}`);
    expect(bundleServeUrl('http://127.0.0.1:3100/', id)).toBe(url);
    // What @remotion/renderer's normalizeServeUrl and the preview build from it.
    expect(`${url}/index.html`).toBe(`http://127.0.0.1:3100${bundlePublicPath(id)}index.html`);
    expect(`${url}/#/main`).toBe(`http://127.0.0.1:3100${bundlePublicPath(id)}#/main`);
  });

  it('is the same url for the same bundle every time (a cache hit keeps its path)', () => {
    expect(bundleServeUrl('http://127.0.0.1:3100', id)).toBe(bundleServeUrl('http://127.0.0.1:3100', id));
    expect(bundleServeUrl('http://127.0.0.1:3100', makeBundleId(HASH, 43))).not.toBe(
      bundleServeUrl('http://127.0.0.1:3100', id),
    );
  });

  it('reads the id back from a serveUrl and from any url under it', () => {
    const url = bundleServeUrl('http://127.0.0.1:3100', id);
    expect(bundleIdFromUrl(url)).toBe(id);
    expect(bundleIdFromUrl(`${url}/index.html?x=1`)).toBe(id);
    expect(bundleIdFromUrl(`${url}/bundle.js.map`)).toBe(id);
    expect(bundleIdFromUrl('http://127.0.0.1:3100')).toBeNull();
    expect(bundleIdFromUrl('http://127.0.0.1:3100/asset?path=x')).toBeNull();
    expect(bundleIdFromUrl('http://127.0.0.1:3100/bundles/bundle-01234567-1/index.html')).toBeNull();
    expect(bundleIdFromUrl('not a url')).toBeNull();
  });
});
