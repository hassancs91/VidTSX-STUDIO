import { videoLocalEngine } from '../../local-video-engine/video-engine';
import { getSdCliBinaryPath, isSdCliInstalled } from './sdimage-models';
import { createVideoModelResolver, initVideoLibrary } from './sdvideo-library';
import { usageStore } from './model-usage';
import { logEngine } from '../../logging/log-engine';

/**
 * Register the video category + initialize the local video engine (Wan / LTX /
 * LingBot via sd-cli vid_gen). Shares the sd-cli binary with the image engine.
 */
export async function initVideoEngine(): Promise<void> {
  await initVideoLibrary();

  videoLocalEngine.initialize(createVideoModelResolver(), getSdCliBinaryPath());
  videoLocalEngine.onModelUsed = (modelId) => usageStore.recordUse('video', modelId);

  if (!isSdCliInstalled()) {
    logEngine.warn('SdVideo', 'sd-cli binary not installed — local video generation disabled');
    return;
  }

  logEngine.info('SdVideo', 'Local video engine initialized (sd-cli available)');
}
