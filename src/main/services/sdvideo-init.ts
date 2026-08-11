import { videoLocalEngine } from '../../local-video-engine/video-engine';
import { getSdCliBinaryPath, isSdCliInstalled } from './sdimage-models';
import { createVideoModelResolver, registerVideoLibrary, scanVideoLibrary } from './sdvideo-library';
import { usageStore } from './model-usage';
import { logEngine } from '../../logging/log-engine';

/**
 * Startup half: register the video category with the model-library core so
 * on-demand scans work. Cheap (no disk scan) — the engine itself initializes
 * lazily via ensureSdVideoEngine.
 */
export async function initSdVideoCategory(): Promise<void> {
  await registerVideoLibrary();
}

let enginePromise: Promise<void> | null = null;

async function initVideoEngine(): Promise<void> {
  // Initial scan so the resolver has data before the first generation.
  await scanVideoLibrary();

  videoLocalEngine.initialize(createVideoModelResolver(), getSdCliBinaryPath());
  videoLocalEngine.onModelUsed = (modelId) => usageStore.recordUse('video', modelId);

  if (!isSdCliInstalled()) {
    logEngine.warn('SdVideo', 'sd-cli binary not installed — local video generation disabled');
    return;
  }

  logEngine.info('SdVideo', 'Local video engine initialized (sd-cli available)');
}

/**
 * Lazy engine init (Wan / LTX / LingBot via sd-cli vid_gen; shares the sd-cli
 * binary with the image engine). Runs on the first video-generation IPC call
 * instead of at app startup (V1_RELEASE_PLAN.md Phase B).
 */
export function ensureSdVideoEngine(): Promise<void> {
  enginePromise ??= initVideoEngine().catch((err: unknown) => {
    enginePromise = null; // retry on the next call rather than caching failure
    throw err;
  });
  return enginePromise;
}
