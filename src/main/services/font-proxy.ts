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
import {
  FONT_PROXY_HOSTS,
  fontCacheExtensionFor,
  rewriteCssFontUrls,
} from './font-proxy-rewrite';

export { rewriteFontUrls, rewriteCssFontUrls } from './font-proxy-rewrite';

const log = logEngine.createLogger('FontProxy');

const ALLOWED_HOSTS = new Set<string>(FONT_PROXY_HOSTS);

// In-flight fetches keyed by cache filename — stops parallel requests from
// each downloading the same font and racing to write the same file.
const inflight = new Map<string, Promise<void>>();

function cacheFilenameFor(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  // Only a small set of font/css extensions ever reaches the filename; a
  // googleapis path with no extension is a stylesheet.
  return `${hash}${fontCacheExtensionFor(new URL(url))}`;
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
    if (filename.endsWith('.css')) {
      // A stylesheet's own `url(...)` references are unquoted, so the code-level
      // rewrite never saw them. Rewrite them on the way out, against the origin
      // this request arrived on, so the .woff2 files come back through here too
      // and an offline render is served entirely from the cache.
      const css = await fs.readFile(cachePath, 'utf-8');
      res.send(rewriteCssFontUrls(css, requestOrigin(req)));
      return;
    }
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
 * The origin this request arrived on (`http://127.0.0.1:5173`), used as the base
 * for rewritten stylesheet references so they stay same-origin with the
 * stylesheet itself. Falls back to `''` — a root-relative `/fonts?u=...`, which
 * resolves the same way — if the request carried no Host header.
 */
function requestOrigin(req: Request): string {
  const host = req.get('host');
  return host ? `${req.protocol}://${host}` : '';
}

/**
 * Register the font proxy route on an Express app.
 */
export function registerFontProxy(app: express.Express): void {
  app.get('/fonts', handleFontProxy);
}
