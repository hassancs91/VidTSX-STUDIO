// Library search (LIBRARY_SEARCH_DESIGN.md §3): one shared, meaning-aware search over the asset library.
// Retrieval is wide and humble — it never claims a fit; the pick is made where judgement lives (the assistant,
// or an optional rerank by the user's own provider in the Assets box).

/** The setting ladder: Basic (keywords) · Smart (+ local embeddings) · Smart + AI rerank (+ the user's provider). */
export type LibrarySearchMode = 'basic' | 'smart' | 'smart-rerank';

/** The stored choice: unset = auto (Smart once the model is on disk, else Basic). */
export type LibrarySearchChoice = LibrarySearchMode | 'auto';

export type LibrarySearchKind = 'audio' | 'video' | 'image';

export interface LibrarySearchRequest {
  query: string;
  kinds?: LibrarySearchKind[];
  soundClass?: 'sfx' | 'music';
  minDurationSec?: number;
  /** relPath prefix (the Assets breadcrumb). */
  scope?: string;
  /** Default 20. */
  limit?: number;
  /**
   * Smart + AI rerank (§8.3, ruling LS-r7): set only by the Assets box for a SETTLED query (Enter, or 1 s idle);
   * it takes effect only under the explicit `smart-rerank` choice. The Studio tools never set it.
   */
  rerank?: boolean;
}

export interface LibrarySearchCandidate {
  relPath: string;
  /** 1-based, the order shown. */
  rank: number;
  /** Prompt words this item covers. */
  keyword?: { rank: number; coverage: number; words: string[] };
  semantic?: { rank: number; cosine: number };
  reranked?: { rank: number };
  /** Plain words: "words: whoosh, soft · meaning rank 2". */
  why: string;
}

export interface LibrarySearchResult {
  /** What actually ran. */
  ran: LibrarySearchMode;
  requested: LibrarySearchMode;
  modelId?: string;
  candidates: LibrarySearchCandidate[];
  /** Entries that could answer (0 = a true miss). */
  poolSize: number;
  /** Why Smart fell back to Basic for this call. */
  degraded?: string;
  vectors?: { ready: number; total: number };
}

export interface LibrarySearchStatus {
  /** Effective. */
  mode: LibrarySearchMode;
  choice: LibrarySearchChoice;
  modelId: string;
  modelDownloaded: boolean;
  modelBytes: number;
  vectors: { ready: number; total: number; building: boolean };
}
