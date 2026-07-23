import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { LLM_MODEL_CATALOG } from '../../llm-engine/model-registry';
import { enqueueDownload } from './download-manager';
import type { DownloadProgress } from './download-manager';

type ProgressCallback = (progress: DownloadProgress) => void;

export function getLlmLocalModelsDir(): string {
  return path.join(app.getPath('userData'), 'ai-models', 'llm');
}

export function getModelFilePath(modelId: string): string {
  const model = LLM_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown LLM model: ${modelId}`);
  }
  return path.join(getLlmLocalModelsDir(), model.fileName);
}

export function isModelDownloaded(modelId: string): boolean {
  try {
    const filePath = getModelFilePath(modelId);
    return existsSync(filePath);
  } catch {
    return false;
  }
}

export function getLlmDownloadId(modelId: string): string {
  return `llm-model-${modelId}`;
}

// ─── Model download/delete ─────────────────────────────────────────

export async function downloadLlmModel(
  modelId: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const model = LLM_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown LLM model: ${modelId}`);
  }

  const modelsDir = getLlmLocalModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  const finalPath = path.join(modelsDir, model.fileName);
  const partPath = finalPath + '.part';

  // GGUF files are single-file downloads — no archive extraction needed.
  // Download to a .part temp file; the engine renames it to the final name
  // before emitting 'completed'. This prevents isModelDownloaded() from
  // returning true for partial downloads, and ensures the rename also runs
  // for downloads resumed after an app restart.
  await enqueueDownload(
    {
      id: getLlmDownloadId(modelId),
      url: model.downloadUrl,
      destPath: partPath,
      finalizePath: finalPath,
      metadata: { modelId, type: 'llm-model' },
    },
    onProgress,
  );

  return finalPath;
}

export async function deleteLlmModel(modelId: string): Promise<void> {
  const filePath = getModelFilePath(modelId);
  const partPath = filePath + '.part';

  const finalExists = existsSync(filePath);
  const partExists = existsSync(partPath);

  if (!finalExists && !partExists) {
    throw new Error(`LLM model ${modelId} is not downloaded`);
  }

  if (finalExists) await fs.unlink(filePath);
  if (partExists) await fs.unlink(partPath);
}
