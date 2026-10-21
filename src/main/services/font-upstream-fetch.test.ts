import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const warnings: string[] = [];
vi.mock('../../logging/log-engine', () => ({
  logEngine: {
    createLogger: () => ({
      debug: () => {},
      info: () => {},
      warn: (msg: string) => warnings.push(msg),
      error: () => {},
    }),
  },
}));

import { FontUpstreamStatusError, fetchFontBytes, isTransientFontFetchError } from './font-upstream-fetch';

const URL_A = 'https://fonts.gstatic.com/s/inter/v20/A.woff2';

/** A response whose body dies mid-read, the way undici reports a dropped connection. */
function terminatedResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new TypeError('terminated'));
    },
  });
  return new Response(body, { status: 200 });
}

type Step = () => Response | Promise<Response>;
let steps: Step[] = [];
let calls = 0;

beforeEach(() => {
  vi.stubGlobal('fetch', async () => {
    const step = steps[calls++];
    if (!step) throw new Error('unexpected extra fetch');
    return step();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  steps = [];
  calls = 0;
  warnings.length = 0;
});

describe('isTransientFontFetchError', () => {
  it('is true for a network error and a 5xx, false for a 404 and other 4xx', () => {
    expect(isTransientFontFetchError(new TypeError('terminated'))).toBe(true);
    expect(isTransientFontFetchError(new TypeError('fetch failed'))).toBe(true);
    expect(isTransientFontFetchError(new FontUpstreamStatusError(503, URL_A))).toBe(true);
    expect(isTransientFontFetchError(new FontUpstreamStatusError(500, URL_A))).toBe(true);
    expect(isTransientFontFetchError(new FontUpstreamStatusError(404, URL_A))).toBe(false);
    expect(isTransientFontFetchError(new FontUpstreamStatusError(400, URL_A))).toBe(false);
    expect(isTransientFontFetchError(new FontUpstreamStatusError(429, URL_A))).toBe(false);
  });
});

describe('fetchFontBytes', () => {
  it('returns the bytes in one request when the upstream answers', async () => {
    steps = [() => new Response('font-bytes', { status: 200 })];
    expect((await fetchFontBytes(URL_A, { retryDelayMs: 0 })).toString()).toBe('font-bytes');
    expect(calls).toBe(1);
    expect(warnings).toEqual([]);
  });

  it('retries ONCE when the body read is terminated mid-download (the A4 verifier blip)', async () => {
    steps = [terminatedResponse, () => new Response('font-bytes', { status: 200 })];
    expect((await fetchFontBytes(URL_A, { retryDelayMs: 0 })).toString()).toBe('font-bytes');
    expect(calls).toBe(2);
    expect(warnings).toHaveLength(1);
  });

  it('retries ONCE when fetch itself rejects (connection reset / DNS)', async () => {
    steps = [
      () => {
        throw new TypeError('fetch failed');
      },
      () => new Response('ok', { status: 200 }),
    ];
    expect((await fetchFontBytes(URL_A, { retryDelayMs: 0 })).toString()).toBe('ok');
    expect(calls).toBe(2);
  });

  it('retries ONCE on a 5xx', async () => {
    steps = [() => new Response('busy', { status: 503 }), () => new Response('ok', { status: 200 })];
    expect((await fetchFontBytes(URL_A, { retryDelayMs: 0 })).toString()).toBe('ok');
    expect(calls).toBe(2);
  });

  it('never retries a 404 — the file does not exist', async () => {
    steps = [() => new Response('nope', { status: 404 })];
    await expect(fetchFontBytes(URL_A, { retryDelayMs: 0 })).rejects.toThrow(`Upstream 404 for ${URL_A}`);
    expect(calls).toBe(1);
    expect(warnings).toEqual([]);
  });

  it('gives up after the one retry and throws the second failure', async () => {
    steps = [terminatedResponse, () => new Response('down', { status: 502 })];
    const err = await fetchFontBytes(URL_A, { retryDelayMs: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FontUpstreamStatusError);
    expect((err as FontUpstreamStatusError).status).toBe(502);
    expect(calls).toBe(2);
  });

  it('waits the retry delay before the second request', async () => {
    steps = [() => new Response('busy', { status: 500 }), () => new Response('ok', { status: 200 })];
    const startedAt = Date.now();
    await fetchFontBytes(URL_A, { retryDelayMs: 60 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(50);
  });
});
