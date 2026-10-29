// Library search IPC handlers (LIBRARY_SEARCH_DESIGN.md §10). Every body is in try/catch and answers a typed error —
// an invoke never rejects. Registered with `lazily` (registrations/library-search.ts); the work is the runtime's.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  LibrarySearchQueryRequest,
  LibrarySearchResponse,
  LibrarySearchSettingsSetRequest,
  LibrarySearchSettingsSetResponse,
  LibrarySearchStatusResponse,
} from '../../shared/ipc/types/library-search';
import { getLibrarySearchRuntime } from '../services/library-search/search-app';
import { DEFAULT_SEARCH_MODEL_ID } from '../services/library-search/search-settings';

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err)) || 'library search failed';

/** The status a failed status call answers: Basic, nothing known, plus the reason. */
function unavailableStatus(error: string): LibrarySearchStatusResponse {
  return {
    mode: 'basic',
    choice: 'auto',
    modelId: DEFAULT_SEARCH_MODEL_ID,
    modelDownloaded: false,
    modelBytes: 0,
    vectors: { ready: 0, total: 0, building: false },
    error,
  };
}

export async function handleLibrarySearch(
  _event: IpcMainInvokeEvent,
  req: LibrarySearchQueryRequest,
): Promise<LibrarySearchResponse> {
  try {
    if (!req || typeof req.query !== 'string') return { ok: false, error: 'A library search needs a query' };
    return { ok: true, result: await getLibrarySearchRuntime().search(req) };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

export async function handleLibrarySearchStatus(): Promise<LibrarySearchStatusResponse> {
  try {
    return getLibrarySearchRuntime().status();
  } catch (err) {
    return unavailableStatus(messageOf(err));
  }
}

export async function handleLibrarySearchSettingsSet(
  _event: IpcMainInvokeEvent,
  req: LibrarySearchSettingsSetRequest,
): Promise<LibrarySearchSettingsSetResponse> {
  try {
    return getLibrarySearchRuntime().setSettings(req ?? {});
  } catch (err) {
    const error = messageOf(err);
    try {
      return { ...getLibrarySearchRuntime().status(), error };
    } catch {
      return unavailableStatus(error);
    }
  }
}
