// Main's side of the vector cache (LIBRARY_SEARCH_DESIGN.md §5): the items the engine keeps vectors for (every
// library entry as `{ relPath, text, textHash }` — no floats in main), the debounced background sync after index
// writes (upsert, reconcile, description / tags set), and the full build right after the model download. Runs are
// coalesced (a request during a run → one more pass after it), skipped while Smart is off, and never throw into
// the caller (an index write must not fail because the engine did): errors go to `onError`.

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { semanticItemOf } from './item-text';
import { searchPool } from './search-pool';
import type { SemanticItem } from './types';

export const SYNC_DEBOUNCE_MS = 2_000;

export interface VectorSyncDeps {
  engine: { sync(items: SemanticItem[], prune: boolean): Promise<{ ready: number; total: number }> };
  loadEntries: () => Promise<LibraryIndexEntry[]> | LibraryIndexEntry[];
  /** True when Smart is the effective mode and the model is on disk. */
  enabled: () => boolean;
  debounceMs?: number;
  onError?: (err: unknown) => void;
}

/** Every entry any search can answer with (no kind / class / scope filter), as its semantic item. */
export function syncItemsOf(entries: LibraryIndexEntry[]): SemanticItem[] {
  return searchPool(entries, { query: '' }).map(semanticItemOf);
}

export class VectorSync {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<{ ready: number; total: number } | null> | null = null;
  private again = false;

  constructor(private readonly deps: VectorSyncDeps) {}

  /** After an index write: one sync once writes have been quiet for the debounce period. */
  schedule(): void {
    if (!this.deps.enabled()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.buildNow();
    }, this.deps.debounceMs ?? SYNC_DEBOUNCE_MS);
  }

  /** The full build now (after a download); joins a running one, which then makes one more pass. */
  buildNow(): Promise<{ ready: number; total: number } | null> {
    if (!this.deps.enabled()) return Promise.resolve(null);
    if (this.running) {
      this.again = true;
      return this.running;
    }
    const run = this.run();
    this.running = run;
    void run.finally(() => {
      if (this.running === run) this.running = null;
    });
    return run;
  }

  isRunning(): boolean {
    return this.running !== null;
  }

  private async run(): Promise<{ ready: number; total: number } | null> {
    let result: { ready: number; total: number } | null = null;
    try {
      do {
        this.again = false;
        const entries = await this.deps.loadEntries();
        result = await this.deps.engine.sync(syncItemsOf(entries), true);
      } while (this.again && this.deps.enabled());
      return result;
    } catch (err) {
      this.deps.onError?.(err);
      return null;
    }
  }
}
