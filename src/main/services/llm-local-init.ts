import fs from 'fs/promises';
import { llmLocalEngine } from '../../llm-engine';
import { getLlmLocalModelsDir } from './llm-local-models';
import { logEngine } from '../../logging/log-engine';

export async function initLocalLlmEngine(): Promise<void> {
  const modelsDir = getLlmLocalModelsDir();
  await fs.mkdir(modelsDir, { recursive: true });

  llmLocalEngine.initialize(modelsDir);

  const available = await llmLocalEngine.isAvailable();
  if (!available) {
    logEngine.warn('LocalLLM', 'node-llama-cpp not available — local LLM disabled');
    return;
  }

  logEngine.info('LocalLLM', 'Local LLM engine initialized');

  // Detect GPU (non-blocking)
  llmLocalEngine.detectGpu().then((gpu) => {
    logEngine.info('LocalLLM', `GPU: ${gpu.backend} ${gpu.deviceName ?? ''}`);
  }).catch(() => {});

  // Note: model is NOT auto-loaded on startup — loaded on demand when user generates
}
