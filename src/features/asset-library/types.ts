import type { TreeNode } from '@shared/ipc/types';
import type { LibraryAssetKind } from '@shared/types/asset-library';

/** The library kind from the one extension table (src/shared/media-kinds.ts). */
export type AssetCategory = LibraryAssetKind;

export interface AssetEntry {
  // Underlying tree node from FILE_LIST. Always either a file or folder; we only
  // ever show immediate children of currentPath in the grid, never descend through
  // the tree object itself (we re-fetch on navigate).
  node: TreeNode;
  category: AssetCategory;
  ext: string;
}

export type ViewMode = 'grid' | 'list';
