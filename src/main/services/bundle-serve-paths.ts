// Where a webpack bundle lives on the bundle server (remotion-bundler.ts).
//
// Every bundle is served under its own path, `/bundles/<bundleId>`, and is
// built with that path as Remotion's `publicPath`, so its index.html,
// bundle.js, source map and staticFile() URLs all point inside it. Two
// bundles can be served at once: a build's stills, a Refine and an export no
// longer swap each other's bundle from under a Chromium that is still loading
// it (P0 served ONE bundle at the server root). `/asset` and `/fonts` stay at
// the root; they are per-server, not per-bundle.
//
// The id carries a layout version. Bundles made before per-path serving were
// built with publicPath `/`, so their index.html asks for `/bundle.js`; served
// under a sub-path they would 404. Their folders are named `bundle-*` and can
// never match `isBundleId`, so the server never serves them.

export const BUNDLE_ROUTE = '/bundles';

/** Bump when the on-disk bundle layout changes; older folders are never served. */
export const BUNDLE_ID_VERSION = 'v2';

const HASH_CHARS = 8;
const BUNDLE_ID_RE = new RegExp(`^${BUNDLE_ID_VERSION}-[0-9a-f]{${HASH_CHARS}}-\\d+$`);

/** `v2-<hash8>-<ms>`: the bundle's folder name inside the cache dir and its URL segment. */
export function makeBundleId(contentHash: string, now: number = Date.now()): string {
  return `${bundleIdPrefix(contentHash)}${now}`;
}

/** What every bundle id for this content starts with (the cancel probe looks for leftovers). */
export function bundleIdPrefix(contentHash: string): string {
  return `${BUNDLE_ID_VERSION}-${contentHash.slice(0, HASH_CHARS)}-`;
}

/** True for an id this layout version made; a client-supplied segment is checked with this before it touches the disk. */
export function isBundleId(value: string): boolean {
  return BUNDLE_ID_RE.test(value);
}

/** Remotion's `publicPath` for the bundle: where its index.html finds bundle.js, and the staticFile() root. */
export function bundlePublicPath(bundleId: string): string {
  return `${BUNDLE_ROUTE}/${bundleId}/`;
}

/**
 * The serveUrl a caller hands on, without a trailing slash: Remotion's
 * renderer appends `/index.html` and `bundle.js.map` beside it, the Creator's
 * preview iframe appends `/#/<compositionId>`.
 */
export function bundleServeUrl(origin: string, bundleId: string): string {
  return `${origin.replace(/\/+$/, '')}${BUNDLE_ROUTE}/${bundleId}`;
}

/** The bundle id a serveUrl (or any URL under its path) names, or null when it is not one of ours. */
export function bundleIdFromUrl(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const prefix = `${BUNDLE_ROUTE}/`;
  if (!pathname.startsWith(prefix)) return null;
  const segment = pathname.slice(prefix.length).split('/')[0];
  return isBundleId(segment) ? segment : null;
}
