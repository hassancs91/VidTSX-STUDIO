import type { LibrarySearchKind, LibrarySearchRequest } from '@shared/types/library-search';
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
