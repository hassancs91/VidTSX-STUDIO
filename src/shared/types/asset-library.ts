import type { StudioAssetProbe } from './studio';

/**
 * Asset-library index overlay — the one piece of metadata the disk can't
 * hold (docs/studio/ASSET_LIBRARY_DESIGN.md L1). Disk is truth for files
 * and folders; this index carries descriptions, brand tags, and origin,
 * keyed by library-relative path and re-keyed by content hash when files
 * move. Lives at `<assetsRoot>/.vidtsx/index.json` (dot-folder so the
 * Assets grid stays clean).
 *
 * (Named asset-library.ts — types/library.ts is the Creator's project
 * library, a different domain.)
 */

export type LibraryAssetOrigin = 'imported' | 'generated' | 'captured';

export interface LibraryIndexEntry {
  /** Key: path relative to the assets root, POSIX separators. */
  relPath: string;
  /**
   * hashFileHead (sha1 of first 1 MiB + size) — MUST stay the same
   * algorithm projects use (media-import.ts), or library↔project
   * matching can never work. Undefined when the file was unreadable.
   */
  hash?: string;
  /** The human/AI-authored signal the agent reads (L2). */
  description?: string;
  /** Optional brand tag (L3) — orthogonal to folder structure. */
  brandId?: string;
  origin: LibraryAssetOrigin;
  addedAt: string;
  /** Cached media probe; refreshed on mtime change. Filled lazily. */
  probe?: StudioAssetProbe;
  /** Change-detection bookkeeping (internal to the reconcile scan). */
  size?: number;
  mtimeMs?: number;
}

/**
 * A deleted file's metadata, preserved so a transient state (cloud sync,
 * pending move) or re-import of the same content can resurrect its
 * description instead of losing it.
 */
export interface LibraryTombstone {
  relPath: string;
  hash?: string;
  description?: string;
  brandId?: string;
  origin: LibraryAssetOrigin;
  addedAt: string;
  missingSince: string;
}

export interface LibraryIndexFile {
  version: 1;
  entries: LibraryIndexEntry[];
  tombstones: LibraryTombstone[];
}

/** Per-folder recursive sizes (bytes), keyed by POSIX rel path; '' = root. */
export interface LibrarySizes {
  total: number;
  folders: Record<string, number>;
}
