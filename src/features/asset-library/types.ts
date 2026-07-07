import type { TreeNode } from '@shared/ipc/types';

export type AssetCategory =
  | 'video'
  | 'audio'
  | 'image'
  | 'model3d'
  | 'font'
  | 'data'
  | 'other';

export interface AssetEntry {
  // Underlying tree node from FILE_LIST. Always either a file or folder; we only
  // ever show immediate children of currentPath in the grid, never descend through
  // the tree object itself (we re-fetch on navigate).
  node: TreeNode;
  category: AssetCategory;
  ext: string;
}

export type ViewMode = 'grid' | 'list';
