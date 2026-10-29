// "An embedding model arrived on disk / was deleted" — told by the embedding download / delete handlers
// (`ipc/embedding-handlers.ts`) to main-side users: library search starts its first full vector build right after
// its model downloads (LIBRARY_SEARCH_DESIGN.md §5 (3)) and pushes its new status. A listener that throws is contained.
// Before a delete, the handler awaits the before-delete hooks (library search unloads its engine child first, LS-r3).

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

type BeforeDeleteHook = (modelId: string) => Promise<void> | void;

const beforeDeleteHooks = new Set<BeforeDeleteHook>();

/** Work that must finish before a model's files are deleted (library search stops its engine child — LS-r3); returns the unregister. */
export function onBeforeEmbeddingModelDelete(hook: BeforeDeleteHook): () => void {
  beforeDeleteHooks.add(hook);
  return () => {
    beforeDeleteHooks.delete(hook);
  };
}

/** The delete handler awaits this before deleting; a hook that throws or rejects never blocks the delete. */
export async function runBeforeEmbeddingModelDelete(modelId: string): Promise<void> {
  await Promise.all(
    [...beforeDeleteHooks].map(async (hook) => {
      try {
        await hook(modelId);
      } catch {
        // Contained: the delete goes ahead (it reports its own error if a handle still blocks it).
      }
    }),
  );
}
