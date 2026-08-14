import type { LibraryIndexEntry, LibrarySizes } from '../../types/asset-library';

// ─── Asset library — index overlay, sizes, root override ───

/** library:index:get — scans the assets root, reconciles the index, returns it. */
export interface LibraryIndexGetResponse {
  success: boolean;
  /** Effective assets root (override honored), absolute path. */
  root?: string;
  entries?: LibraryIndexEntry[];
  error?: string;
}

/** library:description:set — set (or clear with '') one asset's description. */
export interface LibraryDescriptionSetRequest {
  relPath: string;
  description: string;
}

export interface LibraryDescriptionSetResponse {
  success: boolean;
  error?: string;
}

/** library:sizes:get — per-folder recursive sizes + total for the assets root. */
export interface LibrarySizesGetResponse {
  success: boolean;
  sizes?: LibrarySizes;
  error?: string;
}

/** library:root:get — effective assets root + whether it's an override. */
export interface LibraryRootGetResponse {
  success: boolean;
  root?: string;
  defaultRoot?: string;
  isOverride?: boolean;
  error?: string;
}

/** library:root:set — set or clear (null) the assets-root override. */
export interface LibraryRootSetRequest {
  root: string | null;
}

export interface LibraryRootSetResponse {
  success: boolean;
  root?: string;
  error?: string;
}
