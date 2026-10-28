import type { TreeNode } from '@shared/ipc/types';
import type { LibraryAssetOrigin } from '@shared/types/asset-library';
import type { AssetCategory, AssetEntry } from '../types';
import { classifyAsset } from './file-type';

/**
 * Client-side search + type filter over the listed subtree
 * (ASSET_LIBRARY_DESIGN.md L4) — name + description + tags + sound category
 * matching, no search infra. The breadcrumb is the scope: searching at the
 * root searches the whole library. Pure functions, unit-tested without IPC.
 */

export type CategoryFilter = 'all' | 'video' | 'audio' | 'image' | 'other';

/** A chip from the details panel (E3): one origin, or one tag (case-insensitive). */
export type ChipFilter = { origin: LibraryAssetOrigin } | { tag: string };

/** The index fields search reads — a slice of `LibraryIndexEntry`. */
export interface SearchableMeta {
  description?: string;
  tags?: string[];
  origin?: LibraryAssetOrigin;
  audio?: { category?: string };
}

const OTHER_CATEGORIES: AssetCategory[] = ['model3d', 'font', 'data', 'other'];

export function matchesCategory(category: AssetCategory, filter: CategoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'other') return OTHER_CATEGORIES.includes(category);
  return category === filter;
}

/** No chip matches everything; a chip never matches an unindexed file. */
export function matchesChip(meta: SearchableMeta | undefined, chip: ChipFilter | null): boolean {
  if (chip === null) return true;
  if (!meta) return false;
  if ('origin' in chip) return meta.origin === chip.origin;
  const want = chip.tag.toLowerCase();
  return (meta.tags ?? []).some((tag) => tag.toLowerCase() === want);
}

export function sameChip(a: ChipFilter | null, b: ChipFilter | null): boolean {
  if (a === null || b === null) return a === b;
  if ('origin' in a) return 'origin' in b && a.origin === b.origin;
  return 'tag' in b && a.tag.toLowerCase() === b.tag.toLowerCase();
}

/** The removable pill's text by the search bar. */
export function chipLabel(chip: ChipFilter): string {
  return 'origin' in chip ? `Origin: ${chip.origin}` : `Tag: ${chip.tag}`;
}

/** An entry's chips: the origin first, then its tags (deduped case-insensitively, blanks dropped). */
export function chipsOf(meta: { origin: LibraryAssetOrigin; tags?: string[] }): ChipFilter[] {
  const chips: ChipFilter[] = [{ origin: meta.origin }];
  const seen = new Set<string>();
  for (const raw of meta.tags ?? []) {
    const tag = raw.trim();
    if (tag === '' || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    chips.push({ tag });
  }
  return chips;
}

/** Flatten a listed subtree to file entries, skipping dot files/folders. */
export function flattenAssetFiles(nodes: TreeNode[]): AssetEntry[] {
  const out: AssetEntry[] = [];
  for (const node of nodes) {
    if (node.name.startsWith('.')) continue;
    if (node.type === 'folder') {
      out.push(...flattenAssetFiles(node.children));
    } else {
      const { category, ext } = classifyAsset(node.name);
      out.push({ node, category, ext });
    }
  }
  return out;
}

/** Every query word must appear in the name, description, tags or sound category (one word = a substring, as before). */
function matchesQuery(name: string, meta: SearchableMeta | undefined, words: string[]): boolean {
  const haystack = [name, meta?.description ?? '', ...(meta?.tags ?? []), meta?.audio?.category ?? '']
    .join('\n')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function filterAssets(
  entries: AssetEntry[],
  query: string,
  category: CategoryFilter,
  metaOf: (path: string) => SearchableMeta | undefined,
  chip: ChipFilter | null = null
): AssetEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (entry.node.type === 'folder') return false;
    if (!matchesCategory(entry.category, category)) return false;
    if (words.length === 0 && chip === null) return true;
    const meta = metaOf(entry.node.path);
    if (!matchesChip(meta, chip)) return false;
    return words.length === 0 || matchesQuery(entry.node.name, meta, words);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = '';
  for (const u of units) {
    value /= 1024;
    unit = u;
    if (value < 1024) break;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}
