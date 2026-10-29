// The app's library-search runtime (LIBRARY_SEARCH_DESIGN.md §7 / §10): the real deps behind `LibrarySearchRuntime`
// — the utilityProcess engine host, the settings KV store, the library index, the embedding catalog / models folder.
// Created on first use (the `lazily` registration, step d's agent tools) — never at startup: nothing spawns, no model
// or vector file is read until a search or status call needs it. Push events go to `onLibrarySearchEvent` listeners
// (the IPC registration broadcasts them), so subscribing creates nothing.

import path from 'path';
import type { LibrarySearchEvent } from '../../../shared/ipc/types/library-search';
import { EMBEDDING_MODEL_CATALOG } from '../../../embedding-engine/model-registry';
import { forkLibrarySearchWorker } from '../../../library-search-engine/electron-fork';
import { LibrarySearchEngine } from '../../../library-search-engine/search-engine';
import { vectorFilePath } from '../../../library-search-engine/vector-store';
import { logEngine } from '../../../logging/log-engine';
import { getTempDir } from '../../utils/paths';
import { onEmbeddingModelChanged } from '../embedding-model-events';
import { getEmbeddingModelDir, isEmbeddingModelDownloaded } from '../embedding-models';
import { onLibraryIndexWritten } from '../library/library-index-events';
import { getLibraryRoot } from '../library/library-paths';
import { loadIndex } from '../library/library-store';
import { LibrarySearchRuntime } from './search-runtime';
import { getLibrarySearchSettings, setLibrarySearchSettings } from './search-settings';

const log = logEngine.createLogger('LibrarySearch');

const eventListeners = new Set<(event: LibrarySearchEvent) => void>();
let runtime: LibrarySearchRuntime | null = null;

/** Subscribe to the push events without creating the runtime; returns the unsubscribe. */
export function onLibrarySearchEvent(listener: (event: LibrarySearchEvent) => void): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

function emit(event: LibrarySearchEvent): void {
  for (const listener of [...eventListeners]) {
    try {
      listener(event);
    } catch (err) {
      log.warn('Library search event listener failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

function createEngine(onVectors: (state: { ready: number; total: number; building: boolean }) => void): LibrarySearchEngine {
  return new LibrarySearchEngine({
    fork: forkLibrarySearchWorker,
    model: () => {
      const { modelId } = getLibrarySearchSettings();
      if (!isEmbeddingModelDownloaded(modelId)) return null;
      // transformers.js never writes a cache here (local files only); it must never point into node_modules.
      return { modelId, modelDir: getEmbeddingModelDir(modelId), cacheDir: path.join(getTempDir(), 'library-search', 'tf-cache') };
    },
    vectorFile: (modelId) => vectorFilePath(getLibraryRoot(), modelId),
    onVectors,
  });
}

/** The one runtime; the first call builds it (no spawn) and starts listening to index writes / model downloads. */
export function getLibrarySearchRuntime(): LibrarySearchRuntime {
  if (runtime) return runtime;
  const created = new LibrarySearchRuntime({
    createEngine,
    loadEntries: async () => (await loadIndex(getLibraryRoot())).entries,
    libraryRoot: getLibraryRoot,
    readSettings: getLibrarySearchSettings,
    writeSettings: setLibrarySearchSettings,
    isModelDownloaded: isEmbeddingModelDownloaded,
    modelBytes: (modelId) => EMBEDDING_MODEL_CATALOG.find((m) => m.id === modelId)?.sizeBytes ?? null,
    emit,
    onError: (err) => log.warn('Library search vector sync failed', { error: err instanceof Error ? err.message : String(err) }),
  });
  runtime = created;
  onLibraryIndexWritten((root) => created.indexWritten(root));
  onEmbeddingModelChanged((change) => created.modelChanged(change));
  log.info('Library search runtime created');
  return created;
}

/** The `lazily` initializer for the library-search IPC handlers. */
export async function ensureLibrarySearch(): Promise<void> {
  getLibrarySearchRuntime();
}
