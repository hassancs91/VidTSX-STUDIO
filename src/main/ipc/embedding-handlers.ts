import type { IpcMainInvokeEvent } from 'electron';
import https from 'https';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { IPC } from '../../shared/ipc/channels';
import type {
  EmbeddingModelsListResponse,
  EmbeddingModelDownloadRequest,
  EmbeddingModelDownloadResponse,
  EmbeddingModelDeleteRequest,
  EmbeddingModelDeleteResponse,
  EmbeddingModelIpc,
  EmbeddingLoadModelRequest,
  EmbeddingLoadModelResponse,
  EmbeddingUnloadModelResponse,
  EmbeddingEmbedRequest,
  EmbeddingEmbedResponse,
} from '../../shared/ipc/types';
import { EMBEDDING_MODEL_CATALOG, getHfFileUrl } from '../../embedding-engine/model-registry';
import {
  getEmbeddingModelsDir,
  getEmbeddingModelDir,
  isEmbeddingModelDownloaded,
  markEmbeddingModelComplete,
  deleteEmbeddingModel,
} from '../services/embedding-models';
import { enqueueDownload } from '../services/download-manager';
import { embeddingEngine } from '../../embedding-engine';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('EmbeddingHandlers');

// ─── Small file downloader (for config/tokenizer JSON files) ─────

/**
 * Download a small file directly via HTTPS with redirect support.
 * Used for auxiliary files (config.json, tokenizer.json, etc.) that are
 * only a few KB and don't need pause/resume or progress tracking.
 */
function downloadSmallFile(url: string, destPath: string, maxRedirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (currentUrl: string, redirectCount: number) => {
      if (redirectCount > maxRedirects) {
        reject(new Error('Too many redirects'));
        return;
      }

      https.get(currentUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          const location = response.headers.location;
          if (!location) {
            reject(new Error('Redirect without location header'));
            return;
          }
          // Resolve relative redirects against the current URL
          const redirectUrl = new URL(location, currentUrl).href;
          request(redirectUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} downloading ${url}`));
          return;
        }

        const fileStream = createWriteStream(destPath);
        response.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(); });
        fileStream.on('error', reject);
      }).on('error', reject);
    };

    request(url, 0);
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────

export async function handleEmbeddingModelsList(
  _event: IpcMainInvokeEvent,
): Promise<EmbeddingModelsListResponse> {
  try {
    const models: EmbeddingModelIpc[] = EMBEDDING_MODEL_CATALOG
      .filter((m) => !m.hidden)
      .map((m) => {
        const downloaded = isEmbeddingModelDownloaded(m.id);
        return {
          id: m.id,
          name: m.name,
          size: m.size,
          language: m.language,
          dimensions: m.dimensions,
          maxTokens: m.maxTokens,
          sizeLabel: m.sizeLabel,
          sizeBytes: m.sizeBytes,
          downloaded,
          modelPath: downloaded ? getEmbeddingModelDir(m.id) : undefined,
        };
      });
    return { models };
  } catch {
    return { models: [] };
  }
}

export async function handleEmbeddingModelDownload(
  event: IpcMainInvokeEvent,
  data: EmbeddingModelDownloadRequest,
): Promise<EmbeddingModelDownloadResponse> {
  try {
    const model = EMBEDDING_MODEL_CATALOG.find((m) => m.id === data.modelId);
    if (!model) {
      log.warn('Unknown embedding model requested', { modelId: data.modelId });
      return { success: false, error: `Unknown model: ${data.modelId}` };
    }

    log.info('Downloading embedding model', { modelId: data.modelId, name: model.name });

    const modelDir = path.join(getEmbeddingModelsDir(), model.id);
    await fs.mkdir(modelDir, { recursive: true });

    // Separate auxiliary (small) files from the main ONNX model file.
    // Small files are downloaded directly; the ONNX file goes through the
    // download manager so it supports pause/resume and progress tracking.
    const auxiliaryFiles = model.files.filter((f) => !f.endsWith('.onnx'));
    const mainFile = model.files.find((f) => f.endsWith('.onnx'));

    // 1. Download small auxiliary files directly
    for (const filePath of auxiliaryFiles) {
      const destPath = path.join(modelDir, filePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await downloadSmallFile(getHfFileUrl(model.hfRepoId, filePath), destPath);
    }

    // 2. Enqueue the main ONNX file through the download manager
    //    Single download ID per model — matches the audio pattern exactly
    if (mainFile) {
      const destPath = path.join(modelDir, mainFile);
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      await enqueueDownload(
        {
          id: `embedding-model-${data.modelId}`,
          url: getHfFileUrl(model.hfRepoId, mainFile),
          destPath,
          metadata: { modelId: data.modelId, type: 'embedding-model' },
        },
        (progress) => {
          event.sender.send(IPC.EMBEDDING_DOWNLOAD_PROGRESS, {
            modelId: data.modelId,
            percent: progress.percent,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
          });
        },
      );
    }

    // 3. Write the completion marker so isEmbeddingModelDownloaded returns true
    await markEmbeddingModelComplete(data.modelId);

    log.info('Embedding model download complete', { modelId: data.modelId });
    return { success: true };
  } catch (err) {
    log.error('Embedding model download failed', err, { modelId: data.modelId });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

export async function handleEmbeddingModelDelete(
  _event: IpcMainInvokeEvent,
  data: EmbeddingModelDeleteRequest,
): Promise<EmbeddingModelDeleteResponse> {
  try {
    await deleteEmbeddingModel(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

export async function handleEmbeddingLoadModel(
  _event: IpcMainInvokeEvent,
  data: EmbeddingLoadModelRequest,
): Promise<EmbeddingLoadModelResponse> {
  try {
    const modelPath = getEmbeddingModelDir(data.modelId);
    await embeddingEngine.loadModel(data.modelId, modelPath);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load embedding model',
    };
  }
}

export async function handleEmbeddingUnloadModel(
  _event: IpcMainInvokeEvent,
): Promise<EmbeddingUnloadModelResponse> {
  try {
    await embeddingEngine.unloadModel();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unload embedding model',
    };
  }
}

export async function handleEmbeddingEmbed(
  _event: IpcMainInvokeEvent,
  data: EmbeddingEmbedRequest,
): Promise<EmbeddingEmbedResponse> {
  try {
    const result = await embeddingEngine.embed({
      texts: data.texts,
      normalize: data.normalize,
    });
    return {
      success: true,
      embeddings: result.embeddings,
      dimensions: result.dimensions,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Embedding failed',
    };
  }
}
