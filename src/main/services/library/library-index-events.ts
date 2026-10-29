// "The library index was just written" — one choke point for every index write (upsert, reconcile, description /
// tags set, back-fill), so library search can keep its vector cache fresh in the background
// (LIBRARY_SEARCH_DESIGN.md §5 (2)). Listeners run after the file is in place; one that throws is contained and
// never fails the write. Nothing listens until library search is first used.

type IndexWrittenListener = (root: string) => void;

const listeners = new Set<IndexWrittenListener>();

/** Subscribe; returns the unsubscribe. */
export function onLibraryIndexWritten(listener: IndexWrittenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by `writeIndex` once the new index is on disk. */
export function notifyLibraryIndexWritten(root: string): void {
  for (const listener of [...listeners]) {
    try {
      listener(root);
    } catch {
      // A listener's failure is its own; the index write already succeeded.
    }
  }
}
