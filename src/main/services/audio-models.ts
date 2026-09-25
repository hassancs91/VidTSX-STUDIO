import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { AUDIO_MODEL_CATALOG } from '../../audio-engine/model-registry';

/** Cached folder path — set during init from settings. Resolved on first
 *  use rather than at import, so a module that merely imports this one (via
 *  utils/paths.ts) never touches `app` at load time — unit tests mock
 *  `electron` without it. */
let aiModelsFolder: string | null = null;

export function setAiModelsFolderPath(folder: string): void {
  aiModelsFolder = folder;
}

export function getAudioModelsDir(): string {
  if (aiModelsFolder === null) aiModelsFolder = path.join(app.getPath('userData'), 'ai-models');
  return aiModelsFolder;
}

export function getModelDir(modelId: string): string {
  const model = AUDIO_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return path.join(getAudioModelsDir(), model.type, model.extractedDirName);
}

export function isModelDownloaded(modelId: string): boolean {
  const model = AUDIO_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) return false;

  const modelDir = getModelDir(modelId);
  if (!existsSync(modelDir)) return false;

  // Check that all required files exist
  return model.files.every((file) => {
    const filePath = path.join(modelDir, file);
    return existsSync(filePath);
  });
}

export function getDownloadedModelIds(): string[] {
  return AUDIO_MODEL_CATALOG
    .filter((m) => isModelDownloaded(m.id))
    .map((m) => m.id);
}

export async function deleteModel(modelId: string): Promise<void> {
  const modelDir = getModelDir(modelId);

  if (!existsSync(modelDir)) {
    throw new Error(`Model ${modelId} is not downloaded`);
  }

  await fs.rm(modelDir, { recursive: true });
}

export const audioModelsService = {
  getAudioModelsDir,
  getModelDir,
  isModelDownloaded,
  getDownloadedModelIds,
  deleteModel,
};
