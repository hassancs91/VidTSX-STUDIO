import fs from 'fs/promises';
import { llmLocalEngine } from '../../llm-engine';
import { getLlmLocalModelsDir } from './llm-local-models';
import { logEngine } from '../../logging/log-engine';

let initPromise: Promise<void> | null = null;

async function initLocalLlmEngine(): Promise<void> {
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

  // Note: model is NOT auto-loaded — loaded on demand when user generates
}

/**
 * Lazy init: importing node-llama-cpp and probing the GPU backend is too
 * expensive for app startup (V1_RELEASE_PLAN.md Phase B). The first local-LLM
 * IPC call pays it once instead — registrations/local-llm.ts wraps the
 * handlers that touch the engine runtime with this.
 */
export function ensureLocalLlmEngine(): Promise<void> {
  initPromise ??= initLocalLlmEngine().catch((err: unknown) => {
    initPromise = null; // retry on the next call rather than caching failure
    throw err;
  });
  return initPromise;
}
