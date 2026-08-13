import fs from 'fs/promises';
import { imageLocalEngine } from '../../local-image-engine';
import { isSdCliInstalled, getSdCliBinaryPath } from './sdimage-models';
import {
  createSdModelResolver,
  getImageModelsDir,
  registerImageCategory,
  scanImageLibrary,
} from './sdimage-library';
import { usageStore } from './model-usage';
import { getSdImageSettings } from './settings';
import { logEngine } from '../../logging/log-engine';

/**
 * Startup half: register the image category with the model-library core so
 * on-demand scans/imports work. Cheap (no disk scan) — the engine itself
 * initializes lazily via ensureSdImageEngine.
 */
export async function initSdImageCategory(): Promise<void> {
  registerImageCategory();
  const modelsDir = await getImageModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });
}

let enginePromise: Promise<void> | null = null;

async function initSdImageEngine(): Promise<void> {
  // Initial scan so the resolver has data and active-model restore can validate.
  await scanImageLibrary();

  const cliPath = getSdCliBinaryPath();
  imageLocalEngine.initialize(createSdModelResolver(), cliPath);
  imageLocalEngine.onModelUsed = (modelId) => usageStore.recordUse('image', modelId);

  if (!isSdCliInstalled()) {
    logEngine.warn('SdImage', 'sd-cli binary not installed — local image generation disabled');
    return;
  }

  logEngine.info('SdImage', 'Local image engine initialized (sd-cli available)');

  // Restore active model from settings only if it is still present in the scan.
  try {
    const settings = await getSdImageSettings();
    const stillInstalled =
      settings.activeModelId != null &&
      imageLocalEngine.getAvailableModels().some((m) => m.id === settings.activeModelId);
    if (settings.activeModelId && stillInstalled) {
      imageLocalEngine.setActiveModel(settings.activeModelId);
      logEngine.info('SdImage', `Restored active model: ${settings.activeModelId}`);
    }
  } catch (err) {
    logEngine.warn('SdImage', `Failed to restore SD image model: ${err}`);
  }
}

/**
 * Lazy engine init: the models-folder scan and active-model restore run on the
 * first IPC call that needs the local image engine (V1_RELEASE_PLAN.md Phase B)
 * — image generation, model activation, or the AI page's Image tab — instead
 * of at app startup.
 */
export function ensureSdImageEngine(): Promise<void> {
  enginePromise ??= initSdImageEngine().catch((err: unknown) => {
    enginePromise = null; // retry on the next call rather than caching failure
    throw err;
  });
  return enginePromise;
}

/**
 * Forget the memoized init so the next engine use re-resolves the sd-cli
 * binary path — used after the in-app install lands a binary mid-session.
 */
export function resetSdImageEngine(): void {
  enginePromise = null;
}
