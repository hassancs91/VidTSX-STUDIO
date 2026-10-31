/**
 * The decision cache (DECISION_MODELS_DESIGN.md §4 `cache.ts`, §9): in memory only — a state may be private text, never written to
 * disk — an LRU of 1,000 entries, 15 min from the write, keyed by sha256 of the canonical JSON of {provider, model, state, questions}.
 * Failures are never cached; identical concurrent requests share one in-flight call (the LS-r7 rule). Process-neutral: sha256 comes
 * from WebCrypto (`globalThis.crypto.subtle`, in Node and browsers alike) and can be injected.
 */
import type { DecisionRequest } from './types';

export const DECISION_CACHE_MAX_ENTRIES = 1_000;
export const DECISION_CACHE_TTL_MS = 15 * 60 * 1000;

/** What a cached answer is keyed on: the rung that answered and exactly what it was asked. */
export interface DecisionCacheKeyParts {
  provider: string;
  model: string;
  state: DecisionRequest['state'];
  questions: DecisionRequest['questions'];
}

export interface DecisionCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
  /** Milliseconds clock (tests inject one). */
  now?: () => number;
  /** Hex digest of a string (default: WebCrypto SHA-256). */
  hash?: (text: string) => Promise<string>;
}

/** SHA-256 of the UTF-8 bytes, lower-case hex, via WebCrypto (no Node import). */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) is not available in this process');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** JSON with object keys sorted at every depth (array order kept; undefined members dropped as JSON.stringify does). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined || typeof v === 'function' ? 'null' : canonicalJson(v))).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .filter((k) => record[k] !== undefined && typeof record[k] !== 'function')
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`);
    return `{${members.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

interface Entry<V> {
  value: V;
  storedAt: number;
}

/** An LRU + TTL cache with in-flight sharing. `V` is what a rung returns (the engine caches provider outputs). */
export class DecisionCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly inflight = new Map<string, Promise<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly hash: (text: string) => Promise<string>;

  constructor(options: DecisionCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DECISION_CACHE_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? DECISION_CACHE_TTL_MS;
    this.now = options.now ?? (() => Date.now());
    this.hash = options.hash ?? sha256Hex;
  }

  get size(): number {
    return this.entries.size;
  }

  keyOf(parts: DecisionCacheKeyParts): Promise<string> {
    const { provider, model, state, questions } = parts;
    return this.hash(canonicalJson({ provider, model, state, questions }));
  }

  /**
   * The cached value for `parts`, else the in-flight call for the same key, else `compute()` (stored only when it resolves).
   * `cached` is false only for the caller whose `compute` ran — a hit or a shared call made no request of its own.
   */
  async run(parts: DecisionCacheKeyParts, compute: () => Promise<V>): Promise<{ value: V; cached: boolean }> {
    const key = await this.keyOf(parts);
    const hit = this.read(key);
    if (hit !== undefined) return { value: hit.value, cached: true };
    const pending = this.inflight.get(key);
    if (pending) return { value: await pending, cached: true };

    const call = compute();
    this.inflight.set(key, call);
    try {
      const value = await call;
      this.write(key, value);
      return { value, cached: false };
    } finally {
      this.inflight.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private read(key: string): Entry<V> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.storedAt >= this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key); // refresh recency (Map keeps insertion order)
    this.entries.set(key, entry);
    return entry;
  }

  private write(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: this.now() });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }
}
