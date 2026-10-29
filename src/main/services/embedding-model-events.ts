// "An embedding model arrived on disk / was deleted" — told by the embedding download / delete handlers
// (`ipc/embedding-handlers.ts`) to main-side users: library search starts its first full vector build right after
// its model downloads (LIBRARY_SEARCH_DESIGN.md §5 (3)) and pushes its new status. A listener that throws is contained.

export interface EmbeddingModelChange {
  modelId: string;
  change: 'downloaded' | 'deleted';
}

type EmbeddingModelListener = (change: EmbeddingModelChange) => void;

const listeners = new Set<EmbeddingModelListener>();

/** Subscribe; returns the unsubscribe. */
export function onEmbeddingModelChanged(listener: EmbeddingModelListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyEmbeddingModelChanged(change: EmbeddingModelChange): void {
  for (const listener of [...listeners]) {
    try {
      listener(change);
    } catch {
      // The download / delete already succeeded; a listener's failure is its own.
    }
  }
}
