import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SdImageStatusResponse,
  SdImageModelsListResponse,
  SdImageModelDownloadRequest,
  SdImageModelDownloadResponse,
  SdImageDownloadCompanionsRequest,
  SdImageDownloadCompanionsResponse,
  SdImageModelDeleteRequest,
  SdImageModelDeleteResponse,
  SdImageCliStatusResponse,
  SdImageCliInstallResponse,
  SdImageSetActiveModelRequest,
  SdImageSetActiveModelResponse,
  SdImageGenerateRequest,
  SdImageGenerateResponse,
  SdImageCancelRequest,
  SdImageCancelResponse,
  SdImageCancelAllResponse,
  SdImageQueueGetResponse,
  SdImageSettingsGetResponse,
  SdImageSettingsSaveRequest,
  SdImageSettingsSaveResponse,
  SdImageModelIpc,
} from '../../shared/ipc/types';
import { imageLocalEngine } from '../../local-image-engine';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';
import fs from 'fs/promises';
import { checkGenerationPrompt } from '../../moderation-engine/generation-gate';
import { ModerationBlockedError } from '../../shared/content-safety';
import { checkImageBase64 } from '../services/content-safety/image-safety';
import { recordBlocked } from '../services/content-safety/blocked-counters';
import { isSdCliInstalled, getSdCliBinaryPath } from '../services/sdimage-models';
import { installSdCli, isSdCliInstalling } from '../services/sdcli-install';
import { resetSdImageEngine } from '../services/sdimage-init';
import { refreshSdVideoBinary } from '../services/sdvideo-init';
import { scanImageLibrary, removeImageModel } from '../services/sdimage-library';
import { applySdGenerationPreflight } from '../services/sdimage-preflight';
import { applySdParamOverride } from '../services/image-model-params';
import { LOCAL_IMAGE_PROVIDER_ID } from '../services/image-init';
import { downloadProfileModel, downloadModelCompanions } from '../services/sdimage-download';
import { getSdImageSettings, saveSdImageSettings } from '../services/settings';

export async function handleSdImageStatus(
  _event: IpcMainInvokeEvent,
): Promise<SdImageStatusResponse> {
  return {
    sdCliInstalled: isSdCliInstalled(),
    activeModelId: imageLocalEngine.getActiveModelId(),
  };
}

/**
 * Legacy catalog-shaped list (kept for the Image AI Tester + orphaned hook
 * until Phase 3 migrates them to MODELS_SCAN). `downloaded` = a scanned
 * installed model matches the profile id. Custom models are surfaced via
 * MODELS_SCAN, not here.
 */
export async function handleSdImageModelsList(
  _event: IpcMainInvokeEvent,
): Promise<SdImageModelsListResponse> {
  try {
    const scan = await scanImageLibrary();
    const installedIds = new Set(scan.installed.map((m) => m.id));
    const result: SdImageModelIpc[] = SD_MODEL_CATALOG.map((p) => ({
      id: p.id,
      name: p.name,
      family: p.meta.family,
      sizeLabel: p.sizeLabel,
      sizeBytes: p.sizeBytes,
      downloaded: installedIds.has(p.id),
      defaults: p.meta.defaults,
      capabilities: p.meta.capabilities,
    }));
    return { models: result };
  } catch {
    return { models: [] };
  }
}

export async function handleSdImageModelDownload(
  event: IpcMainInvokeEvent,
  data: SdImageModelDownloadRequest,
): Promise<SdImageModelDownloadResponse> {
  try {
    await downloadProfileModel(data.modelId, (progress) => {
      event.sender.send(IPC.SDIMAGE_DOWNLOAD_PROGRESS, progress);
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

export async function handleSdImageDownloadCompanions(
  event: IpcMainInvokeEvent,
  data: SdImageDownloadCompanionsRequest,
): Promise<SdImageDownloadCompanionsResponse> {
  try {
    await downloadModelCompanions(data.modelId, (progress) => {
      event.sender.send(IPC.SDIMAGE_DOWNLOAD_PROGRESS, progress);
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Download failed',
    };
  }
}

export async function handleSdImageModelDelete(
  _event: IpcMainInvokeEvent,
  data: SdImageModelDeleteRequest,
): Promise<SdImageModelDeleteResponse> {
  try {
    await removeImageModel(data.modelId, { deleteFile: true });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

export async function handleSdImageCliStatus(
  _event: IpcMainInvokeEvent,
): Promise<SdImageCliStatusResponse> {
  return {
    installed: isSdCliInstalled(),
    path: getSdCliBinaryPath(),
    installing: isSdCliInstalling(),
  };
}

export async function handleSdImageCliInstall(
  _event: IpcMainInvokeEvent,
): Promise<SdImageCliInstallResponse> {
  try {
    if (!isSdCliInstalled() || isSdCliInstalling()) {
      await installSdCli();
      // Forget the memoized engine init so the next engine use resolves the
      // freshly installed binary instead of the missing bundled path — and
      // re-point the video engine, which shares the binary.
      resetSdImageEngine();
      refreshSdVideoBinary();
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'sd-cli install failed',
    };
  }
}

export async function handleSdImageSetActiveModel(
  _event: IpcMainInvokeEvent,
  data: SdImageSetActiveModelRequest,
): Promise<SdImageSetActiveModelResponse> {
  try {
    imageLocalEngine.setActiveModel(data.modelId);
    await saveSdImageSettings(data.modelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to set active model',
    };
  }
}

export async function handleSdImageGenerate(
  event: IpcMainInvokeEvent,
  data: SdImageGenerateRequest,
): Promise<SdImageGenerateResponse> {
  try {
    // Content Safety Gate A — the positive prompt only. The negative prompt
    // is deliberately unchecked: naming unsafe content there EXCLUDES it.
    const safety = checkGenerationPrompt(data.prompt);
    if (safety.blocked) {
      recordBlocked('prompt');
      throw new ModerationBlockedError('prompt', safety.category ?? 'sexual');
    }

    // Wire up push events for this generation
    imageLocalEngine.onProgress = (progress) => {
      event.sender.send(IPC.SDIMAGE_GENERATE_PROGRESS, progress);
    };
    imageLocalEngine.onComplete = (requestId, result) => {
      // Content Safety Gate B on the pixels — the local queue bypasses the
      // cloud image engine's chokepoint, and an arbitrary checkpoint is the
      // #1 leak path (D1). Fail-closed: any check failure blocks the result.
      void (async () => {
        try {
          await checkImageBase64(result.imageBase64);
          event.sender.send(IPC.SDIMAGE_GENERATE_COMPLETE, { requestId, result });
        } catch (err) {
          fs.unlink(result.outputPath).catch(() => {}); // never keep blocked pixels on disk
          const blocked = err instanceof ModerationBlockedError ? err.toBlockInfo() : undefined;
          event.sender.send(IPC.SDIMAGE_GENERATE_ERROR, {
            requestId,
            error: err instanceof Error ? err.message : 'Blocked by Content Safety',
            code: 'content-safety',
            blocked,
          });
        }
      })();
    };
    imageLocalEngine.onError = (requestId, error, code, details) => {
      event.sender.send(IPC.SDIMAGE_GENERATE_ERROR, { requestId, error, code, details });
    };

    const withOverride = applySdParamOverride(
      data,
      LOCAL_IMAGE_PROVIDER_ID,
      data.modelId ?? imageLocalEngine.getActiveModelId(),
    );
    const { request, autoOffloadEnabled } = await applySdGenerationPreflight(withOverride);

    const requestId = imageLocalEngine.enqueue(request);
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

export async function handleSdImageCancel(
  _event: IpcMainInvokeEvent,
  data: SdImageCancelRequest,
): Promise<SdImageCancelResponse> {
  const success = imageLocalEngine.cancel(data.requestId);
  return { success };
}

export async function handleSdImageCancelAll(
  _event: IpcMainInvokeEvent,
): Promise<SdImageCancelAllResponse> {
  imageLocalEngine.cancelAll();
  return { success: true };
}

export async function handleSdImageQueueGet(
  _event: IpcMainInvokeEvent,
): Promise<SdImageQueueGetResponse> {
  const queue = imageLocalEngine.getQueue();
  return {
    items: queue.map((item) => ({
      requestId: item.requestId,
      status: item.status,
      prompt: item.request.prompt,
    })),
  };
}

export async function handleSdImageSettingsGet(
  _event: IpcMainInvokeEvent,
): Promise<SdImageSettingsGetResponse> {
  try {
    return await getSdImageSettings();
  } catch {
    return { activeModelId: null };
  }
}

export async function handleSdImageSettingsSave(
  _event: IpcMainInvokeEvent,
  data: SdImageSettingsSaveRequest,
): Promise<SdImageSettingsSaveResponse> {
  try {
    await saveSdImageSettings(data.activeModelId);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save settings',
    };
  }
}
