/**
 * One-click download for video model profiles. Unlike the image D1 flow
 * (single file), a Wan profile is only usable with its companions (umt5 text
 * encoder + VAE), so a profile download fetches the model file AND any
 * companions missing from the folder — sequentially, each as its own
 * download-manager task following the README pattern (.part + finalizePath).
 *
 * Companions land in the models-folder root under their canonical names, so
 * they are shared by every Wan model (and skipped on the next profile
 * download). Progress events carry `metadata.fileLabel` + `fileStep` so the
 * renderer can show which file of the set is downloading.
 */
import fs from 'fs/promises';
import path from 'path';
import { ModelLibraryError } from '@shared/model-library/types';
import type { VideoDownloadProgress } from '../../local-video-engine/types';
import { enqueueDownload } from './download-manager';
import { getVideoModelsDir, missingCompanionsFor, videoProfileById } from './sdvideo-library';

type ProgressCallback = (progress: VideoDownloadProgress) => void;

interface DownloadFile {
  url: string;
  fileName: string;
  label: string;
  /** Stable engine task id — companions share one id across profiles. */
  taskId: string;
}

const COMPANION_LABELS: Record<string, string> = {
  t5xxl: 'Text encoder',
  vae: 'VAE',
  clip_vision: 'CLIP vision',
  llm: 'LLM encoder',
  audio_vae: 'Audio VAE',
  embeddings: 'Embeddings connectors',
};

function companionLabel(kind: string): string {
  return COMPANION_LABELS[kind] ?? kind;
}

export async function downloadVideoProfileModel(
  profileId: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const profile = videoProfileById(profileId);
  if (!profile) {
    throw new ModelLibraryError('unknown-model', `Unknown video model: ${profileId}`);
  }
  if (!profile.downloadUrl) {
    throw new ModelLibraryError(
      'import-failed',
      `"${profile.name}" has no direct download — get it from ${profile.sourceUrl} and drop it into your video models folder.`,
    );
  }

  const modelsDir = await getVideoModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  const files: DownloadFile[] = [
    {
      url: profile.downloadUrl,
      fileName: profile.matchFileNames?.[0] ?? path.basename(profile.downloadUrl.split('?')[0]),
      label: 'Model',
      taskId: `sdvideo-model-${profileId}`,
    },
  ];

  for (const companion of await missingCompanionsFor(profile)) {
    if (!companion.downloadUrl) continue; // link-only companion — surfaced as an issue after scan
    files.push({
      url: companion.downloadUrl,
      fileName: companion.fileNames[0],
      label: companionLabel(companion.kind),
      taskId: `sdvideo-companion-${companion.fileNames[0].toLowerCase()}`,
    });
  }

  const modelFinalPath = path.join(modelsDir, files[0].fileName);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const finalPath = path.join(modelsDir, file.fileName);

    await enqueueDownload(
      {
        id: file.taskId,
        url: file.url,
        destPath: `${finalPath}.part`,
        finalizePath: finalPath,
        metadata: {
          modelId: profileId,
          type: 'sdvideo-model',
          fileLabel: file.label,
          fileStep: `${i + 1}/${files.length}`,
        },
      },
      onProgress
        ? (progress) =>
            onProgress({
              modelId: profileId,
              percent: progress.percent,
              downloadedBytes: progress.downloadedBytes,
              totalBytes: progress.totalBytes,
              fileLabel: file.label,
            })
        : undefined,
    );
  }

  return modelFinalPath;
}
