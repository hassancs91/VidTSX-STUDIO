// Reuse before generate (E3, on the shared library search — LIBRARY_SEARCH_DESIGN.md §6 / §8.1): generate_sfx /
// generate_music search the library BEFORE their provider check, so a sound the library has is placed from it — no
// key, no cost, no engine, no normalizer. Retrieval is wide and humble; the assistant picks:
// - the answer claims nothing: a neutral header naming what ran (LS-r6), up to 20 of E2's `formatLibraryRow` rows in the search's order (the
//   order is not a ranking of fit), the place / `force: true` line; a `degraded` search adds "Searched by words
//   only: <reason>". No "already has", no "matching", no labels — in any mode.
// - nothing fits (§6): any candidate → the answer, and generating needs `force: true`; no candidate — an empty pool
//   (Smart: no audio of that class, or none long enough) or Basic's true miss — → null, and the tool generates.
// - an unreadable index never blocks a generation (null).

import type { LibraryIndexEntry } from '../../../../shared/types/asset-library';
import type { LibrarySearchMode, LibrarySearchResult } from '../../../../shared/types/library-search';
import { getLibraryRoot } from '../../library/library-paths';
import { loadIndex } from '../../library/library-store';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import { formatLibraryRow } from './library-listing';
import { degradedLineOf, searchMethodOf } from './library-search-listing';
import { toolLibrarySearch } from './tool-library-search';

export type ReuseToolName = 'generate_sfx' | 'generate_music';

export interface ReuseSearchOptions {
  soundClass: 'sfx' | 'music';
  minDurationSec?: number;
}

/** At most this many library sounds answer a generate call (design §8.1). */
export const REUSE_ANSWER_LIMIT = 20;

export interface ReuseAnswer {
  text: string;
  result: LibrarySearchResult;
}

/** The header names what ran (LS-r6): "(words + meaning)" for Smart, "(words only)" for Basic. */
export const reuseHeaderOf = (prompt: string, ran: LibrarySearchMode): string =>
  `Library sounds that may fit "${prompt}" — found by search (${searchMethodOf(ran)}), NOT checked; nothing was generated (no cost). Read each description and pick by plain meaning: a clip fits only if it IS the sound asked for — a loosely related or merely similar clip is not a fit.`;

export const reusePlaceLineOf = (toolName: ReuseToolName): string =>
  `If one fits, place it with insert_asset(assetId: "${LIBRARY_REF_PREFIX}<path>", lane: "audio", at: …). If none fits, call ${toolName} again with force: true.`;

/** The answer that replaces a generation, or null when the search found nothing to show. */
export function formatReuseAnswer(
  result: LibrarySearchResult,
  entries: LibraryIndexEntry[],
  prompt: string,
  toolName: ReuseToolName,
): string | null {
  const byPath = new Map(entries.map((entry) => [entry.relPath, entry]));
  const rows = result.candidates
    .map((c) => byPath.get(c.relPath))
    .filter((entry): entry is LibraryIndexEntry => entry !== undefined)
    .map((entry) => formatLibraryRow(entry, 'audio', LIBRARY_REF_PREFIX));
  if (rows.length === 0) return null;
  const degraded = result.degraded ? [degradedLineOf(result.degraded)] : [];
  return [reuseHeaderOf(prompt, result.ran), ...degraded, ...rows, reusePlaceLineOf(toolName)].join('\n');
}

/** The library sounds that may fit a prompt, or null (nothing to show, or the index cannot be read) → generate. */
export async function libraryReuseAnswer(
  toolName: ReuseToolName,
  prompt: string,
  opts: ReuseSearchOptions,
): Promise<ReuseAnswer | null> {
  let entries: LibraryIndexEntry[];
  let result: LibrarySearchResult;
  try {
    entries = (await loadIndex(getLibraryRoot())).entries;
    result = await toolLibrarySearch(
      {
        query: prompt,
        kinds: ['audio'],
        soundClass: opts.soundClass,
        ...(opts.minDurationSec !== undefined ? { minDurationSec: opts.minDurationSec } : {}),
        limit: REUSE_ANSWER_LIMIT,
      },
      entries,
    );
  } catch {
    return null;
  }
  const text = formatReuseAnswer(result, entries, prompt, toolName);
  return text ? { text, result } : null;
}
