import fs from 'fs/promises';
import { audioEngine } from '../../audio-engine';
import { getAudioModelsDir, setAiModelsFolderPath } from './audio-models';
import { getAiModelsFolder } from './settings';
import { logEngine } from '../../logging/log-engine';

let initPromise: Promise<void> | null = null;

async function initAudioEngine(): Promise<void> {
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

  // Models are NOT auto-loaded — loaded on demand when user requests
}

/**
 * Lazy init: `isSherpaAvailable` loads the sherpa-onnx native addon, which is
 * too expensive for app startup (V1_RELEASE_PLAN.md Phase B). The first audio
 * IPC call pays it once instead — registrations/audio.ts wraps the handlers
 * that touch the engine with this.
 */
export function ensureAudioEngine(): Promise<void> {
  initPromise ??= initAudioEngine().catch((err: unknown) => {
    initPromise = null; // retry on the next call rather than caching failure
    throw err;
  });
  return initPromise;
}
