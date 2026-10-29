// Main's library-search runtime (LIBRARY_SEARCH_DESIGN.md §4 / §5 / §7 / §10): one object behind the IPC handlers
// and (step d) the agent tools. It owns the engine host, the vector sync and the push events; everything outside
// (the engine, the settings store, the index, the catalog) is injected, so its tests spawn nothing.
// - status: the effective mode (§4), the model's state, the last known vector counts. The first status call of a
//   session with Smart on starts the background sync (it opens the vector file and embeds only what is missing).
// - search: `searchLibrary` with the engine as the semantic ranker; a Smart result short of vectors starts the build.
// - the build after the search model downloads (§5 (3)), a debounced sync after index writes (§5 (2)).
// Constructing it does nothing: no spawn, no model read, no vector read (§7).

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibrarySearchEvent } from '../../../shared/ipc/types/library-search';
import type {
  LibrarySearchChoice,
  LibrarySearchRequest,
  LibrarySearchResult,
  LibrarySearchStatus,
} from '../../../shared/types/library-search';
import type { EmbeddingModelChange } from '../embedding-model-events';
import { resolveSearchMode, searchLibrary } from './library-search';
import type { StoredSearchSettings } from './search-settings';
import type { SemanticItem, SemanticRanker } from './types';
import { VectorSync } from './vector-sync';

export interface RuntimeVectors {
  ready: number;
  total: number;
  building: boolean;
}

/** What the runtime needs of the engine host (`LibrarySearchEngine` in the app). */
export interface RuntimeEngine extends SemanticRanker {
  sync(items: SemanticItem[], prune: boolean): Promise<{ ready: number; total: number }>;
  isBuilding(): boolean;
}

export interface SearchSettingsPatch {
  mode?: LibrarySearchChoice;
  modelId?: string;
}

export interface LibrarySearchRuntimeDeps {
  /** Builds the engine host; `onVectors` receives its build progress. */
  createEngine: (onVectors: (state: RuntimeVectors) => void) => RuntimeEngine;
  loadEntries: () => Promise<LibraryIndexEntry[]>;
  libraryRoot: () => string;
  readSettings: () => StoredSearchSettings;
  writeSettings: (patch: SearchSettingsPatch) => StoredSearchSettings;
  isModelDownloaded: (modelId: string) => boolean;
  /** The catalog's size for a model, or null for an id the catalog does not know. */
  modelBytes: (modelId: string) => number | null;
  emit: (event: LibrarySearchEvent) => void;
  syncDebounceMs?: number;
  onError?: (err: unknown) => void;
}

export class LibrarySearchRuntime {
  private readonly engine: RuntimeEngine;
  private readonly sync: VectorSync;
  /** The last counts the engine reported, for the (root, model) they belong to. */
  private vectors: { key: string; ready: number; total: number } | null = null;

  constructor(private readonly deps: LibrarySearchRuntimeDeps) {
    this.engine = deps.createEngine((state) => this.vectorsChanged(state));
    this.sync = new VectorSync({
      engine: this.engine,
      loadEntries: deps.loadEntries,
      enabled: () => this.smartOn(),
      debounceMs: deps.syncDebounceMs,
      onError: deps.onError,
    });
  }

  status(): LibrarySearchStatus {
    const s = this.deps.readSettings();
    const modelDownloaded = this.deps.isModelDownloaded(s.modelId);
    const mode = resolveSearchMode(s.choice, modelDownloaded).run;
    const known = this.vectors && this.vectors.key === this.keyOf(s.modelId) ? this.vectors : null;
    if (!known && mode !== 'basic' && !this.isBuilding()) this.buildInBackground();
    return {
      mode,
      choice: s.choice,
      modelId: s.modelId,
      modelDownloaded,
      modelBytes: this.deps.modelBytes(s.modelId) ?? 0,
      vectors: { ready: known?.ready ?? 0, total: known?.total ?? 0, building: this.isBuilding() },
    };
  }

  async search(request: LibrarySearchRequest): Promise<LibrarySearchResult> {
    const result = await searchLibrary(request, {
      loadEntries: this.deps.loadEntries,
      settings: () => {
        const s = this.deps.readSettings();
        return { choice: s.choice, modelId: s.modelId, modelDownloaded: this.deps.isModelDownloaded(s.modelId) };
      },
      semantic: this.engine,
    });
    if (result.vectors && result.vectors.ready < result.vectors.total && !this.isBuilding()) this.buildInBackground();
    return result;
  }

  /** Stores the patch (an unknown model id is refused), pushes and returns the new status. */
  setSettings(patch: SearchSettingsPatch): LibrarySearchStatus {
    if (patch.modelId !== undefined && this.deps.modelBytes(patch.modelId) === null) {
      throw new Error(`Unknown embedding model: ${patch.modelId}`);
    }
    this.deps.writeSettings(patch);
    return this.pushStatus();
  }

  /** The embedding download / delete handlers' news (`embedding-model-events.ts`). */
  modelChanged(change: EmbeddingModelChange): void {
    if (change.modelId !== this.deps.readSettings().modelId) return;
    if (change.change === 'downloaded' && this.smartOn()) this.buildInBackground();
    this.pushStatus();
  }

  /** `library-index-events.ts`: a write in the current library → a debounced sync (skipped while Smart is off). */
  indexWritten(root: string): void {
    if (root === this.deps.libraryRoot()) this.sync.schedule();
  }

  private pushStatus(): LibrarySearchStatus {
    const status = this.status();
    this.deps.emit({ type: 'status', status });
    return status;
  }

  private smartOn(): boolean {
    const s = this.deps.readSettings();
    return resolveSearchMode(s.choice, this.deps.isModelDownloaded(s.modelId)).run !== 'basic';
  }

  private isBuilding(): boolean {
    return this.sync.isRunning() || this.engine.isBuilding();
  }

  private keyOf(modelId: string): string {
    return `${this.deps.libraryRoot()}\n${modelId}`;
  }

  private buildInBackground(): void {
    void this.buildAndRecord();
  }

  /** VectorSync never rejects (its errors go to `onError`); a null is a skipped or failed run. */
  private async buildAndRecord(): Promise<void> {
    const counts = await this.sync.buildNow();
    if (counts) this.vectorsChanged({ ...counts, building: this.isBuilding() });
  }

  private vectorsChanged(state: RuntimeVectors): void {
    this.vectors = { key: this.keyOf(this.deps.readSettings().modelId), ready: state.ready, total: state.total };
    this.deps.emit({ type: 'vectors', ready: state.ready, total: state.total, building: state.building });
  }
}
