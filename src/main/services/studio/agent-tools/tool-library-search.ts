// The Studio agent tools' way into the one library search (LIBRARY_SEARCH_DESIGN.md §8): the app's runtime
// (`library-search/search-app.ts` — Smart through the engine host, and Basic with its own `degraded` reason when the
// engine is unavailable: model loading, a timeout, a dead child, a model being removed). If the runtime itself
// cannot answer (its settings store unreadable, …) the tools still search: Basic over the index entries they have
// already read, `degraded: 'search engine unavailable'`. Tests mock `search-app`.

import type { LibraryIndexEntry } from '../../../../shared/types/asset-library';
import type { LibrarySearchRequest, LibrarySearchResult } from '../../../../shared/types/library-search';
import { searchLibrary } from '../../library-search/library-search';
import { getLibrarySearchRuntime } from '../../library-search/search-app';
import { DEFAULT_SEARCH_MODEL_ID } from '../../library-search/search-settings';

export async function toolLibrarySearch(request: LibrarySearchRequest, entries: LibraryIndexEntry[]): Promise<LibrarySearchResult> {
  try {
    return await getLibrarySearchRuntime().search(request);
  } catch {
    const basic = await searchLibrary(request, {
      loadEntries: async () => entries,
      settings: () => ({ choice: 'basic', modelId: DEFAULT_SEARCH_MODEL_ID, modelDownloaded: false }),
    });
    return { ...basic, degraded: 'search engine unavailable' };
  }
}
