import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { CORPUS_LIBRARY } from '../library/sound-match-corpus.fixture';
import { semanticItemOf } from './item-text';
import type { SemanticItem } from './types';
import { VectorSync, syncItemsOf } from './vector-sync';

// Main's side of the vector cache (§5): which items the engine keeps vectors for, the debounced background sync after
// index writes, and the full build (after the model download) — coalesced, never thrown.
const image = { relPath: 'brands/logo.png', kind: 'image', tags: ['logo'] } as unknown as LibraryIndexEntry;
const video = { relPath: 'broll/city.mp4', kind: 'video' } as unknown as LibraryIndexEntry;
const ENTRIES: LibraryIndexEntry[] = [...CORPUS_LIBRARY, image, video];

let calls: Array<{ items: SemanticItem[]; prune: boolean }> = [];
let release: Array<() => void> = [];
let enabled = true;
let errors: unknown[] = [];
let fail = false;

function make(debounceMs = 1000): VectorSync {
  return new VectorSync({
    engine: {
      sync: (items, prune) => new Promise((resolve, reject) => {
        calls.push({ items, prune });
        release.push(() => (fail ? reject(new Error('engine died')) : resolve({ ready: items.length, total: items.length })));
      }),
    },
    loadEntries: async () => ENTRIES,
    enabled: () => enabled,
    debounceMs,
    onError: (e) => { errors.push(e); },
  });
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(() => {
  calls = [];
  release = [];
  enabled = true;
  errors = [];
  fail = false;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('syncItemsOf', () => {
  it('is every library entry (audio of both classes, images, videos) as its semantic item', () => {
    const items = syncItemsOf(ENTRIES);
    expect(items).toHaveLength(ENTRIES.length);
    expect(items).toEqual(ENTRIES.map(semanticItemOf));
  });
});

describe('VectorSync', () => {
  it('buildNow syncs every item with prune, and concurrent calls share one run', async () => {
    const vs = make();
    const a = vs.buildNow();
    const b = vs.buildNow();
    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0].prune).toBe(true);
    expect(calls[0].items).toHaveLength(ENTRIES.length);
    release[0]();
    await settle();
    // the second caller asked during the run → one more pass after it (an index write may have landed meanwhile)
    expect(calls).toHaveLength(2);
    release[1]();
    expect(await a).toEqual({ ready: ENTRIES.length, total: ENTRIES.length });
    expect(await b).toEqual({ ready: ENTRIES.length, total: ENTRIES.length });
  });

  it('schedule() is debounced: three index writes in a row → one sync after the quiet period', async () => {
    vi.useFakeTimers();
    const vs = make(1000);
    vs.schedule();
    await vi.advanceTimersByTimeAsync(500);
    vs.schedule();
    vs.schedule();
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(1);
  });

  it('does nothing while Smart is off / the model is missing', async () => {
    enabled = false;
    const vs = make();
    expect(await vs.buildNow()).toBeNull();
    vi.useFakeTimers();
    vs.schedule();
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(0);
  });

  it('a failed sync is reported to onError and resolves null (never throws into an index write)', async () => {
    fail = true;
    const vs = make();
    const p = vs.buildNow();
    await settle();
    release[0]();
    expect(await p).toBeNull();
    expect(errors).toHaveLength(1);
  });
});
