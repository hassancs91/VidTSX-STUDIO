import type { TreeNode } from '@shared/ipc/types';
import type { AssetCategory, AssetEntry } from '../types';
import { classifyAsset } from './file-type';

/**
 * Client-side search + type filter over the listed subtree
 * (ASSET_LIBRARY_DESIGN.md L4) — name + description matching, no search
 * infra. The breadcrumb is the scope: searching at the root searches the
 * whole library. Pure functions, unit-tested without IPC.
 */

export type CategoryFilter = 'all' | 'video' | 'audio' | 'image' | 'other';

const OTHER_CATEGORIES: AssetCategory[] = ['model3d', 'font', 'data', 'other'];

export function matchesCategory(category: AssetCategory, filter: CategoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'other') return OTHER_CATEGORIES.includes(category);
  return category === filter;
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

export function filterAssets(
  entries: AssetEntry[],
  query: string,
  category: CategoryFilter,
  descriptionOf: (path: string) => string | undefined
): AssetEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (entry.node.type === 'folder') return false;
    if (!matchesCategory(entry.category, category)) return false;
    if (needle === '') return true;
    if (entry.node.name.toLowerCase().includes(needle)) return true;
    const description = descriptionOf(entry.node.path);
    return description !== undefined && description.toLowerCase().includes(needle);
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
