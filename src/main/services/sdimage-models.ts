import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { SdDownloadProgress } from '../../local-image-engine/types';
import { SD_MODEL_CATALOG, SD_MODELS_BASE_URL } from '../../local-image-engine/model-registry';
import { getBinariesDir } from '../utils/paths';
import { enqueueDownload } from './download-manager';

type ProgressCallback = (progress: SdDownloadProgress) => void;

export function getSdImageModelsDir(): string {
  return path.join(app.getPath('userData'), 'ai-models', 'image');
}

export function getSdModelDir(modelId: string): string {
  const model = SD_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown SD model: ${modelId}`);
  }
  return path.join(getSdImageModelsDir(), model.extractedName);
}

export function getSdModelFilePath(modelId: string): string {
  const model = SD_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown SD model: ${modelId}`);
  }
  return path.join(getSdImageModelsDir(), model.extractedName, model.modelFileName);
}

export function isSdModelDownloaded(modelId: string): boolean {
  const model = SD_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) return false;

  const modelFilePath = getSdModelFilePath(modelId);
  return existsSync(modelFilePath);
}

export function getDownloadedSdModelIds(): string[] {
  return SD_MODEL_CATALOG
    .filter((m) => isSdModelDownloaded(m.id))
    .map((m) => m.id);
}

// ─── sd-cli binary (bundled with app) ──────────────────────────────

/**
 * sd-cli is bundled in resources/binaries/sd-cli.exe (Windows) or resources/binaries/sd-cli (macOS/Linux).
 * It also requires stable-diffusion.dll alongside it.
 */
export function getSdCliBinaryPath(): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  return path.join(getBinariesDir(), `sd-cli${ext}`);
}

export function isSdCliInstalled(): boolean {
  return existsSync(getSdCliBinaryPath());
}

// ─── Model download/delete ─────────────────────────────────────────

export async function downloadSdModel(
  modelId: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const model = SD_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown SD model: ${modelId}`);
  }

  const modelsDir = getSdImageModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  const downloadUrl = model.downloadPath.startsWith('http')
    ? model.downloadPath
    : `${SD_MODELS_BASE_URL}/${model.downloadPath}`;

  // For 'none' format (single files like GGUF), download to a .part temp file
  // then rename on completion. This prevents isSdModelDownloaded() from returning
  // true for partial downloads (existsSync would find the incomplete file).
  if (model.archiveFormat === 'none') {
    const destDir = path.join(modelsDir, model.extractedName);
    await fs.mkdir(destDir, { recursive: true });
    const finalPath = path.join(destDir, model.modelFileName);
    const partPath = finalPath + '.part';

    await enqueueDownload(
      {
        id: `sdimage-model-${modelId}`,
        url: downloadUrl,
        destPath: partPath,
        metadata: { modelId, type: 'sdimage-model' },
      },
      onProgress
        ? (progress) => onProgress({
            modelId,
            percent: progress.percent,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
          })
        : undefined,
    );

    // Download complete — rename .part to final name
    await fs.rename(partPath, finalPath);
  } else {
    // For archives (zip, tar.gz, tar.bz2), download then extract
    const archiveFileName = path.basename(downloadUrl.split('?')[0]);
    const archivePath = path.join(modelsDir, archiveFileName);

    await enqueueDownload(
      {
        id: `sdimage-model-${modelId}`,
        url: downloadUrl,
        destPath: archivePath,
        extraction: {
          format: model.archiveFormat,
          destDir: modelsDir,
          deleteArchive: true,
        },
        metadata: { modelId, type: 'sdimage-model' },
      },
      onProgress
        ? (progress) => onProgress({
            modelId,
            percent: progress.percent,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
          })
        : undefined,
    );
  }

  return getSdModelDir(modelId);
}

export async function deleteSdModel(modelId: string): Promise<void> {
  const modelDir = getSdModelDir(modelId);

  if (!existsSync(modelDir)) {
    throw new Error(`SD model ${modelId} is not downloaded`);
  }

  await fs.rm(modelDir, { recursive: true });
}
