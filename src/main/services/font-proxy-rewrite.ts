/**
 * Pure URL/CSS rewriting for the Google Fonts proxy.
 *
 * Split out of `font-proxy.ts` so it can be unit-tested without pulling in
 * electron (`../utils/paths`) or express.
 */

/** Hosts the proxy is allowed to fetch from. */
export const FONT_PROXY_HOSTS = ['fonts.gstatic.com', 'fonts.googleapis.com'] as const;

/** A Google Fonts URL as a quoted string literal in code. */
const CODE_URL = /(["'])(https:\/\/fonts\.(?:gstatic|googleapis)\.com\/[^"'\s]+)\1/g;

/** `url(x)` / `url('x')` / `url("x")` inside a stylesheet body. */
const CSS_URL = /url\(\s*(["']?)(https:\/\/fonts\.(?:gstatic|googleapis)\.com\/[^)"'\s]+)\1\s*\)/g;

/** A bare `@import "x"` inside a stylesheet body. */
const CSS_IMPORT = /(@import\s+)(["'])(https:\/\/fonts\.(?:gstatic|googleapis)\.com\/[^"'\s]+)\2/g;

/**
 * Rewrite Google Fonts URLs in source code (TSX or transpiled JS) to point at
 * our local proxy. Operates on string literals only — anything matching the
 * allowed host list and wrapped in single or double quotes.
 *
 * Safe to run on raw TSX *and* on esbuild output: we preserve quote style and
 * only touch the URL inside the quotes.
 *
 * A CSS `@import url('https://fonts.googleapis.com/css2?...')` written inside a
 * template literal is a quoted literal too, so it is covered here — but the
 * stylesheet the proxy then serves has its own *unquoted* `url(...)` references
 * to `.woff2` files, which is what `rewriteCssFontUrls` below exists for.
 */
export function rewriteFontUrls(code: string, baseUrl: string): string {
  return code.replace(
    CODE_URL,
    (_match, quote: string, url: string) => `${quote}${proxyUrl(url, baseUrl)}${quote}`,
  );
}

/**
 * Rewrite the font references inside a Google Fonts *stylesheet body* so they
 * come back through the proxy as well.
 *
 * A `css2` response is a list of `@font-face` blocks whose `src:` lines hold
 * **unquoted** `url(https://fonts.gstatic.com/…woff2)`. Those are invisible to
 * `rewriteFontUrls` (it only sees quoted literals in code), so without this the
 * browser fetches every actual font file straight from gstatic: fine online,
 * broken offline — and offline is the whole point of the cache.
 *
 * `baseUrl` may be empty, in which case the rewritten reference is
 * root-relative (`/fonts?u=…`), which resolves against the origin the
 * stylesheet itself was served from — always this same server.
 */
export function rewriteCssFontUrls(css: string, baseUrl = ''): string {
  return css
    .replace(
      CSS_URL,
      (_match, quote: string, url: string) => `url(${quote}${proxyUrl(url, baseUrl)}${quote})`,
    )
    .replace(
      CSS_IMPORT,
      (_match, keyword: string, quote: string, url: string) =>
        `${keyword}${quote}${proxyUrl(url, baseUrl)}${quote}`,
    );
}

/**
 * Cache-file extension for an upstream URL, which also decides the
 * `Content-Type` the proxy replies with.
 *
 * `fonts.googleapis.com` serves stylesheets from extension-less paths
 * (`/css`, `/css2`, `/icon`). Without this they were cached as `.bin` and
 * served as `application/octet-stream`, which a browser refuses to apply as a
 * stylesheet — so an `@import` through the proxy failed outright rather than
 * merely leaking the `.woff2` fetches.
 */
export function fontCacheExtensionFor(url: URL): string {
  const ext = /\.[a-z0-9]+$/i.exec(url.pathname)?.[0].toLowerCase() ?? '';
  if (/^\.(woff2?|ttf|otf|css)$/.test(ext)) return ext;
  if (url.host === 'fonts.googleapis.com') return '.css';
  return '.bin';
}

function proxyUrl(url: string, baseUrl: string): string {
  return `${baseUrl}/fonts?u=${encodeURIComponent(url)}`;
}
