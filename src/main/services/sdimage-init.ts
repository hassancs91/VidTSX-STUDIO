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

export async function initSdImageEngine(): Promise<void> {
  // Register the image category + sd-cli runtime with the model-library core.
  registerImageCategory();

  const modelsDir = await getImageModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

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
