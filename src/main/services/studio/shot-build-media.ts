// Media for a Studio shot build (P3 part 5). Three jobs:
//
// - IN: the shot's media goes into the build's assets/ as `<key><ext>`, so the
//   piece loads it with staticFile('<key><ext>') and the builder's looks show
//   it. An edit copies the shot's media the seeded version does not already
//   carry (a shot made before the builder reads `props.assets.<key>`).
// - BEHIND (Hasan's 1(b)): the footage a transparent shot plays over, for its
//   looks: the anchor asset, or the master clip the caller found under the
//   playhead; its proxy when one is ready, else the original.
// - OUT (2a): on save, the version's own image/video/audio files are
//   registered as project media in place, keyed for the shot's `assets` prop.
//   A key the shot already maps keeps its asset id (no duplicate assets).
//   Import TSX registers a builder version's files the same way.

import fs from 'fs/promises';
import path from 'path';
import type { StudioMediaAsset, StudioProject } from '../../../shared/types/studio';
import type { StudioShotImportReport } from '../../../shared/ipc/types';
import type { LookBackdrop } from '../tsx-builder/types';
import { listAssetFiles } from '../tsx-builder/build-assets';
import { versionAssetFiles } from '../tsx-builder/version-assets';
import { ASSET_ROOT_EXTENSIONS } from '../asset-roots';
import { shotAssetKey } from './shot-bundle-finish';
import { classifyMediaKind, importMediaFiles } from './media-import';
import { getProjectCacheDir } from './studio-paths';
import type { ShotMediaNote } from './shot-build-request';

export interface ShotMediaFiles {
  /** For the build request's `assets`: an absolute path and its name in assets/. */
  assets: Array<{ path: string; name: string }>;
  /** For the intent. */
  notes: ShotMediaNote[];
}

/** `refs` (key → project asset id) as files for the build. Unknown ids and non-media kinds are skipped. */
export function shotMediaFiles(
  refs: Record<string, string>,
  assetsById: ReadonlyMap<string, StudioMediaAsset>,
  skipKeys: ReadonlySet<string> = new Set(),
): ShotMediaFiles {
  const out: ShotMediaFiles = { assets: [], notes: [] };
  for (const [key, assetId] of Object.entries(refs)) {
    if (skipKeys.has(key)) continue;
    const asset = assetsById.get(assetId);
    if (!asset) continue;
    const name = `${key}${path.extname(asset.path).toLowerCase()}`;
    out.assets.push({ path: asset.path, name });
    out.notes.push({
      file: name,
      kind: asset.kind,
      ...(asset.probe.width !== undefined ? { width: asset.probe.width } : {}),
      ...(asset.probe.height !== undefined ? { height: asset.probe.height } : {}),
      ...(asset.kind !== 'image' ? { durationSeconds: asset.probe.duration } : {}),
      ...(asset.description ? { description: asset.description } : {}),
    });
  }
  return out;
}

/** Keys of every file the shot folder's versions carry (`vN.assets/`): an edit's seed brings them already. */
export async function versionFileKeys(folderPath: string): Promise<Set<string>> {
  const keys = new Set<string>();
  const entries = await fs.readdir(folderPath).catch(() => [] as string[]);
  for (const entry of entries.filter((e) => /^v\d+\.assets$/i.test(e))) {
    for (const file of await listAssetFiles(path.join(folderPath, entry))) keys.add(shotAssetKey(file.relPath));
  }
  return keys;
}

/** Where the footage under a shot comes from: a video asset, and the source second at the shot's frame 0. */
export interface FootageSource {
  assetId: string;
  sourceSeconds: number;
}

/**
 * The footage file a transparent shot's looks play under it: the asset's
 * proxy when it is ready (smaller, what the editor plays), else the original.
 * Undefined when the asset is not a video or neither file can be served.
 */
export async function backdropFor(projectId: string, project: Pick<StudioProject, 'assets'>, source: FootageSource): Promise<LookBackdrop | undefined> {
  const asset = project.assets.find((a) => a.id === source.assetId);
  if (!asset || asset.kind !== 'video') return undefined;
  const candidates: string[] = [];
  if (asset.proxy?.status === 'ready') candidates.push(path.join(await getProjectCacheDir(projectId), ...asset.proxy.path.split(/[\\/]/)));
  candidates.push(asset.path);
  for (const file of candidates) {
    if (!ASSET_ROOT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (!(await fs.stat(file).then((s) => s.isFile(), () => false))) continue;
    const startSeconds = Math.max(0, source.sourceSeconds);
    return { file, startSeconds, label: `${path.basename(asset.path)} from ${startSeconds.toFixed(1)} s` };
  }
  return undefined;
}

export interface AttachedVersionMedia {
  /** key → project asset id, for every file found. */
  assetRefs: Record<string, string>;
  /** Assets registered now: the caller sends them on the ready event. */
  assets: StudioMediaAsset[];
  report: StudioShotImportReport;
}

/**
 * The files a TSX builder version loads (`vN.assets/`, version-assets.ts),
 * registered as project media in place and keyed for the shot's `assets` prop.
 * `known`: keys that already have an asset id (the shot's own refs) keep it,
 * and their file is not registered again. Null when the code names no files.
 * Kinds a shot cannot hold (3D models, environment maps, fonts, data) are
 * reported, not attached.
 */
export async function attachVersionMedia(
  projectId: string,
  tsxPath: string,
  code?: string,
  known: Record<string, string> = {},
): Promise<AttachedVersionMedia | null> {
  const files = await versionAssetFiles(tsxPath, code);
  if (files.length === 0) return null;
  const assetRefs: Record<string, string> = {};
  for (const f of files) if (known[f.key] && f.path) assetRefs[f.key] = known[f.key];
  const fresh = files.filter((f) => !assetRefs[f.key]);
  const media = fresh.filter((f): f is typeof f & { path: string } => f.path !== null && classifyMediaKind(f.path) !== null);
  const unsupported = fresh.filter((f) => f.path !== null && classifyMediaKind(f.path) === null).map((f) => f.relPath);
  const uniquePaths = [...new Set(media.map((f) => f.path))];
  const { assets } = uniquePaths.length > 0 ? await importMediaFiles(projectId, uniquePaths) : { assets: [] };
  const assetIdByPath = new Map(assets.map((asset) => [asset.path, asset.id]));
  const missingMedia: string[] = [];
  for (const f of fresh) {
    const assetId = f.path ? assetIdByPath.get(f.path) : undefined;
    if (assetId) assetRefs[f.key] = assetId;
    else if (!unsupported.includes(f.relPath)) missingMedia.push(f.relPath);
  }
  return {
    assetRefs,
    assets,
    report: {
      inlinedFiles: 0,
      inlinedPackages: [],
      media: Object.keys(assetRefs).length,
      missingMedia,
      dynamicMediaCalls: 0,
      ...(unsupported.length > 0 ? { unsupportedMedia: unsupported } : {}),
    },
  };
}
