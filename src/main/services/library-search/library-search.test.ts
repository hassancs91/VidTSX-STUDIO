import { describe, expect, it, vi } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibrarySearchChoice } from '../../../shared/types/library-search';
import { CORPUS_LIBRARY } from '../library/sound-match-corpus.fixture';
import { DEFAULT_LIMIT, resolveSearchMode, searchLibrary } from './library-search';
import type { LibrarySearchDeps, SemanticItem, SemanticRanker } from './types';

const SFX = { kinds: ['audio' as const], soundClass: 'sfx' as const };

/** A fake embedder: ranks the pool by a fixed preference list, everything else after it (cosines fall by 0.01). */
function ranker(prefer: string[], seen: SemanticItem[][] = []): SemanticRanker {
  return {
    rank: async (_query, items) => {
      seen.push(items);
      const order = [...items].sort((a, b) => rankIn(prefer, a.relPath) - rankIn(prefer, b.relPath) || a.relPath.localeCompare(b.relPath));
      return { ranked: order.map((it, i) => ({ relPath: it.relPath, cosine: 0.9 - i * 0.01 })), vectors: { ready: items.length, total: items.length } };
    },
  };
}
const rankIn = (xs: string[], p: string): number => (xs.includes(p) ? xs.indexOf(p) : xs.length);

function deps(choice: LibrarySearchChoice, over: Partial<LibrarySearchDeps> = {}, modelDownloaded = true, lib: LibraryIndexEntry[] = CORPUS_LIBRARY): LibrarySearchDeps {
  return { loadEntries: () => lib, settings: () => ({ choice, modelId: 'multilingual-e5-small', modelDownloaded }), semantic: ranker([]), ...over };
}

describe('resolveSearchMode (§4)', () => {
  it('auto = Smart once the model is on disk, else Basic; an explicit choice wins', () => {
    expect(resolveSearchMode('auto', true)).toEqual({ requested: 'smart', run: 'smart' });
    expect(resolveSearchMode('auto', false)).toEqual({ requested: 'basic', run: 'basic' });
    expect(resolveSearchMode('basic', true)).toEqual({ requested: 'basic', run: 'basic' });
    expect(resolveSearchMode('smart', false)).toEqual({ requested: 'smart', run: 'basic', degraded: 'model not downloaded' });
    expect(resolveSearchMode('smart-rerank', false)).toEqual({ requested: 'smart-rerank', run: 'basic', degraded: 'model not downloaded' });
    expect(resolveSearchMode('smart-rerank', true)).toEqual({ requested: 'smart-rerank', run: 'smart-rerank' });
  });
});

describe('searchLibrary', () => {
  it('runs Basic: the keyword list, at most 20, 1-based ranks, words in "why"', async () => {
    const r = await searchLibrary({ query: 'a cracked screen', ...SFX }, deps('basic'));
    expect(r).toMatchObject({ ran: 'basic', requested: 'basic', poolSize: 45 });
    expect(r.degraded).toBeUndefined();
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates.length).toBeLessThanOrEqual(DEFAULT_LIMIT);
    expect(r.candidates.map((c) => c.rank)).toEqual(r.candidates.map((_, i) => i + 1));
    const glass = r.candidates.find((c) => c.relPath === 'sfx/break-glass-crack.mp3');
    expect(glass?.keyword?.words).toContain('cracked');
    expect(glass?.semantic).toBeUndefined();
    expect(glass?.why).toMatch(/^words: .*cracked/);
  });

  it('runs Smart: keywords + meaning fused, every pool clip can answer, the vector state reported', async () => {
    const seen: SemanticItem[][] = [];
    const r = await searchLibrary({ query: 'things falling over', ...SFX }, deps('auto', { semantic: ranker(['sfx/crash-tumble.mp3'], seen) }));
    expect(r).toMatchObject({ ran: 'smart', requested: 'smart', modelId: 'multilingual-e5-small', poolSize: 45, vectors: { ready: 45, total: 45 } });
    expect(r.candidates).toHaveLength(20);
    expect(seen[0]).toHaveLength(45);
    expect(seen[0][0]).toMatchObject({ relPath: expect.any(String), text: expect.any(String), textHash: expect.stringMatching(/^[0-9a-f]{40}$/) });
    const crash = r.candidates.find((c) => c.relPath === 'sfx/crash-tumble.mp3');
    expect(crash?.semantic).toEqual({ rank: 1, cosine: 0.9 });
    expect(crash?.why).toContain('meaning rank 1');
  });

  it('answers in Smart even when no prompt word reaches any clip (no similarity floor, §6)', async () => {
    const r = await searchLibrary({ query: 'zzqx vvbn', ...SFX }, deps('smart'));
    expect(r.ran).toBe('smart');
    expect(r.candidates).toHaveLength(20);
    expect(r.candidates.every((c) => c.keyword === undefined)).toBe(true);
    const basic = await searchLibrary({ query: 'zzqx vvbn', ...SFX }, deps('basic'));
    expect(basic.candidates).toEqual([]);
    expect(basic.poolSize).toBe(45);
  });

  it('reports an empty pool as poolSize 0 in both modes (a true miss)', async () => {
    for (const choice of ['basic', 'smart'] as const) {
      const r = await searchLibrary({ query: 'a whoosh', ...SFX, minDurationSec: 500 }, deps(choice));
      expect(r).toMatchObject({ poolSize: 0, candidates: [] });
    }
  });

  it('honours limit', async () => {
    const r = await searchLibrary({ query: 'a soft whoosh', ...SFX, limit: 5 }, deps('smart'));
    expect(r.candidates).toHaveLength(5);
  });

  it('falls back to Basic with the reason when the embedder fails, is missing, or the model is not downloaded', async () => {
    const failing: SemanticRanker = { rank: vi.fn(async () => { throw new Error('model loading'); }) };
    const a = await searchLibrary({ query: 'a cracked screen', ...SFX }, deps('smart', { semantic: failing }));
    expect(a).toMatchObject({ ran: 'basic', requested: 'smart', degraded: 'model loading' });
    const basic = await searchLibrary({ query: 'a cracked screen', ...SFX }, deps('basic'));
    expect(a.candidates).toEqual(basic.candidates);
    const b = await searchLibrary({ query: 'a cracked screen', ...SFX }, deps('smart', { semantic: undefined }));
    expect(b).toMatchObject({ ran: 'basic', degraded: 'search engine unavailable' });
    const c = await searchLibrary({ query: 'a cracked screen', ...SFX }, deps('smart', {}, false));
    expect(c).toMatchObject({ ran: 'basic', requested: 'smart', degraded: 'model not downloaded' });
  });

  it('keeps keyword-only clips while vectors are still building', async () => {
    const partial: SemanticRanker = {
      rank: async (_q, items) => ({ ranked: [{ relPath: items[0].relPath, cosine: 0.8 }], vectors: { ready: 1, total: items.length } }),
    };
    const r = await searchLibrary({ query: 'a cracked screen', ...SFX }, deps('smart', { semantic: partial }));
    expect(r.vectors).toEqual({ ready: 1, total: 45 });
    expect(r.candidates.some((c) => c.relPath === 'sfx/break-glass-crack.mp3')).toBe(true);
  });

  it('Smart + AI rerank re-orders the top candidates; a failed rerank keeps the Smart order; no reranker = Smart', async () => {
    const smart = await searchLibrary({ query: 'a soft whoosh', ...SFX }, deps('smart'));
    const reversed = smart.candidates.map((c) => c.relPath).reverse();
    const reranker = { rerank: vi.fn(async (_q: string, _items: SemanticItem[]) => reversed) };
    const r = await searchLibrary({ query: 'a soft whoosh', ...SFX }, deps('smart-rerank', { reranker }));
    expect(r.ran).toBe('smart-rerank');
    expect(r.candidates.map((c) => c.relPath)).toEqual(reversed);
    expect(r.candidates[0].reranked).toEqual({ rank: 1 });
    expect(reranker.rerank.mock.calls[0][1]).toHaveLength(20);
    const broken = { rerank: vi.fn(async () => { throw new Error('no provider'); }) };
    const f = await searchLibrary({ query: 'a soft whoosh', ...SFX }, deps('smart-rerank', { reranker: broken }));
    expect(f.ran).toBe('smart');
    expect(f.candidates.map((c) => c.relPath)).toEqual(smart.candidates.map((c) => c.relPath));
    const none = await searchLibrary({ query: 'a soft whoosh', ...SFX }, deps('smart-rerank'));
    expect(none.ran).toBe('smart');
  });

  it('a rerank answer that drops or invents clips keeps every candidate once', async () => {
    const smart = await searchLibrary({ query: 'a soft whoosh', ...SFX }, deps('smart'));
    const top = smart.candidates[5].relPath;
    const reranker = { rerank: async () => [top, 'sfx/not-in-the-list.mp3', top] };
    const r = await searchLibrary({ query: 'a soft whoosh', ...SFX }, deps('smart-rerank', { reranker }));
    expect(r.candidates[0].relPath).toBe(top);
    expect(new Set(r.candidates.map((c) => c.relPath))).toEqual(new Set(smart.candidates.map((c) => c.relPath)));
  });
});
