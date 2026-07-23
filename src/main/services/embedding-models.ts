import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { EMBEDDING_MODEL_CATALOG } from '../../embedding-engine/model-registry';
import { getAudioModelsDir } from './audio-models';

/**
 * Returns the base directory for embedding models: {aiModelsFolder}/embeddings/
 */
export function getEmbeddingModelsDir(): string {
  return path.join(getAudioModelsDir(), 'embeddings');
}

/**
 * Returns the directory for a specific embedding model.
 */
export function getEmbeddingModelDir(modelId: string): string {
  const model = EMBEDDING_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown embedding model: ${modelId}`);
  }
  return path.join(getEmbeddingModelsDir(), model.id);
}

/**
 * Checks whether a model is fully downloaded: every file in the catalog entry
 * must exist on disk. The main ONNX file is downloaded to a `.part` temp file
 * and only renamed to its final name once complete, so partial downloads will
 * NOT pass this check.
 */
export function isEmbeddingModelDownloaded(modelId: string): boolean {
  const model = EMBEDDING_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) return false;

  const modelDir = path.join(getEmbeddingModelsDir(), model.id);
  return model.files.every((file) => existsSync(path.join(modelDir, file)));
}

/**
 * Returns IDs of all fully downloaded embedding models.
 */
export function getDownloadedEmbeddingModelIds(): string[] {
  return EMBEDDING_MODEL_CATALOG
    .filter((m) => isEmbeddingModelDownloaded(m.id))
    .map((m) => m.id);
}

/**
 * Deletes a downloaded embedding model from disk (including the .complete marker).
 */
export async function deleteEmbeddingModel(modelId: string): Promise<void> {
  const modelDir = getEmbeddingModelDir(modelId);

  if (!existsSync(modelDir)) {
    throw new Error(`Embedding model ${modelId} is not downloaded`);
  }

  await fs.rm(modelDir, { recursive: true });
}
