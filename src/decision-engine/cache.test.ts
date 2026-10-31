import { describe, expect, it, vi } from 'vitest';
import {
  canonicalJson,
  DECISION_CACHE_MAX_ENTRIES,
  DECISION_CACHE_TTL_MS,
  DecisionCache,
  sha256Hex,
  type DecisionCacheKeyParts,
} from './cache';

// D2 §4 / §9: in-memory LRU (1,000 entries, 15 min) keyed by sha256 of the canonical JSON of {provider, model, state, questions};
// failures never cached; identical concurrent requests share one in-flight call (LS-r7). Never written to disk.

function parts(overrides: Partial<DecisionCacheKeyParts> = {}): DecisionCacheKeyParts {
  return {
    provider: 'jev',
    model: 'jev-1.14.0',
    state: 'You check a video editor assistant’s work.',
    questions: { q: { type: 'noul', instructions: 'Does it match?', criteria: { true: 'yes', false: 'no' } } },
    ...overrides,
  };
}

/** A fast, deterministic stand-in hash for the bulk tests. */
const plainHash = async (text: string): Promise<string> => text;

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('sha256Hex (WebCrypto — no Node import)', () => {
  it('matches the FIPS 180-2 vectors', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('canonicalJson', () => {
  it('sorts object keys at every depth, keeps array order, drops undefined members', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe('{"a":{"c":[3,{"e":2,"f":1}],"d":2},"b":1}');
    expect(canonicalJson({ a: undefined, b: 'x' })).toBe('{"b":"x"}');
    expect(canonicalJson(['z', 'a'])).toBe('["z","a"]');
    expect(canonicalJson([undefined, 1])).toBe('[null,1]');
    expect(canonicalJson('ok')).toBe('"ok"');
    expect(canonicalJson(null)).toBe('null');
  });
});

describe('DecisionCache.keyOf', () => {
  it('= sha256 of the canonical JSON of {provider, model, state, questions}', async () => {
    const cache = new DecisionCache<string>();
    const p = parts();
    const expected = await sha256Hex(canonicalJson({ provider: p.provider, model: p.model, state: p.state, questions: p.questions }));
    expect(await cache.keyOf(p)).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores key order; changes with provider, model, state or a question', async () => {
    const cache = new DecisionCache<string>();
    const a = await cache.keyOf(parts({ state: { x: 1, y: 2 } }));
    const b = await cache.keyOf(parts({ state: { y: 2, x: 1 } }));
    expect(a).toBe(b);
    const base = await cache.keyOf(parts());
    expect(await cache.keyOf(parts({ provider: 'openrouter-decisions' }))).not.toBe(base);
    expect(await cache.keyOf(parts({ model: 'jev-latest' }))).not.toBe(base);
    expect(await cache.keyOf(parts({ state: 'another state' }))).not.toBe(base);
    expect(await cache.keyOf(parts({ questions: { q: { type: 'noul', instructions: 'Different?' } } }))).not.toBe(base);
  });

  it('uses an injected hash', async () => {
    const hash = vi.fn(async (t: string) => `h:${t.length}`);
    const cache = new DecisionCache<string>({ hash });
    expect(await cache.keyOf(parts())).toMatch(/^h:\d+$/);
    expect(hash).toHaveBeenCalledOnce();
  });
});

describe('DecisionCache.run', () => {
  it('computes once, then serves the cached value (cached: true)', async () => {
    const cache = new DecisionCache<string>();
    const compute = vi.fn(async () => 'answer');
    expect(await cache.run(parts(), compute)).toEqual({ value: 'answer', cached: false });
    expect(await cache.run(parts(), compute)).toEqual({ value: 'answer', cached: true });
    expect(compute).toHaveBeenCalledOnce();
  });

  it('identical concurrent requests share one in-flight call', async () => {
    const cache = new DecisionCache<string>({ hash: plainHash }); // key resolves in a microtask: both calls are past it after one tick
    const gate = deferred<string>();
    const compute = vi.fn(() => gate.promise);
    const first = cache.run(parts(), compute);
    const second = cache.run(parts({ state: 'You check a video editor assistant’s work.' }), compute);
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve('shared');
    const results = await Promise.all([first, second]);
    expect(compute).toHaveBeenCalledOnce();
    expect(results.map((r) => r.value)).toEqual(['shared', 'shared']);
    expect(results.filter((r) => !r.cached)).toHaveLength(1);
  });

  it('never caches a failure: concurrent sharers all reject, the next call computes again', async () => {
    const cache = new DecisionCache<string>({ hash: plainHash });
    const gate = deferred<string>();
    const failing = vi.fn(() => gate.promise);
    const a = cache.run(parts(), failing);
    const b = cache.run(parts(), failing);
    await new Promise((r) => setTimeout(r, 0));
    expect(failing).toHaveBeenCalledOnce();
    const both = Promise.all([expect(a).rejects.toThrow('provider-error'), expect(b).rejects.toThrow('provider-error')]);
    gate.reject(new Error('provider-error'));
    await both;
    expect(failing).toHaveBeenCalledOnce();
    expect(cache.size).toBe(0);
    const ok = vi.fn(async () => 'second try');
    expect(await cache.run(parts(), ok)).toEqual({ value: 'second try', cached: false });
    expect(ok).toHaveBeenCalledOnce();
  });

  it('a different request is not shared', async () => {
    const cache = new DecisionCache<string>();
    const compute = vi.fn(async () => 'v');
    await Promise.all([cache.run(parts(), compute), cache.run(parts({ provider: 'openrouter-decisions' }), compute)]);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe('DecisionCache — TTL and LRU', () => {
  it('defaults to 1,000 entries and 15 minutes', () => {
    expect(DECISION_CACHE_MAX_ENTRIES).toBe(1_000);
    expect(DECISION_CACHE_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('an entry is fresh until 15 min after it was stored, then recomputed', async () => {
    let now = 1_000_000;
    const cache = new DecisionCache<string>({ now: () => now });
    const compute = vi.fn(async () => 'v');
    await cache.run(parts(), compute);
    now += DECISION_CACHE_TTL_MS - 1;
    expect((await cache.run(parts(), compute)).cached).toBe(true);
    now += 1;
    expect((await cache.run(parts(), compute)).cached).toBe(false);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('a hit does not extend the TTL', async () => {
    let now = 0;
    const cache = new DecisionCache<string>({ now: () => now });
    const compute = vi.fn(async () => 'v');
    await cache.run(parts(), compute);
    now = DECISION_CACHE_TTL_MS - 10;
    await cache.run(parts(), compute);
    now = DECISION_CACHE_TTL_MS;
    expect((await cache.run(parts(), compute)).cached).toBe(false);
  });

  it('evicts the least recently used entry past maxEntries; a hit refreshes recency', async () => {
    const cache = new DecisionCache<string>({ maxEntries: 3, hash: plainHash });
    const run = (state: string) => cache.run(parts({ state }), async () => state);
    await run('s0');
    await run('s1');
    await run('s2');
    expect((await run('s0')).cached).toBe(true); // s0 is now the most recent
    await run('s3'); // evicts s1
    expect(cache.size).toBe(3);
    expect((await run('s0')).cached).toBe(true);
    expect((await run('s2')).cached).toBe(true);
    expect((await run('s1')).cached).toBe(false);
  });

  it('holds at most 1,000 entries by default', async () => {
    const cache = new DecisionCache<string>({ hash: plainHash });
    for (let i = 0; i <= DECISION_CACHE_MAX_ENTRIES; i++) await cache.run(parts({ state: `s${i}` }), async () => 'v');
    expect(cache.size).toBe(DECISION_CACHE_MAX_ENTRIES);
    expect((await cache.run(parts({ state: 's0' }), async () => 'fresh')).cached).toBe(false);
  });

  it('clear() empties it', async () => {
    const cache = new DecisionCache<string>();
    await cache.run(parts(), async () => 'v');
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
