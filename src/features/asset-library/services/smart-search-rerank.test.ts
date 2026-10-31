import { describe, expect, it } from 'vitest';
import type { LibrarySearchResult } from '@shared/types/library-search';
import {
  keepAnswer,
  RERANK_SETTLE_MS,
  rerankRequestOf,
  requestKeyOf,
  shouldRerank,
  smartSearchRequestOf,
  SMART_DEBOUNCE_MS,
} from './smart-search-request';

// The Assets box's Smart + AI rerank (LIBRARY_SEARCH_DESIGN.md §8.3, ruling LS-r7): only with the explicit choice,
// only after the query settles (Enter, or 1 s idle), one rerank request per settled query; a late plain Smart answer
// never replaces the reranked one for the same request.

const result = (ran: LibrarySearchResult['ran'], paths: string[]): LibrarySearchResult => ({
  ran,
  requested: 'smart-rerank',
  candidates: paths.map((relPath, i) => ({ relPath, rank: i + 1, why: 'x' })),
  poolSize: paths.length,
});

describe('the rerank request', () => {
  it('settles after 1 s idle — later than the 250 ms Smart call', () => {
    expect(RERANK_SETTLE_MS).toBe(1000);
    expect(RERANK_SETTLE_MS).toBeGreaterThan(SMART_DEBOUNCE_MS);
  });

  it('is the same request plus rerank: true, and keeps the same key (it answers the same box state)', () => {
    const req = smartSearchRequestOf('  things falling over ', 'sfx', 'audio');
    expect(req).not.toBeNull();
    const rr = rerankRequestOf(req!);
    expect(rr).toEqual({ ...req, rerank: true });
    expect(requestKeyOf(rr)).toBe(requestKeyOf(req!));
    expect(req).not.toHaveProperty('rerank');
  });

  it('only the explicit Smart + AI rerank mode reranks', () => {
    expect(shouldRerank(null)).toBe(false);
    expect(shouldRerank({ mode: 'basic' })).toBe(false);
    expect(shouldRerank({ mode: 'smart' })).toBe(false);
    expect(shouldRerank({ mode: 'smart-rerank' })).toBe(true);
  });
});

describe('keepAnswer', () => {
  const smart = { key: 'k', result: result('smart', ['a', 'b']), reranked: false };
  const reranked = { key: 'k', result: result('smart-rerank', ['b', 'a']), reranked: true };

  it('a reranked answer replaces the Smart one for the same key', () => {
    expect(keepAnswer(smart, reranked)).toBe(reranked);
  });

  it('a late Smart answer never replaces a reranked one for the same key', () => {
    expect(keepAnswer(reranked, smart)).toBe(reranked);
  });

  it('an answer for another key always replaces (the box moved on)', () => {
    const other = { key: 'k2', result: result('smart', ['c']), reranked: false };
    expect(keepAnswer(reranked, other)).toBe(other);
    expect(keepAnswer(null, smart)).toBe(smart);
  });
});
