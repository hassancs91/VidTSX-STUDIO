/**
 * D1 hybrid one-click download for profiles that carry a stable, public,
 * unauthenticated `downloadUrl`. Single-file only (every `downloadUrl` profile
 * is a single file — all archive/zip handling is gone). Downloads to a `.part`
 * temp file, then renames into the models-folder root (flat layout → companion
 * sharing). Reuses the `sdimage-model-<id>` download-manager id + metadata so
 * the existing renderer progress plumbing keeps working unchanged.
 */
import fs from 'fs/promises';
import path from 'path';
import { ModelLibraryError } from '@shared/model-library/types';
import type { SdDownloadProgress } from '../../local-image-engine/types';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';
import { enqueueDownload } from './download-manager';
import { getImageModelsDir } from './sdimage-library';

type ProgressCallback = (progress: SdDownloadProgress) => void;

export async function downloadProfileModel(
  profileId: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const profile = SD_MODEL_CATALOG.find((p) => p.id === profileId);
  if (!profile) {
    throw new ModelLibraryError('unknown-model', `Unknown model: ${profileId}`);
  }
  if (!profile.downloadUrl) {
    throw new ModelLibraryError(
      'import-failed',
      `"${profile.name}" has no direct download — get it from ${profile.sourceUrl} and drop it into your models folder.`,
    );
  }

  const modelsDir = await getImageModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  const fileName = profile.matchFileNames?.[0] ?? path.basename(profile.downloadUrl.split('?')[0]);
  const finalPath = path.join(modelsDir, fileName);
  const partPath = `${finalPath}.part`;

  await enqueueDownload(
    {
      id: `sdimage-model-${profileId}`,
      url: profile.downloadUrl,
      destPath: partPath,
      metadata: { modelId: profileId, type: 'sdimage-model' },
    },
    onProgress
      ? (progress) =>
          onProgress({
            modelId: profileId,
            percent: progress.percent,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
          })
      : undefined,
  );

  // Download complete — atomically reveal the file under its final name.
  await fs.rename(partPath, finalPath);
  return finalPath;
}
