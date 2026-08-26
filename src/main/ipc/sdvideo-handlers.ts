import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SdVideoCancelRequest,
  SdVideoCancelResponse,
  SdVideoGenerateRequest,
  SdVideoGenerateResponse,
  SdVideoModelDownloadRequest,
  SdVideoModelDownloadResponse,
} from '../../shared/ipc/types';
import fs from 'fs/promises';
import { ModelLibraryError } from '@shared/model-library/types';
import { checkGenerationPrompt } from '../../moderation-engine/generation-gate';
import { ModerationBlockedError } from '../../shared/content-safety';
import { checkVideoFile } from '../services/content-safety/video-safety';
import { recordBlocked } from '../services/content-safety/blocked-counters';
import { downloadVideoProfileModel } from '../services/sdvideo-download';
import { getLastVideoScan, scanVideoLibrary, videoProfileById } from '../services/sdvideo-library';
import { videoLocalEngine } from '../../local-video-engine/video-engine';
import { fitFor } from '../services/sdimage-preflight';
import { getPreflightHardware } from '../services/system-info';

/**
 * One-click video profile download (model + missing companions). Progress
 * reaches the renderer through the global DOWNLOAD_PROGRESS broadcast
 * (metadata.type === 'sdvideo-model') — no per-category progress channel.
 */
export async function handleSdVideoModelDownload(
  _event: IpcMainInvokeEvent,
  data: SdVideoModelDownloadRequest,
): Promise<SdVideoModelDownloadResponse> {
  try {
    await downloadVideoProfileModel(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

export async function handleSdVideoGenerate(
  event: IpcMainInvokeEvent,
  data: SdVideoGenerateRequest,
): Promise<SdVideoGenerateResponse> {
  try {
    // Content Safety Gate A — the positive prompt only. The negative prompt
    // is deliberately unchecked: naming unsafe content there EXCLUDES it.
    const safety = checkGenerationPrompt(data.prompt);
    if (safety.blocked) {
      recordBlocked('prompt');
      throw new ModerationBlockedError('prompt', safety.category ?? 'sexual');
    }

    // Wire up push events for this generation
    videoLocalEngine.onProgress = (progress) => {
      event.sender.send(IPC.SDVIDEO_GENERATE_PROGRESS, progress);
    };
    videoLocalEngine.onComplete = (requestId, result) => {
      // Content Safety Gate B on the sampled frames — an arbitrary local
      // checkpoint is the #1 leak path (D1). Fail-closed on check failure.
      void (async () => {
        try {
          await checkVideoFile(result.outputPath);
          event.sender.send(IPC.SDVIDEO_GENERATE_COMPLETE, { requestId, result });
        } catch (err) {
          fs.unlink(result.outputPath).catch(() => {}); // never keep blocked pixels on disk
          const blocked = err instanceof ModerationBlockedError ? err.toBlockInfo() : undefined;
          event.sender.send(IPC.SDVIDEO_GENERATE_ERROR, {
            requestId,
            error: err instanceof Error ? err.message : 'Blocked by Content Safety',
            code: 'content-safety',
            blocked,
          });
        }
      })();
    };
    videoLocalEngine.onError = (requestId, error, code, details) => {
      event.sender.send(IPC.SDVIDEO_GENERATE_ERROR, { requestId, error, code, details });
    };

    // VRAM/RAM preflight (mirrors image A5): hard-block only when the model
    // fits neither VRAM nor RAM; auto-enable CPU offload when it is over VRAM.
    let request = data;
    let autoOffloadEnabled = false;
    const installed =
      getLastVideoScan()?.installed.find((m) => m.id === data.modelId) ??
      (await scanVideoLibrary()).installed.find((m) => m.id === data.modelId);
    if (installed) {
      const profile = videoProfileById(installed.id);
      const fit = fitFor(
        { minVramGB: profile?.requirements?.minVramGB, sizeBytes: installed.sizeBytes },
        await getPreflightHardware(),
      );
      if (fit.level === 'wont-fit') {
        throw new ModelLibraryError('insufficient-memory', fit.reason);
      }
      if (fit.level === 'offload' && request.offloadToCpu === undefined) {
        request = { ...request, offloadToCpu: true };
        autoOffloadEnabled = true;
      }
    }

    const requestId = videoLocalEngine.enqueue(request);
    return { success: true, requestId, autoOffloadEnabled: autoOffloadEnabled || undefined };
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      return { success: false, error: err.message, blocked: err.toBlockInfo() };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Generation failed',
    };
  }
}

export async function handleSdVideoCancel(
  _event: IpcMainInvokeEvent,
  data: SdVideoCancelRequest,
): Promise<SdVideoCancelResponse> {
  const success = videoLocalEngine.cancel(data.requestId);
  return { success };
}
