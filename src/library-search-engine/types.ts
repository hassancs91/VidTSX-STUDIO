// The library-search engine's protocol (LIBRARY_SEARCH_DESIGN.md §3 / §5 / §7): main (search-engine.ts, the host)
// ↔ the utilityProcess child (worker.ts → engine-core.ts). The child owns the model, the vector file and the cosine
// ranking; main sends the items (relPath + item text + textHash) and gets back an order.

/** The model to load: its catalog id, its folder on disk, and a scratch folder for transformers.js caches. */
export interface EngineModel {
  modelId: string;
  modelDir: string;
  /** Never inside node_modules (embedder.ts refuses it). */
  cacheDir: string;
}

/** One library entry as the engine sees it — the same shape as the service's `SemanticItem`. */
export interface EngineItem {
  relPath: string;
  text: string;
  textHash: string;
}

export interface EngineVectors {
  ready: number;
  total: number;
}

export interface EngineRanked {
  relPath: string;
  cosine: number;
}

export type SearchWorkerRequest =
  | { type: 'rank'; requestId: string; model: EngineModel; vectorFile: string; query: string; items: EngineItem[] }
  | { type: 'sync'; requestId: string; model: EngineModel; vectorFile: string; items: EngineItem[]; prune: boolean }
  | { type: 'unload' };

export type SearchWorkerResponse =
  | { type: 'modelLoaded'; modelId: string; loadMs: number }
  | { type: 'rankResult'; requestId: string; ranked: EngineRanked[]; vectors: EngineVectors }
  | { type: 'syncProgress'; requestId: string; ready: number; total: number }
  | { type: 'syncResult'; requestId: string; ready: number; total: number }
  | { type: 'error'; requestId?: string; error: string };

/** The child process as the host needs it (electron-fork.ts adapts Electron's UtilityProcess; tests pass a fake). */
export interface EngineChild {
  postMessage(msg: SearchWorkerRequest): void;
  onMessage(listener: (msg: SearchWorkerResponse) => void): void;
  onExit(listener: (code: number) => void): void;
  kill(): void;
}
