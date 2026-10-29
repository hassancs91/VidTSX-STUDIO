// The one shared library search (LIBRARY_SEARCH_DESIGN.md §3 / §4 / §6): resolve the mode from the ladder, build
// the pool, run Basic (the keyword list) or Smart (keywords + the local embedder, fused by RRF), optionally let the
// user's provider re-order the top (Smart + AI rerank, the Assets box only), and return at most `limit` candidates.
// Retrieval never claims: the order is not a ranking of fit, and there is no similarity floor — a non-empty pool
// always answers in Smart (§6). Never throws for an embedder problem: it runs Basic and says why in `degraded`.

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type {
  LibrarySearchCandidate, LibrarySearchChoice, LibrarySearchMode, LibrarySearchRequest, LibrarySearchResult,
} from '../../../shared/types/library-search';
import { fuseRankings, type FusedItem } from './fuse';
import { semanticItemOf } from './item-text';
import { keywordList } from './keyword-retriever';
import { searchPool } from './search-pool';
import type { KeywordHit, LibrarySearchDeps, SemanticItem, SemanticRanking } from './types';

export const DEFAULT_LIMIT = 20;

export interface ResolvedMode {
  requested: LibrarySearchMode;
  run: LibrarySearchMode;
  degraded?: string;
}

/** §4: auto = Smart once the model is on disk, else Basic; an explicit Smart with no model runs Basic, degraded. */
export function resolveSearchMode(choice: LibrarySearchChoice, modelDownloaded: boolean): ResolvedMode {
  if (choice === 'auto') return modelDownloaded ? { requested: 'smart', run: 'smart' } : { requested: 'basic', run: 'basic' };
  if (choice === 'basic' || modelDownloaded) return { requested: choice, run: choice };
  return { requested: choice, run: 'basic', degraded: 'model not downloaded' };
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err)) || 'search engine error';

function whyOf(c: Omit<LibrarySearchCandidate, 'why' | 'rank'>): string {
  const parts: string[] = [];
  if (c.keyword && c.keyword.words.length > 0) parts.push(`words: ${c.keyword.words.join(', ')}`);
  if (c.semantic) parts.push(`meaning rank ${c.semantic.rank}`);
  if (c.reranked) parts.push(`reranked ${c.reranked.rank}`);
  return parts.join(' · ') || 'in the library';
}

function finish(items: Array<Omit<LibrarySearchCandidate, 'why' | 'rank'>>, limit: number): LibrarySearchCandidate[] {
  return items.slice(0, limit).map((c, i) => ({ ...c, rank: i + 1, why: whyOf(c) }));
}

function basicCandidates(hits: KeywordHit[], limit: number): LibrarySearchCandidate[] {
  return finish(hits.map((h, i) => ({ relPath: h.entry.relPath, keyword: { rank: i + 1, coverage: h.coverage, words: h.words } })), limit);
}

function smartItems(fused: FusedItem[], hits: KeywordHit[]): Array<Omit<LibrarySearchCandidate, 'why' | 'rank'>> {
  const byPath = new Map(hits.map((h) => [h.entry.relPath, h]));
  return fused.map((f) => {
    const hit = byPath.get(f.relPath);
    return {
      relPath: f.relPath,
      ...(hit && f.keywordRank ? { keyword: { rank: f.keywordRank, coverage: hit.coverage, words: hit.words } } : {}),
      ...(f.semanticRank !== undefined && f.cosine !== undefined ? { semantic: { rank: f.semanticRank, cosine: f.cosine } } : {}),
    };
  });
}

/** A rerank answer applied to the top: its known paths first (once each), then the rest in Smart's order. */
function applyRerank(top: LibrarySearchCandidate[], order: string[]): LibrarySearchCandidate[] {
  const byPath = new Map(top.map((c) => [c.relPath, c]));
  const seen = new Set<string>();
  const first = order.filter((p) => byPath.has(p) && !seen.has(p) && seen.add(p));
  const rest = top.map((c) => c.relPath).filter((p) => !seen.has(p));
  return [...first, ...rest].map((p, i) => {
    const c = byPath.get(p) as LibrarySearchCandidate;
    const item = { relPath: c.relPath, keyword: c.keyword, semantic: c.semantic, reranked: { rank: i + 1 } };
    return { ...item, rank: i + 1, why: whyOf(item) };
  });
}

export async function searchLibrary(request: LibrarySearchRequest, deps: LibrarySearchDeps): Promise<LibrarySearchResult> {
  const settings = deps.settings();
  const mode = resolveSearchMode(settings.choice, settings.modelDownloaded);
  const limit = Math.max(1, Math.floor(request.limit ?? DEFAULT_LIMIT));
  const entries: LibraryIndexEntry[] = await deps.loadEntries();
  const pool = searchPool(entries, request);
  const hits = keywordList(pool, request);
  const base = { requested: mode.requested, poolSize: pool.length };
  const basic = (degraded?: string): LibrarySearchResult => ({ ...base, ran: 'basic', candidates: basicCandidates(hits, limit), ...(degraded ? { degraded } : {}) });

  if (mode.run === 'basic') return basic(mode.degraded);
  if (pool.length === 0) return { ...base, ran: 'smart', modelId: settings.modelId, candidates: [], vectors: { ready: 0, total: 0 } };
  if (!deps.semantic) return basic('search engine unavailable');

  const items: SemanticItem[] = pool.map(semanticItemOf);
  let ranking: SemanticRanking;
  try {
    ranking = await deps.semantic.rank(request.query, items);
  } catch (err) {
    return basic(reasonOf(err));
  }
  const fused = fuseRankings(hits.map((h) => h.entry.relPath), ranking.ranked);
  const candidates = finish(smartItems(fused, hits), limit);
  const smart: LibrarySearchResult = { ...base, ran: 'smart', modelId: settings.modelId, candidates, vectors: ranking.vectors };
  if (mode.run !== 'smart-rerank' || !deps.reranker || candidates.length === 0) return smart;

  try {
    const textOf = new Map(items.map((it) => [it.relPath, it]));
    const order = await deps.reranker.rerank(request.query, candidates.map((c) => textOf.get(c.relPath) as SemanticItem));
    return { ...smart, ran: 'smart-rerank', candidates: applyRerank(candidates, order) };
  } catch {
    return smart;
  }
}
