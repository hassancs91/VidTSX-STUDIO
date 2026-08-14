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

// ─── Brands (ASSET_LIBRARY_DESIGN.md L3, TSX_SHOTS_DESIGN.md D11) ───

/** CSS color strings — hex or any valid CSS color, injected verbatim. */
export interface StudioBrandPalette {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
}

/**
 * One brand, stored as `brands/<id>/brand.json` inside the assets root —
 * a real folder, visible in the Assets screen. `id` IS the folder slug
 * (folder-as-truth, like project ids). Multiple brands; `defaultBrandId`
 * in Studio settings is copied into `project.settings.brandId` at project
 * creation (explicit snapshot — changing the default never restyles
 * existing projects).
 */
export interface StudioBrand {
  id: string;
  name: string;
  palette: StudioBrandPalette;
  /** Google/system font family names (v1); local font files are v2. */
  fonts: { display: string; body?: string };
  /** Library-relative paths of logo assets. Consumed by shots in D12. */
  logoRefs: string[];
  /** Free text, injected verbatim into generation prompts (logo placement, tone). */
  styleNotes?: string;
  createdAt: string;
  updatedAt: string;
}
