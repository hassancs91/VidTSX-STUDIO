/**
 * Local proxy + on-disk cache for Google Fonts (fonts.gstatic.com,
 * fonts.googleapis.com).
 *
 * Why: drei's <Text> in `<ThreeCanvas>` fetches font files from inside a Web
 * Worker. In the Electron preview webview that fetch can be blocked, stalled,
 * or hit by CSP — when it does, the entire scene goes blank because
 * @remotion/three's single Suspense boundary swaps the tree for `null` while
 * <Text> is suspended.
 *
 * What this does: gives every Google Fonts URL a stable local URL on the
 * module server. First request fetches and caches to disk; subsequent
 * requests (and offline runs) serve from the cache.
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { logEngine } from '../../logging/log-engine';
import { getFontCacheDir, ensureFontCacheDir } from '../utils/paths';

const log = logEngine.createLogger('FontProxy');

const ALLOWED_HOSTS = new Set([
  'fonts.gstatic.com',
  'fonts.googleapis.com',
]);

// In-flight fetches keyed by cache filename — stops parallel requests from
// each downloading the same font and racing to write the same file.
const inflight = new Map<string, Promise<void>>();

function cacheFilenameFor(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const ext = path.extname(new URL(url).pathname).toLowerCase() || '.bin';
  // Defensive: only allow a small set of font/css extensions in the filename.
  const safeExt = /^\.(woff2?|ttf|otf|css)$/.test(ext) ? ext : '.bin';
  return `${hash}${safeExt}`;
}

function contentTypeFor(filename: string): string {
  if (filename.endsWith('.woff2')) return 'font/woff2';
  if (filename.endsWith('.woff')) return 'font/woff';
  if (filename.endsWith('.ttf')) return 'font/ttf';
  if (filename.endsWith('.otf')) return 'font/otf';
  if (filename.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

async function fetchAndCache(url: string, cachePath: string): Promise<void> {
  const existing = inflight.get(cachePath);
  if (existing) return existing;

  const promise = (async () => {
    log.debug('Fetching font from upstream', { url });
    const resp = await fetch(url, {
      // gstatic.com sniffs user-agent for woff2 vs woff — Chrome UA gets woff2.
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!resp.ok) {
      throw new Error(`Upstream ${resp.status} for ${url}`);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    // Write atomically — write to .tmp then rename — so concurrent reads never
    // observe a partial file.
    const tmp = `${cachePath}.tmp`;
    await fs.writeFile(tmp, buf);
    await fs.rename(tmp, cachePath);
    log.debug('Cached font', { cachePath, bytes: buf.length });
  })();

  inflight.set(cachePath, promise);
  try {
    await promise;
  } finally {
    inflight.delete(cachePath);
  }
}

/**
 * Express handler for `/fonts?u=<encoded-google-fonts-url>`.
 *
 * Returns 400 if the URL is missing, malformed, or not in the allow-list.
 * Returns the cached file (fetching first if needed) on success.
 */
export async function handleFontProxy(req: Request, res: Response): Promise<void> {
  const raw = req.query.u;
  if (typeof raw !== 'string' || raw.length === 0) {
    res.status(400).type('text/plain').send('Missing ?u parameter');
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    res.status(400).type('text/plain').send('Invalid URL');
    return;
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.host)) {
    res.status(400).type('text/plain').send('Host not allowed');
    return;
  }

  await ensureFontCacheDir();
  const filename = cacheFilenameFor(raw);
  const cachePath = path.join(getFontCacheDir(), filename);

  try {
    if (!fsSync.existsSync(cachePath)) {
      await fetchAndCache(raw, cachePath);
    }
    // Long-lived cache — file content is immutable per URL hash.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', contentTypeFor(filename));
    res.sendFile(cachePath);
  } catch (err) {
    log.warn('Font proxy fetch failed', {
      url: raw,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(502).type('text/plain').send('Upstream fetch failed');
  }
}

/**
 * Rewrite Google Fonts URLs in source code (TSX or transpiled JS) to point at
 * our local proxy. Operates on string literals only — anything matching the
 * allowed host list and wrapped in single or double quotes.
 *
 * Safe to run on raw TSX *and* on esbuild output: we preserve quote style and
 * only touch the URL inside the quotes.
 */
export function rewriteFontUrls(code: string, baseUrl: string): string {
  return code.replace(
    /(["'])(https:\/\/fonts\.(?:gstatic|googleapis)\.com\/[^"'\s]+)\1/g,
    (_match, quote: string, url: string) => {
      return `${quote}${baseUrl}/fonts?u=${encodeURIComponent(url)}${quote}`;
    },
  );
}

/**
 * Register the font proxy route on an Express app.
 */
export function registerFontProxy(app: express.Express): void {
  app.get('/fonts', handleFontProxy);
}
