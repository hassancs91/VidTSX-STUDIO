import type {
  LibrarySearchKind,
  LibrarySearchMode,
  LibrarySearchRequest,
  LibrarySearchResult,
} from '@shared/types/library-search';
import type { CategoryFilter } from './asset-search';

/** The Assets box asks the service for its top 20 (LIBRARY_SEARCH_DESIGN.md §8.3). */
export const SMART_LIMIT = 20;
/** Debounce between the last keystroke and the `library:search` call (design §8.3). */
export const SMART_DEBOUNCE_MS = 250;

const KIND_OF: Partial<Record<CategoryFilter, LibrarySearchKind>> = { audio: 'audio', video: 'video', image: 'image' };

/**
 * The `library:search` request for the box's state, or null when Smart has nothing to ask:
 * an empty query, or the Other category (the search covers playable media only — LS-r4;
 * Basic's filter still finds those files by name). `scopeRelPath` is the breadcrumb's
 * library-relative path ('' at the root = the whole library). Pure.
 */
export function smartSearchRequestOf(query: string, scopeRelPath: string, category: CategoryFilter): LibrarySearchRequest | null {
  const trimmed = query.trim();
  if (trimmed === '' || category === 'other') return null;
  const request: LibrarySearchRequest = { query: trimmed };
  if (scopeRelPath !== '') request.scope = scopeRelPath;
  const kind = KIND_OF[category];
  if (kind) request.kinds = [kind];
  request.limit = SMART_LIMIT;
  return request;
}

/** One key per (query, scope, kinds) — an answer is shown only for the request it was asked for. */
export function requestKeyOf(request: LibrarySearchRequest): string {
  return JSON.stringify([request.query, request.scope ?? '', request.kinds ?? []]);
}

/** Smart + AI rerank (design §8.3, LS-r7): the query counts as settled after 1 s without a change (or on Enter). */
export const RERANK_SETTLE_MS = 1000;

/** The settled query's request: the same box state (the same key), asking the service to rerank. */
export function rerankRequestOf(request: LibrarySearchRequest): LibrarySearchRequest {
  return { ...request, rerank: true };
}

/** Only the explicit Smart + AI rerank choice reranks (auto never resolves to it). */
export function shouldRerank(status: { mode: LibrarySearchMode } | null): boolean {
  return status?.mode === 'smart-rerank';
}

/** One answer the box holds: the key it was asked for, the result, and whether it came from a rerank request. */
export interface HeldAnswer {
  key: string;
  result: LibrarySearchResult;
  reranked: boolean;
}

/** The answer to keep: a new key always wins; for the same key a late plain Smart answer never replaces a reranked one. */
export function keepAnswer(prev: HeldAnswer | null, next: HeldAnswer): HeldAnswer {
  if (prev && prev.key === next.key && prev.reranked && !next.reranked) return prev;
  return next;
}
