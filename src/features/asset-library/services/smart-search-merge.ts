import type { AssetEntry } from '../types';
import { matchesCategory, matchesChip, type CategoryFilter, type ChipFilter, type SearchableMeta } from './asset-search';
import { SMART_LIMIT } from './smart-search-request';

export interface SmartMergeInput {
  /** The listed subtree, flattened — the breadcrumb's scope (`flattenAssetFiles`). */
  flat: AssetEntry[];
  /** Today's filter over `flat` (`filterAssets`: every query word + category + chip). */
  filtered: AssetEntry[];
  /** The service's candidates for THIS query, in its order; null = Basic, or no answer yet. */
  smart: string[] | null;
  /** An entry's library-relative path (the service's key). */
  relPathOf: (entry: AssetEntry) => string;
  category: CategoryFilter;
  chip: ChipFilter | null;
  metaOf: (absPath: string) => SearchableMeta | undefined;
}

/**
 * The Assets grid in Smart (LIBRARY_SEARCH_DESIGN.md §8.3): the service's top 20 in its
 * order, then any other every-word matches today's filter finds; the category and a chip
 * still narrow the service's candidates. With no Smart answer the grid is today's filter,
 * unchanged (the same array). Candidates outside the listed subtree are dropped; no entry
 * appears twice. Pure.
 */
export function mergeSmartResults(input: SmartMergeInput): AssetEntry[] {
  if (input.smart === null) return input.filtered;
  const byRelPath = new Map(input.flat.map((entry) => [input.relPathOf(entry), entry]));
  const seen = new Set<string>();
  const out: AssetEntry[] = [];
  for (const relPath of input.smart.slice(0, SMART_LIMIT)) {
    const entry = byRelPath.get(relPath);
    if (!entry || seen.has(relPath) || entry.node.type === 'folder') continue;
    if (!matchesCategory(entry.category, input.category)) continue;
    if (!matchesChip(input.metaOf(entry.node.path), input.chip)) continue;
    seen.add(relPath);
    out.push(entry);
  }
  for (const entry of input.filtered) {
    const relPath = input.relPathOf(entry);
    if (seen.has(relPath)) continue;
    seen.add(relPath);
    out.push(entry);
  }
  return out;
}
