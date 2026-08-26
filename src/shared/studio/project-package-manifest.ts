// Manifest validation for `.vidtsx` packages (Q7e) — the parser that stands
// between an untrusted manifest.json and everything the reader does next.
//
// Split from project-package.ts (which holds the format constants and the
// path-safety gate) because this half is all narrowing: every field arrives as
// `unknown`, and the result is either a manifest the reader may act on or ONE
// pointed sentence the import card shows the user.

import type { StudioAssetKind } from '../types/studio';
import {
  entrySizeLimit,
  isSafeEntryPath,
  PACKAGE_LIMITS,
  PACKAGE_MEDIA_STRATEGIES,
  PACKAGE_PROJECT_NAME,
  type PackageAssetEntry,
  type PackageFileEntry,
  type PackageKind,
  type PackageMediaStrategy,
  type VidtsxManifest,
} from './project-package';

function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function nonNegativeInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

const SHA256 = /^[0-9a-f]{64}$/;
const ASSET_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PACK_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KIT_VERSION = /^\d+\.\d+\.\d+$/;
const ASSET_KINDS: readonly string[] = ['video', 'audio', 'image'];

export type ManifestParseResult =
  | { ok: true; manifest: VidtsxManifest }
  | { ok: false; error: string };

function parseFiles(raw: unknown): { files: PackageFileEntry[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'manifest.json has no files list' };
  if (raw.length > PACKAGE_LIMITS.maxEntries) {
    return {
      error: `The package declares ${raw.length} files — the limit is ${PACKAGE_LIMITS.maxEntries}.`,
    };
  }
  const files: PackageFileEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const entry of raw) {
    if (!isPlainObject(entry)) return { error: 'manifest.files holds a non-object entry' };
    const filePath = entry.path;
    if (typeof filePath !== 'string' || !isSafeEntryPath(filePath)) {
      return { error: `Unsafe path in the manifest: ${String(filePath)}` };
    }
    if (seen.has(filePath)) return { error: `Duplicate path in the manifest: ${filePath}` };
    const size = nonNegativeInt(entry.size);
    if (size === null) return { error: `Bad size for ${filePath}` };
    if (size > entrySizeLimit(filePath)) {
      return { error: `${filePath} exceeds the size limit for its kind.` };
    }
    if (typeof entry.sha256 !== 'string' || !SHA256.test(entry.sha256)) {
      return { error: `Bad or missing sha256 for ${filePath}` };
    }
    total += size;
    if (total > PACKAGE_LIMITS.maxTotalBytes) {
      return { error: 'The package exceeds the total size limit.' };
    }
    seen.add(filePath);
    files.push({ path: filePath, size, sha256: entry.sha256 });
  }
  return { files };
}

function parseAssets(
  raw: unknown,
  files: ReadonlySet<string>,
): { assets: PackageAssetEntry[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'manifest.json has no assets list' };
  const assets: PackageAssetEntry[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry)) return { error: 'manifest.assets holds a non-object entry' };
    const assetId = entry.assetId;
    if (typeof assetId !== 'string' || !ASSET_ID.test(assetId)) {
      return { error: `Bad asset id: ${String(assetId)}` };
    }
    if (typeof entry.kind !== 'string' || !ASSET_KINDS.includes(entry.kind)) {
      return { error: `Bad asset kind for ${assetId}` };
    }
    let file: string | undefined;
    if (entry.file !== undefined) {
      if (typeof entry.file !== 'string' || !files.has(entry.file)) {
        return { error: `Asset ${assetId} points at a file the manifest does not list.` };
      }
      file = entry.file;
    }
    const originalName =
      typeof entry.originalName === 'string' && entry.originalName.trim() !== ''
        ? // A hostile basename never reaches disk (media is named by id), but it
          // IS shown in the relink prompt — keep it one bounded line.
          entry.originalName.replace(/[\r\n\t]/g, ' ').slice(0, 200)
        : assetId;
    const originalBytes = nonNegativeInt(entry.originalBytes);
    assets.push({
      assetId,
      kind: entry.kind as StudioAssetKind,
      originalName,
      ...(file !== undefined ? { file } : {}),
      ...(originalBytes !== null ? { originalBytes } : {}),
      ...(typeof entry.hash === 'string' && /^[0-9a-f]{1,128}$/.test(entry.hash)
        ? { hash: entry.hash }
        : {}),
      ...(entry.proxyOnly === true ? { proxyOnly: true } : {}),
      ...(entry.replaceable === true ? { replaceable: true } : {}),
      ...(typeof entry.role === 'string' && entry.role.trim() !== ''
        ? { role: entry.role.slice(0, 120) }
        : {}),
    });
  }
  return { assets };
}

function parseIdList(raw: unknown, pattern: RegExp): string[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !pattern.test(value)) return null;
    out.push(value);
  }
  return out;
}

/**
 * Validate a parsed manifest.json from an UNTRUSTED package. Returns a pointed
 * message rather than throwing, because every one of these is a card the user
 * reads. Version COMPATIBILITY is not decided here — the reader compares
 * `formatVersion`/`schemaVersion` against the running app, so the message can
 * name the app version that would open it.
 */
export function parsePackageManifest(raw: unknown): ManifestParseResult {
  if (!isPlainObject(raw)) return { ok: false, error: 'manifest.json is not an object' };
  const formatVersion = nonNegativeInt(raw.formatVersion);
  if (formatVersion === null || formatVersion < 1) {
    return { ok: false, error: 'manifest.json has no usable formatVersion' };
  }
  const schemaVersion = nonNegativeInt(raw.schemaVersion);
  if (schemaVersion === null) {
    return { ok: false, error: 'manifest.json has no usable schemaVersion' };
  }

  const kind: PackageKind = raw.kind === 'template' ? 'template' : 'project';
  const app = isPlainObject(raw.app) ? raw.app : {};
  const project = isPlainObject(raw.project) ? raw.project : null;
  if (!project) return { ok: false, error: 'manifest.json is missing the project block' };
  const width = nonNegativeInt(project.width);
  const height = nonNegativeInt(project.height);
  const fps = nonNegativeInt(project.fps);
  if (!width || !height || !fps) {
    return { ok: false, error: 'manifest.json is missing project width/height/fps' };
  }

  const filesResult = parseFiles(raw.files);
  if ('error' in filesResult) return { ok: false, error: filesResult.error };
  const filePaths = new Set(filesResult.files.map((f) => f.path));
  if (!filePaths.has(PACKAGE_PROJECT_NAME)) {
    return { ok: false, error: 'The package has no project.json' };
  }

  const assetsResult = parseAssets(raw.assets, filePaths);
  if ('error' in assetsResult) return { ok: false, error: assetsResult.error };

  const mediaStrategy = PACKAGE_MEDIA_STRATEGIES.includes(raw.mediaStrategy as PackageMediaStrategy)
    ? (raw.mediaStrategy as PackageMediaStrategy)
    : 'none';

  const captionPacks = parseIdList(raw.captionPacks, PACK_ID);
  if (captionPacks === null) {
    return { ok: false, error: 'manifest.captionPacks holds a bad pack id' };
  }
  const packs = parseIdList(raw.packs, PACK_ID);
  if (packs === null) return { ok: false, error: 'manifest.packs holds a bad pack id' };
  if (
    raw.kitVersion !== undefined &&
    (typeof raw.kitVersion !== 'string' || !KIT_VERSION.test(raw.kitVersion))
  ) {
    return { ok: false, error: 'manifest.kitVersion is not a version folder name' };
  }

  const counts = isPlainObject(raw.counts) ? raw.counts : {};
  return {
    ok: true,
    manifest: {
      formatVersion,
      kind,
      app: {
        name: typeof app.name === 'string' ? app.name.slice(0, 80) : 'VidTSX Studio',
        version: typeof app.version === 'string' ? app.version.slice(0, 40) : '0.0.0',
      },
      schemaVersion,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
      project: {
        name:
          typeof project.name === 'string' && project.name.trim() !== ''
            ? project.name.replace(/[\r\n\t]/g, ' ').slice(0, 120)
            : 'Imported project',
        width,
        height,
        fps,
      },
      mediaStrategy,
      counts: {
        assets: nonNegativeInt(counts.assets) ?? assetsResult.assets.length,
        media: nonNegativeInt(counts.media) ?? 0,
        shots: nonNegativeInt(counts.shots) ?? 0,
        transcripts: nonNegativeInt(counts.transcripts) ?? 0,
      },
      totalBytes: filesResult.files.reduce((sum, f) => sum + f.size, 0),
      assets: assetsResult.assets,
      files: filesResult.files,
      ...(typeof raw.kitVersion === 'string' ? { kitVersion: raw.kitVersion } : {}),
      ...(captionPacks.length > 0 ? { captionPacks } : {}),
      ...(packs.length > 0 ? { packs } : {}),
      ...(raw.agentChat === true ? { agentChat: true } : {}),
      ...(raw.brand === true ? { brand: true } : {}),
    },
  };
}
