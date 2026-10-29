// The library-search service's seams (LIBRARY_SEARCH_DESIGN.md §3): everything `searchLibrary` needs is
// injected, so every test runs the product code with a fake embedder / reranker / settings.

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibrarySearchChoice } from '../../../shared/types/library-search';

/** What one pool entry is embedded as (`item-text.ts`), keyed for the vector cache. */
export interface SemanticItem {
  relPath: string;
  text: string;
  textHash: string;
}

export interface SemanticRanking {
  /** The pool items that have a vector, best cosine first (items still waiting for a vector are left out). */
  ranked: Array<{ relPath: string; cosine: number }>;
  vectors: { ready: number; total: number };
}

/** The local embedder (the library-search engine in the app; the fixture vectors in the benchmark). */
export interface SemanticRanker {
  rank(query: string, items: SemanticItem[]): Promise<SemanticRanking>;
}

/** Smart + AI rerank (§8.3): the user's provider re-orders the top candidates; returns relPaths, best first. */
export interface LibraryReranker {
  rerank(query: string, items: SemanticItem[]): Promise<string[]>;
}

export interface LibrarySearchSettings {
  choice: LibrarySearchChoice;
  modelId: string;
  modelDownloaded: boolean;
}

export interface LibrarySearchDeps {
  loadEntries: () => Promise<LibraryIndexEntry[]> | LibraryIndexEntry[];
  settings: () => LibrarySearchSettings;
  semantic?: SemanticRanker;
  /** Only the Assets box passes one — in the Studio tools the assistant is the picker. */
  reranker?: LibraryReranker;
}

/** One entry of the keyword list (Basic's order). */
export interface KeywordHit {
  entry: LibraryIndexEntry;
  coverage: number;
  words: string[];
}
