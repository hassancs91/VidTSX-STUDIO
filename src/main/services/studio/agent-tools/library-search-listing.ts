// The search answer lines the Studio tools share (LIBRARY_SEARCH_DESIGN.md §8.1 / §8.2, ruling LS-r6): every header
// names what actually ran — "(words + meaning)" only when the local model took part, "(words only)" when Basic ran
// (an explicit choice or a fallback) — and a `degraded` search adds "Searched by words only: <reason>". The
// `list_assets(scope: "library", query)` listing: that header, then E2's `formatLibraryRow` per candidate in the
// search's order (the order is not a ranking of fit). Retrieval claims nothing: no "matching", no labels.

import type { LibraryIndexEntry, PlayableMediaKind } from '../../../../shared/types/asset-library';
import type { LibrarySearchMode, LibrarySearchResult } from '../../../../shared/types/library-search';
import { isPlayableMediaKind, mediaKindOf } from '../../../../shared/media-kinds';
import { formatLibraryRow } from './library-listing';

/** How a search found its candidates, as the headers print it. */
export const searchMethodOf = (ran: LibrarySearchMode): string => (ran === 'basic' ? 'words only' : 'words + meaning');

export const degradedLineOf = (reason: string): string => `Searched by words only: ${reason}`;

export const rankedHeaderOf = (ran: LibrarySearchMode): string =>
  `Ranked by search (${searchMethodOf(ran)}) — check the descriptions; the order is not a ranking of fit`;

export const noSearchResultLineOf = (query: string, kind?: PlayableMediaKind): string =>
  `The library search found nothing for "${query}"${kind ? ` (kind: ${kind})` : ''}.`;

/** The `list_assets(scope: "library", query)` answer for one search result. */
export function formatLibrarySearchListing(
  result: LibrarySearchResult,
  entries: LibraryIndexEntry[],
  query: string,
  kind: PlayableMediaKind | undefined,
  refPrefix: string,
): string {
  const byPath = new Map(entries.map((entry) => [entry.relPath, entry]));
  const rows: string[] = [];
  for (const candidate of result.candidates) {
    const entry = byPath.get(candidate.relPath);
    const entryKind = entry ? (entry.kind ?? mediaKindOf(entry.relPath)) : undefined;
    if (!entry || !entryKind || !isPlayableMediaKind(entryKind)) continue;
    rows.push(formatLibraryRow(entry, entryKind, refPrefix));
  }
  if (rows.length === 0) return noSearchResultLineOf(query, kind);
  const degraded = result.degraded ? [degradedLineOf(result.degraded)] : [];
  return [rankedHeaderOf(result.ran), ...degraded, ...rows].join('\n');
}
