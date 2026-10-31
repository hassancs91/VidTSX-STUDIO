import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let cacheDir = '';
const upstream = { blocked: false };

vi.mock('../utils/paths', () => ({
  getFontCacheDir: () => cacheDir,
  ensureFontCacheDir: async () => {
    await fs.mkdir(cacheDir, { recursive: true });
  },
}));
vi.mock('./font-upstream-dev-overrides', () => ({ isFontUpstreamBlocked: () => upstream.blocked }));
vi.mock('../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }) },
}));

import { ensureFontCached } from './font-proxy';

const CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700';
const A = 'https://fonts.gstatic.com/s/inter/v20/A.woff2';
const B = 'https://fonts.gstatic.com/s/inter/v20/B.woff2';
const BODY = `@font-face { src: url(${A}) format('woff2'); }\n@font-face { src: url(${B}) format('woff2'); }`;

const fetched: string[] = [];
let missing = new Set<string>();

beforeAll(async () => {
  cacheDir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'font-proxy-')), 'font-cache');
});

beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    fetched.push(url);
    if (missing.has(url)) return new Response('nope', { status: 404 });
    return new Response(url === CSS ? BODY : `font:${url}`, { status: 200 });
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  fetched.length = 0;
  missing = new Set();
  upstream.blocked = false;
  await fs.rm(cacheDir, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.rm(path.dirname(cacheDir), { recursive: true, force: true });
});

describe('ensureFontCached (the export preflight warm-up)', () => {
  it('caches a stylesheet and every file it lists; a second pass touches no network', async () => {
    expect(await ensureFontCached(CSS)).toEqual({ fetched: 3, cached: 0 });
    expect(fetched).toEqual([CSS, A, B]);
    expect(await fs.readdir(cacheDir)).toHaveLength(3);

    fetched.length = 0;
    upstream.blocked = true;
    expect(await ensureFontCached(CSS)).toEqual({ fetched: 0, cached: 3 });
    expect(await ensureFontCached(A)).toEqual({ fetched: 0, cached: 1 });
    expect(fetched).toEqual([]);
  });

  it('throws when any file of the stylesheet cannot be had (no skipping, unlike warmFontCache)', async () => {
    missing = new Set([B]);
    await expect(ensureFontCached(CSS)).rejects.toThrow(`Upstream 404 for ${B}`);
  });

  it('one blip mid-download (undici `terminated`) is retried once and the file is cached', async () => {
    let failedOnce = false;
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url);
      if (url === B && !failedOnce) {
        failedOnce = true;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(new TypeError('terminated'));
          },
        });
        return new Response(body, { status: 200 });
      }
      return new Response(url === CSS ? BODY : `font:${url}`, { status: 200 });
    });
    expect(await ensureFontCached(CSS)).toEqual({ fetched: 3, cached: 0 });
    expect(fetched).toEqual([CSS, A, B, B]);
    expect((await fs.readdir(cacheDir)).filter((f) => !f.endsWith('.tmp'))).toHaveLength(3);
  });

  it('a 404 is not retried', async () => {
    missing = new Set([A]);
    await expect(ensureFontCached(A)).rejects.toThrow(`Upstream 404 for ${A}`);
    expect(fetched).toEqual([A]);
  });

  it('throws on a cold cache when the upstream is blocked, without fetching', async () => {
    upstream.blocked = true;
    await expect(ensureFontCached(A)).rejects.toThrow('Upstream blocked (dev override)');
    expect(fetched).toEqual([]);
  });

  it('refuses hosts outside Google Fonts', async () => {
    await expect(ensureFontCached('https://evil.example.com/x.woff2')).rejects.toThrow('Host not allowed');
  });
});
