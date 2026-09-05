import { describe, expect, it } from 'vitest';
import { PYTHON_MODEL_CATALOG } from './registry';

/**
 * Model-file link sweep — network-dependent, SKIPPED unless CHECK_LINKS is set
 * (`npm run check:links`). Every catalogue file must answer 200 (HEAD, redirects
 * followed — HF resolves to a CDN) and, when the host reports it, a Content-Length
 * equal to the catalogue's `bytes`.
 */
const RUN_SWEEP = Boolean(process.env.CHECK_LINKS);
const FETCH_TIMEOUT_MS = 30_000;

async function head(url: string): Promise<{ status: number; length: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (res.status === 405 || res.status === 403) {
      // Some hosts refuse HEAD; a ranged GET answers with the size in Content-Range.
      res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: controller.signal });
      const range = res.headers.get('content-range');
      const m = range ? /\/(\d+)$/.exec(range) : null;
      return { status: res.status === 206 ? 200 : res.status, length: m ? Number.parseInt(m[1], 10) : null };
    }
    const raw = res.headers.get('content-length');
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return { status: res.status, length: Number.isFinite(n) ? n : null };
  } finally {
    clearTimeout(timer);
  }
}

describe.skipIf(!RUN_SWEEP)('Python model catalogue links (CHECK_LINKS)', () => {
  for (const profile of PYTHON_MODEL_CATALOG) {
    for (const file of profile.files) {
      it(`${profile.id}: ${file.dest} ← ${file.url}`, async () => {
        const r = await head(file.url);
        expect(r.status).toBe(200);
        if (r.length !== null) expect(r.length).toBe(file.bytes);
      }, FETCH_TIMEOUT_MS + 5_000);
    }
  }
});
