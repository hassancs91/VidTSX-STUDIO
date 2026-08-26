// The `.vidtsx` project package format (NEXT_FEATURES_DESIGN.md Q7) — the PURE
// half: constants, the manifest shape, and the two validators that stand
// between an untrusted package and the disk.
//
// Nothing here does I/O, so the writer (main), the reader (main) and the
// export/import dialogs (renderer) share one definition of what a package IS.
//
// Two rules bind the whole format:
//   1. **The manifest is the allowlist.** A file that is not in `files` is
//      ignored on import, whatever the zip's central directory claims.
//   2. **Entry paths are data, never trusted.** `isSafeEntryPath` rejects
//      anything that could escape the extraction root BEFORE any resolve
//      happens; the reader canonicalizes and re-checks anyway (Q7e).
//
// Forward compatibility (Q7g/Q8): `kind` + per-asset `replaceable`/`role` are
// reserved for the template flavour, and `packs`/`packs/` is reserved for the
// Q8 pack system. v1 writes `kind: 'project'` and never writes `packs`, but
// both round-trip through the validator so a v1 reader can TELL a template
// package apart from a project one instead of choking on it.

import type { StudioAssetKind } from '../types/studio';

export const VIDTSX_PACKAGE_FORMAT_VERSION = 1;
export const VIDTSX_PACKAGE_EXTENSION = '.vidtsx';
export const PACKAGE_MANIFEST_NAME = 'manifest.json';
export const PACKAGE_PROJECT_NAME = 'project.json';

/** Top-level folders inside a package. `packs/` is RESERVED for Q8 — v1 never
 *  writes it, and caption packs get their own folder so the two never collide. */
export const PACKAGE_DIRS = {
  media: 'media',
  shots: 'shots',
  transcripts: 'transcripts',
  cutPlans: 'cut-plans',
  thumbs: 'thumbs',
  kit: 'kit',
  captionPacks: 'caption-packs',
  /** Q8 reserve — declared here so nothing else claims the name. */
  packs: 'packs',
} as const;

export const PACKAGE_BRAND_NAME = 'brand.json';
export const PACKAGE_AGENT_CHAT_NAME = 'agent-chat.json';
export const PACKAGE_THUMBNAIL_NAME = 'thumbnail.jpg';

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/**
 * Size/count caps (Q7e). Media is deliberately generous — a full-media package
 * of 4K footage is the normal case, not an attack — while everything the app
 * PARSES stays small, because those are the entries that reach a JSON parser
 * or the TSX gate.
 */
export const PACKAGE_LIMITS = {
  maxEntries: 20_000,
  maxTotalBytes: 256 * GiB,
  maxMediaFileBytes: 64 * GiB,
  /** json / tsx / jpg — anything the app reads into memory and parses. */
  maxDataFileBytes: 64 * MiB,
  maxManifestBytes: 32 * MiB,
  maxPathLength: 240,
} as const;

export type PackageKind = 'project' | 'template';

/** Q7c. `none` = relink-by-hash: the manifest keeps hashes, no media travels. */
export type PackageMediaStrategy = 'full' | 'proxies-only' | 'none';

export const PACKAGE_MEDIA_STRATEGIES: readonly PackageMediaStrategy[] = [
  'full',
  'proxies-only',
  'none',
];

export interface PackageFileEntry {
  /** Package-relative, forward slashes. */
  path: string;
  size: number;
  sha256: string;
}

export interface PackageAssetEntry {
  assetId: string;
  kind: StudioAssetKind;
  /** Basename on the exporter's machine — what the relink prompt asks for. */
  originalName: string;
  /** Package-relative media path; absent = no media travelled for this asset. */
  file?: string;
  /** Size of the ORIGINAL file, recorded even when it did not travel. */
  originalBytes?: number;
  /** The project's stored content hash — what a relink pick is verified against. */
  hash?: string;
  /** The travelling file is a 720p proxy, not the original (Q7c strategy 2). */
  proxyOnly?: boolean;
  /** Q7g reserve: placeholder media a template import walks the user through. */
  replaceable?: boolean;
  /** Q7g reserve: role label for a replaceable asset ("your A-roll here"). */
  role?: string;
}

export interface VidtsxManifest {
  formatVersion: number;
  kind: PackageKind;
  app: { name: string; version: string };
  /** project.json's schema version at export time — a NEWER one is refused. */
  schemaVersion: number;
  createdAt: string;
  project: { name: string; width: number; height: number; fps: number };
  mediaStrategy: PackageMediaStrategy;
  counts: { assets: number; media: number; shots: number; transcripts: number };
  /** Sum of `files[].size` — the uncompressed footprint an import will write. */
  totalBytes: number;
  assets: PackageAssetEntry[];
  files: PackageFileEntry[];
  /** Kit snapshot embedded at kit/<version>/ (Q7f — folder-as-truth pinning). */
  kitVersion?: string;
  /** Non-core caption packs embedded under caption-packs/<packId>/. */
  captionPacks?: string[];
  /** Q8 reserve: pack ids embedded under packs/<packId>/. Never written by v1. */
  packs?: string[];
  /** The private agent conversation travelled (opt-in, default OFF). */
  agentChat?: boolean;
  /** A brand token snapshot travelled as brand.json. */
  brand?: boolean;
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
/** Control characters (and DEL) never belong in a portable entry name. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

const WINDOWS_ILLEGAL = /[<>:"|?*]/;

/**
 * Is this zip entry name safe to join onto an extraction root?
 *
 * Deliberately string-only (no `path`), so the check is identical in main, in
 * the renderer, and in tests — and so it runs BEFORE any resolve, which is
 * where zip-slip normally sneaks through. The reader still resolves and
 * re-checks containment afterwards; this is the first of the two gates.
 */
export function isSafeEntryPath(name: string): boolean {
  if (typeof name !== 'string') return false;
  if (name === '' || name.length > PACKAGE_LIMITS.maxPathLength) return false;
  // A backslash is a path separator on Windows — a name carrying one is either
  // malicious or unportable, and both answers are "no".
  if (name.includes('\\')) return false;
  if (name.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(name)) return false;
  if (hasControlChars(name)) return false;
  if (WINDOWS_ILLEGAL.test(name)) return false;
  for (const segment of name.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') return false;
    if (segment.endsWith('.') || segment.endsWith(' ')) return false;
    if (WINDOWS_RESERVED.test(segment.split('.')[0])) return false;
  }
  return true;
}

/** Media entries get the generous cap; anything the app parses gets the small one. */
export function entrySizeLimit(entryPath: string): number {
  return entryPath.startsWith(`${PACKAGE_DIRS.media}/`)
    ? PACKAGE_LIMITS.maxMediaFileBytes
    : PACKAGE_LIMITS.maxDataFileBytes;
}

/** `media/<assetId>.<ext>` — the id is the name, so a hostile original filename
 *  never reaches disk. The extension is scrubbed to a short alnum token. */
export function packageMediaPath(assetId: string, originalPath: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(originalPath);
  const ext = match ? `.${match[1].toLowerCase()}` : '';
  return `${PACKAGE_DIRS.media}/${assetId}${ext}`;
}

/** Default file name for the save dialog. */
export function packageFileName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'project'}${VIDTSX_PACKAGE_EXTENSION}`;
}

export function formatPackageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MiB) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < GiB) return `${(bytes / MiB).toFixed(1)} MB`;
  return `${(bytes / GiB).toFixed(2)} GB`;
}
