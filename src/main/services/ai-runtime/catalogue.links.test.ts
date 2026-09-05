import { describe, expect, it } from 'vitest';
import { AI_RUNTIME_CATALOGUE, AI_RUNTIME_VARIANTS } from './catalogue';

/**
 * Runtime zip link sweep — network-dependent, SKIPPED unless CHECK_LINKS is set
 * (`npm run check:links`). Every URL must answer HEAD 200 with a Content-Length equal to
 * the catalogue's `bytes`: unlike model files, we host these ourselves, so any drift is a
 * release blocker, not a warning.
 */
const RUN_SWEEP = Boolean(process.env.CHECK_LINKS);
const FETCH_TIMEOUT_MS = 30_000;

async function head(url: string): Promise<{ status: number; length: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    const raw = res.headers.get('content-length');
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return { status: res.status, length: Number.isFinite(n) ? n : null };
  } finally {
    clearTimeout(timer);
  }
}

describe.skipIf(!RUN_SWEEP)('AI runtime catalogue links (CHECK_LINKS)', () => {
  for (const variant of AI_RUNTIME_VARIANTS) {
    const entry = AI_RUNTIME_CATALOGUE[variant];
    for (const url of entry.urls) {
      it(`${variant}: ${url} is live and ${entry.bytes} bytes`, async () => {
        const r = await head(url);
        expect(r.status).toBe(200);
        expect(r.length).toBe(entry.bytes);
      }, FETCH_TIMEOUT_MS + 5_000);
    }
  }
});
