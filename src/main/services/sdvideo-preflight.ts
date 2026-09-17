import { ModelLibraryError } from '@shared/model-library/types';
import type { VideoGenerationRequest } from '../../local-video-engine/types';
import { getLastVideoScan, scanVideoLibrary, videoProfileById } from './sdvideo-library';
import { fitFor } from './sdimage-preflight';
import { getPreflightHardware } from './system-info';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('SdVideoPreflight');

/**
 * VRAM / RAM preflight for a local video generation, injected into the
 * LocalSdVideoProvider (the image provider's `prepare` precedent, so the
 * provider stays free of main-process imports). Mirrors the image rule (A5):
 * a model that fits neither VRAM nor RAM is refused with a typed error; one
 * that is over VRAM runs with CPU offload turned on instead of letting sd-cli
 * run out of memory. Unscanned or unknown models fall through to the
 * engine's own "not installed" handling.
 */
export async function applySdVideoPreflight(request: VideoGenerationRequest): Promise<VideoGenerationRequest> {
  const installed =
    getLastVideoScan()?.installed.find((m) => m.id === request.modelId) ??
    (await scanVideoLibrary()).installed.find((m) => m.id === request.modelId);
  if (!installed) return request;

  const profile = videoProfileById(installed.id);
  const fit = fitFor(
    { minVramGB: profile?.requirements?.minVramGB, sizeBytes: installed.sizeBytes },
    await getPreflightHardware(),
  );
  if (fit.level === 'wont-fit') {
    throw new ModelLibraryError('insufficient-memory', fit.reason);
  }
  if (fit.level === 'offload' && request.offloadToCpu === undefined) {
    log.info('CPU offload auto-enabled (model larger than VRAM)', { modelId: request.modelId });
    return { ...request, offloadToCpu: true };
  }
  return request;
}
