import fs from 'fs/promises';
import { audioEngine } from '../../audio-engine';
import { getAudioModelsDir, setAiModelsFolderPath } from './audio-models';
import { getAiModelsFolder } from './settings';
import { logEngine } from '../../logging/log-engine';

export async function initAudioEngine(): Promise<void> {
  // Set AI models folder from settings before anything else
  const aiModelsFolder = await getAiModelsFolder();
  setAiModelsFolderPath(aiModelsFolder);

  const modelsDir = getAudioModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  audioEngine.initialize(modelsDir);

  if (!audioEngine.isSherpaAvailable()) {
    logEngine.warn('Audio', 'sherpa-onnx-node native addon not available — audio engine disabled');
    return;
  }

  logEngine.info('Audio', 'Audio engine initialized (sherpa-onnx available)');

  // Models are NOT auto-loaded on startup — loaded on demand when user requests
}
