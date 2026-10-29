import { describe, expect, it, vi } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibrarySearchChoice, LibrarySearchRequest } from '../../../shared/types/library-search';
import { CORPUS_LIBRARY } from '../library/sound-match-corpus.fixture';
import { LibrarySearchRuntime, type RuntimeEngine } from './search-runtime';
import type { StoredSearchSettings } from './search-settings';
import type { LibraryReranker, SemanticItem } from './types';

// Ruling LS-r7: the runtime reranks ONLY a request that asks for it (`rerank: true` — the Assets box's settled query)
// and only when the choice is Smart + AI rerank; the Studio tools' requests never carry the flag. The reranker's cache
// key gets the index version, which an index write of the current library bumps.

const ROOT = 'C:/lib';
const ENTRIES: LibraryIndexEntry[] = CORPUS_LIBRARY;
const SFX: Omit<LibrarySearchRequest, 'query'> = { kinds: ['audio'], soundClass: 'sfx', limit: 20 };

const engine = (): RuntimeEngine => ({
  rank: async (_query, items) => ({
    ranked: items.map((it, i) => ({ relPath: it.relPath, cosine: 1 - i / 1000 })),
    vectors: { ready: items.length, total: items.length },
  }),
  sync: async (items) => ({ ready: items.length, total: items.length }),
  isBuilding: () => false,
  unload: async () => undefined,
});

function make(choice: LibrarySearchChoice) {
  const settings: StoredSearchSettings = { choice, modelId: 'multilingual-e5-small' };
  const versions: string[] = [];
  const rerank = vi.fn(async (_query: string, items: SemanticItem[]) => items.map((it) => it.relPath).reverse());
  let indexVersion: (() => string) | null = null;
  const createReranker = vi.fn((version: () => string): LibraryReranker => {
    indexVersion = version;
    return {
      rerank: async (query, items) => {
        versions.push(version());
        return rerank(query, items);
      },
    };
  });
  const rt = new LibrarySearchRuntime({
    createEngine: engine,
    loadEntries: async () => ENTRIES,
    libraryRoot: () => ROOT,
    readSettings: () => settings,
    writeSettings: () => settings,
    isModelDownloaded: () => true,
    modelBytes: () => 135_392_016,
    emit: () => undefined,
    createReranker,
    syncDebounceMs: 10_000,
  });
  return { rt, rerank, createReranker, versions, version: () => indexVersion?.() ?? null };
}

describe('LibrarySearchRuntime — Smart + AI rerank (LS-r7)', () => {
  it('choice smart-rerank + a request with rerank: true → the reranker orders the top, ran smart-rerank', async () => {
    const m = make('smart-rerank');
    const smart = await m.rt.search({ query: 'things falling over', ...SFX });
    const reranked = await m.rt.search({ query: 'things falling over', ...SFX, rerank: true });
    expect(m.rerank).toHaveBeenCalledTimes(1);
    expect(reranked.ran).toBe('smart-rerank');
    expect(reranked.candidates.map((c) => c.relPath)).toEqual(smart.candidates.map((c) => c.relPath).reverse());
  });

  it('a request without the flag (every Studio tool request) never reranks, even with the choice on', async () => {
    const m = make('smart-rerank');
    const r = await m.rt.search({ query: 'things falling over', ...SFX });
    expect(r.ran).toBe('smart');
    expect(r.requested).toBe('smart-rerank');
    expect(m.rerank).not.toHaveBeenCalled();
  });

  it('the flag does nothing unless the choice is smart-rerank', async () => {
    for (const choice of ['smart', 'auto', 'basic'] as const) {
      const m = make(choice);
      const r = await m.rt.search({ query: 'things falling over', ...SFX, rerank: true });
      expect(r.ran).toBe(choice === 'basic' ? 'basic' : 'smart');
      expect(m.rerank).not.toHaveBeenCalled();
    }
  });

  it('a failing reranker keeps the Smart order (ran smart)', async () => {
    const m = make('smart-rerank');
    m.rerank.mockRejectedValueOnce(new Error('rerank answer unreadable'));
    const smart = await m.rt.search({ query: 'a soft whoosh', ...SFX });
    const r = await m.rt.search({ query: 'a soft whoosh', ...SFX, rerank: true });
    expect(r.ran).toBe('smart');
    expect(r.candidates.map((c) => c.relPath)).toEqual(smart.candidates.map((c) => c.relPath));
  });

  it('the reranker is built once with an index version that an index write of THIS library bumps', async () => {
    const m = make('smart-rerank');
    expect(m.createReranker).toHaveBeenCalledTimes(1);
    const v0 = m.version();
    m.rt.indexWritten('D:/other-library');
    expect(m.version()).toBe(v0);
    m.rt.indexWritten(ROOT);
    const v1 = m.version();
    expect(v1).not.toBe(v0);
    await m.rt.search({ query: 'q whoosh', ...SFX, rerank: true });
    expect(m.versions).toEqual([v1]);
  });
});
