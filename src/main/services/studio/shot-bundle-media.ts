// What a bundled shot's `staticFile()` calls name, registered as project assets
// (video-10 import gap 3). Shared by Import TSX (a new shot folder) and the
// in-place bundle (P3 part 8: a shot that already has a folder), so both attach
// media and report the missing ones the same way.

import type { StudioMediaAsset } from '../../../shared/types/studio';
import type { StudioShotImportReport } from '../../../shared/ipc/types';
import { importMediaFiles } from './media-import';
import type { ShotBundleResult } from './shot-bundle';

export interface BundleMedia {
  /** Newly registered project assets (the import event carries them to the renderer). */
  assets: StudioMediaAsset[];
  /** `assets.<key>` → project asset id, for the shot's `assetRefs`. */
  assetRefs: Record<string, string>;
  report: StudioShotImportReport;
}

/** Register every media file the bundle named and found on disk; report the rest. */
export async function registerBundleMedia(projectId: string, bundle: ShotBundleResult): Promise<BundleMedia> {
  const found = bundle.media.filter((m): m is typeof m & { path: string } => m.path !== null);
  const uniquePaths = [...new Set(found.map((m) => m.path))];
  const { assets } = uniquePaths.length > 0 ? await importMediaFiles(projectId, uniquePaths) : { assets: [] };
  const assetIdByPath = new Map(assets.map((asset) => [asset.path, asset.id]));
  const assetRefs: Record<string, string> = {};
  const missingMedia: string[] = [];
  for (const media of bundle.media) {
    const assetId = media.path ? assetIdByPath.get(media.path) : undefined;
    if (assetId) assetRefs[media.key] = assetId;
    else missingMedia.push(media.ref);
  }
  return {
    assets,
    assetRefs,
    report: {
      inlinedFiles: bundle.inlinedFiles.length,
      inlinedPackages: bundle.inlinedPackages,
      media: Object.keys(assetRefs).length,
      missingMedia,
      dynamicMediaCalls: bundle.dynamicStaticFileCalls,
    },
  };
}
