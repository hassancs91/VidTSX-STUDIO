import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibrarySearchChoice } from '../../../shared/types/library-search';
import type { LibrarySearchEvent } from '../../../shared/ipc/types/library-search';
import { CORPUS_LIBRARY } from '../library/sound-match-corpus.fixture';
import { LibrarySearchRuntime, type RuntimeEngine, type RuntimeVectors } from './search-runtime';
import type { StoredSearchSettings } from './search-settings';
import type { SemanticItem } from './types';

// The main-side wiring of library search (LIBRARY_SEARCH_DESIGN.md §4 / §5 / §7 / §10): status, the ladder setting,
// the background build (after a download, after index writes, when a Smart result is short of vectors) and the
// push events — over a fake engine, so nothing spawns. "Startup cost is zero": constructing it calls nothing.
const ROOT = 'C:/lib';
const ENTRIES: LibraryIndexEntry[] = CORPUS_LIBRARY;

let settings: StoredSearchSettings;
let downloaded: Set<string>;
let events: LibrarySearchEvent[];
let rankCalls: Array<{ query: string; items: SemanticItem[] }>;
let syncCalls: Array<{ items: SemanticItem[]; prune: boolean }>;
let syncRelease: Array<() => void>;
let rankReady: number | null;
let onVectors: ((state: RuntimeVectors) => void) | null;
let unloadCalls: number;

function fakeEngine(cb: (state: RuntimeVectors) => void): RuntimeEngine {
  onVectors = cb;
  return {
    rank: async (query, items) => {
      rankCalls.push({ query, items });
      const ready = rankReady ?? items.length;
      return { ranked: items.slice(0, ready).map((it, i) => ({ relPath: it.relPath, cosine: 1 - i / 100 })), vectors: { ready, total: items.length } };
    },
    sync: (items, prune) => new Promise((resolve) => {
      syncCalls.push({ items, prune });
      cb({ ready: 0, total: items.length, building: true });
      syncRelease.push(() => resolve({ ready: items.length, total: items.length }));
    }),
    isBuilding: () => syncRelease.length > 0,
    unload: async () => {
      unloadCalls += 1;
    },
  };
}

function make(): LibrarySearchRuntime {
  return new LibrarySearchRuntime({
    createEngine: fakeEngine,
    loadEntries: async () => ENTRIES,
    libraryRoot: () => ROOT,
    readSettings: () => settings,
    writeSettings: (patch: { mode?: LibrarySearchChoice; modelId?: string }) => {
      settings = { choice: patch.mode ?? settings.choice, modelId: patch.modelId ?? settings.modelId };
      return settings;
    },
    isModelDownloaded: (id) => downloaded.has(id),
    modelBytes: (id) => (id === 'multilingual-e5-small' ? 135_392_016 : id === 'bge-small' ? 1 : null),
    emit: (e) => { events.push(e); },
    syncDebounceMs: 10,
  });
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};
async function releaseSyncs(): Promise<void> {
  while (syncRelease.length > 0) {
    syncRelease.shift()?.();
    await settle();
  }
}

beforeEach(() => {
  settings = { choice: 'auto', modelId: 'multilingual-e5-small' };
  downloaded = new Set();
  events = [];
  rankCalls = [];
  syncCalls = [];
  syncRelease = [];
  rankReady = null;
  onVectors = null;
  unloadCalls = 0;
});

describe('LibrarySearchRuntime — status', () => {
  it('no model: Basic (auto), not downloaded, the catalog size, no vectors — and nothing is asked of the engine', async () => {
    const rt = make();
    expect(rt.status()).toEqual({
      mode: 'basic', choice: 'auto', modelId: 'multilingual-e5-small', modelDownloaded: false, modelBytes: 135_392_016,
      vectors: { ready: 0, total: 0, building: false },
    });
    await settle();
    expect(syncCalls).toHaveLength(0);
    expect(rankCalls).toHaveLength(0);
  });

  it('model on disk (auto): Smart; the first status call starts the background build once; the build reaches total', async () => {
    downloaded.add('multilingual-e5-small');
    const rt = make();
    const first = rt.status();
    expect(first.mode).toBe('smart');
    expect(first.vectors.building).toBe(true);
    await settle();
    expect(syncCalls).toHaveLength(1);
    expect(syncCalls[0].prune).toBe(true);
    expect(syncCalls[0].items).toHaveLength(ENTRIES.length);
    rt.status();
    expect(syncCalls).toHaveLength(1);
    await releaseSyncs();
    expect(rt.status().vectors).toEqual({ ready: ENTRIES.length, total: ENTRIES.length, building: false });
    expect(syncCalls).toHaveLength(1);
    const vectorEvents = events.filter((e) => e.type === 'vectors');
    expect(vectorEvents[0]).toEqual({ type: 'vectors', ready: 0, total: ENTRIES.length, building: true });
    expect(vectorEvents[vectorEvents.length - 1]).toEqual({ type: 'vectors', ready: ENTRIES.length, total: ENTRIES.length, building: false });
  });

  it('an explicit Basic stays Basic with the model on disk (no build); an explicit Smart with no model is Basic', async () => {
    downloaded.add('multilingual-e5-small');
    settings = { choice: 'basic', modelId: 'multilingual-e5-small' };
    expect(make().status()).toMatchObject({ mode: 'basic', choice: 'basic', modelDownloaded: true });
    await settle();
    expect(syncCalls).toHaveLength(0);
    downloaded.clear();
    settings = { choice: 'smart', modelId: 'multilingual-e5-small' };
    expect(make().status()).toMatchObject({ mode: 'basic', choice: 'smart', modelDownloaded: false });
    expect(syncCalls).toHaveLength(0);
  });
});

describe('LibrarySearchRuntime — search', () => {
  it('auto with the model runs Smart through the engine; Basic never asks it', async () => {
    downloaded.add('multilingual-e5-small');
    const rt = make();
    const smart = await rt.search({ query: 'things falling over', kinds: ['audio'], soundClass: 'sfx' });
    expect(smart.ran).toBe('smart');
    expect(rankCalls).toHaveLength(1);
    expect(rankCalls[0].query).toBe('things falling over');
    settings = { choice: 'basic', modelId: 'multilingual-e5-small' };
    const basic = await rt.search({ query: 'things falling over', kinds: ['audio'], soundClass: 'sfx' });
    expect(basic.ran).toBe('basic');
    expect(rankCalls).toHaveLength(1);
  });

  it('a Smart result short of vectors starts the background build (once while it runs)', async () => {
    downloaded.add('multilingual-e5-small');
    rankReady = 0;
    const rt = make();
    const r = await rt.search({ query: 'whoosh', kinds: ['audio'], soundClass: 'sfx' });
    expect(r.ran).toBe('smart');
    expect(r.vectors?.ready).toBe(0);
    await settle();
    expect(syncCalls).toHaveLength(1);
    await rt.search({ query: 'whoosh', kinds: ['audio'], soundClass: 'sfx' });
    await settle();
    expect(syncCalls).toHaveLength(1);
    await releaseSyncs();
  });

  it('a full Smart result starts no build', async () => {
    downloaded.add('multilingual-e5-small');
    const rt = make();
    await rt.search({ query: 'whoosh', kinds: ['audio'], soundClass: 'sfx' });
    await settle();
    expect(syncCalls).toHaveLength(0);
  });
});

describe('LibrarySearchRuntime — settings and events', () => {
  it('setting a mode stores it, returns the new status and pushes a status event', async () => {
    downloaded.add('multilingual-e5-small');
    const rt = make();
    const status = rt.setSettings({ mode: 'basic' });
    expect(status).toMatchObject({ mode: 'basic', choice: 'basic' });
    expect(events).toContainEqual({ type: 'status', status });
    await settle();
    expect(syncCalls).toHaveLength(0);
  });

  it('switching to Smart with the model on disk starts the build', async () => {
    downloaded.add('multilingual-e5-small');
    settings = { choice: 'basic', modelId: 'multilingual-e5-small' };
    const rt = make();
    expect(rt.setSettings({ mode: 'auto' }).mode).toBe('smart');
    await settle();
    expect(syncCalls).toHaveLength(1);
  });

  it('an unknown model id is refused and nothing is stored', () => {
    const rt = make();
    expect(() => rt.setSettings({ modelId: 'no-such-model' })).toThrow(/Unknown embedding model/);
    expect(settings.modelId).toBe('multilingual-e5-small');
    expect(events).toHaveLength(0);
  });

  it('the search model downloaded → a status event (now Smart) and the full build; another model → nothing', async () => {
    const rt = make();
    downloaded.add('bge-small');
    rt.modelChanged({ modelId: 'bge-small', change: 'downloaded' });
    expect(events).toHaveLength(0);
    expect(syncCalls).toHaveLength(0);
    downloaded.add('multilingual-e5-small');
    rt.modelChanged({ modelId: 'multilingual-e5-small', change: 'downloaded' });
    await settle();
    expect(syncCalls).toHaveLength(1);
    const status = events.find((e) => e.type === 'status');
    expect(status && status.type === 'status' && status.status.mode).toBe('smart');
    await releaseSyncs();
    expect(syncCalls).toHaveLength(1);
  });

  it('the search model deleted → a status event (Basic), no build', async () => {
    const rt = make();
    rt.modelChanged({ modelId: 'multilingual-e5-small', change: 'deleted' });
    await settle();
    expect(events).toEqual([{ type: 'status', status: expect.objectContaining({ mode: 'basic', modelDownloaded: false }) }]);
    expect(syncCalls).toHaveLength(0);
  });

  it('an index write in this library schedules a debounced sync while Smart is on; another root or Basic → none', async () => {
    vi.useFakeTimers();
    try {
      const rt = make();
      rt.indexWritten(ROOT);
      await vi.advanceTimersByTimeAsync(50);
      expect(syncCalls).toHaveLength(0);
      downloaded.add('multilingual-e5-small');
      rt.indexWritten('D:/other');
      await vi.advanceTimersByTimeAsync(50);
      expect(syncCalls).toHaveLength(0);
      rt.indexWritten(ROOT);
      rt.indexWritten(ROOT);
      expect(syncCalls).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(50);
      expect(syncCalls).toHaveLength(1);
      syncRelease.shift()?.();
      await vi.advanceTimersByTimeAsync(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('before the search model is deleted the engine child is unloaded (LS-r3); another model → not', async () => {
    const rt = make();
    await rt.beforeModelDelete('bge-small');
    expect(unloadCalls).toBe(0);
    await rt.beforeModelDelete('multilingual-e5-small');
    expect(unloadCalls).toBe(1);
  });

  it('LS-r5: while the search model is being removed, Smart runs Basic ("model being removed") and asks the engine nothing; cleared on delete-failed / deleted', async () => {
    downloaded.add('multilingual-e5-small');
    const rt = make();
    const req = { query: 'a soft whoosh', kinds: ['audio' as const], soundClass: 'sfx' as const };
    await rt.beforeModelDelete('bge-small');
    expect((await rt.search(req)).ran).toBe('smart');
    rankCalls = [];

    await rt.beforeModelDelete('multilingual-e5-small');
    const during = await rt.search(req);
    expect(during).toMatchObject({ ran: 'basic', requested: 'smart', degraded: 'model being removed' });
    expect(during.candidates.length).toBeGreaterThan(0);
    rt.status();
    rt.indexWritten(ROOT);
    await new Promise((r) => setTimeout(r, 30));
    expect(rankCalls).toHaveLength(0);
    expect(syncCalls).toHaveLength(0);

    rt.modelChanged({ modelId: 'multilingual-e5-small', change: 'delete-failed' });
    expect((await rt.search(req)).ran).toBe('smart');
    expect(rankCalls).toHaveLength(1);
    await releaseSyncs();

    await rt.beforeModelDelete('multilingual-e5-small');
    downloaded.delete('multilingual-e5-small');
    rt.modelChanged({ modelId: 'multilingual-e5-small', change: 'deleted' });
    const after = await rt.search(req);
    expect(after.ran).toBe('basic');
    expect(after.degraded).toBeUndefined();
  });

  it('engine progress is pushed as vectors events', () => {
    make();
    onVectors?.({ ready: 12, total: 51, building: true });
    expect(events).toEqual([{ type: 'vectors', ready: 12, total: 51, building: true }]);
  });
});
