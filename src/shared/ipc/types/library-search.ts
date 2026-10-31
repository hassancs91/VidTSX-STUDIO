// Library search IPC (LIBRARY_SEARCH_DESIGN.md §10). The request / result / status shapes live in
// `shared/types/library-search.ts`; these are the wire envelopes. The model download reuses
// `embedding:model:download` / `embedding:download:progress`.

import type {
  LibrarySearchChoice,
  LibrarySearchRequest,
  LibrarySearchResult,
  LibrarySearchStatus,
} from '../../types/library-search';

/** `library:search` — a failure is typed, never a rejected invoke. */
export type LibrarySearchQueryRequest = LibrarySearchRequest;
export type LibrarySearchResponse = { ok: true; result: LibrarySearchResult } | { ok: false; error: string };

/** `library:search:status` — `{}` in; on a failure the status is Basic and carries `error`. */
export type LibrarySearchStatusRequest = Record<string, never>;
export interface LibrarySearchStatusResponse extends LibrarySearchStatus {
  error?: string;
}

/** `library:search:settings:set` — a field left out is left alone; `'auto'` clears the stored choice. */
export interface LibrarySearchSettingsSetRequest {
  mode?: LibrarySearchChoice;
  modelId?: string;
}
/** The new status; a refused patch answers the unchanged status with `error`. */
export type LibrarySearchSettingsSetResponse = LibrarySearchStatusResponse;

/** `library:search:event` (push): the background build's progress, and status changes (setting, download, delete). */
export type LibrarySearchEvent =
  | { type: 'vectors'; ready: number; total: number; building: boolean }
  | { type: 'status'; status: LibrarySearchStatus };
