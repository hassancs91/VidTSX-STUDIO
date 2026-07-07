import fs from 'fs/promises';
import { imageLocalEngine } from '../../local-image-engine';
import { getSdImageModelsDir, isSdModelDownloaded, isSdCliInstalled, getSdCliBinaryPath } from './sdimage-models';
import { getSdImageSettings } from './settings';
import { logEngine } from '../../logging/log-engine';

export async function initSdImageEngine(): Promise<void> {
  const modelsDir = getSdImageModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  const cliPath = getSdCliBinaryPath();
  imageLocalEngine.initialize(modelsDir, cliPath);

  if (!isSdCliInstalled()) {
    logEngine.warn('SdImage', 'sd-cli binary not installed — local image generation disabled');
    return;
  }

  logEngine.info('SdImage', 'Local image engine initialized (sd-cli available)');

  // Restore active model from settings
  try {
    const settings = await getSdImageSettings();
    if (settings.activeModelId && isSdModelDownloaded(settings.activeModelId)) {
      imageLocalEngine.setActiveModel(settings.activeModelId);
      logEngine.info('SdImage', `Restored active model: ${settings.activeModelId}`);
    }
  } catch (err) {
    logEngine.warn('SdImage', `Failed to restore SD image model: ${err}`);
  }
}
