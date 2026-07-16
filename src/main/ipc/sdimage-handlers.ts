import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SdImageStatusResponse,
  SdImageModelsListResponse,
  SdImageModelDownloadRequest,
  SdImageModelDownloadResponse,
  SdImageModelDeleteRequest,
  SdImageModelDeleteResponse,
  SdImageCliStatusResponse,
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
import { ModelLibraryError } from '../../shared/model-library/types';
import { imageLocalEngine } from '../../local-image-engine';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';
import { isSdCliInstalled, getSdCliBinaryPath } from '../services/sdimage-models';
import { scanImageLibrary, removeImageModel, getLastScan } from '../services/sdimage-library';
import { evaluateInstalledFit } from '../services/sdimage-preflight';
import { downloadProfileModel } from '../services/sdimage-download';
import { getSdImageSettings, saveSdImageSettings } from '../services/settings';

/** True when the request already opts into any CPU-offload flag. */
function hasOffloadFlag(req: SdImageGenerateRequest): boolean {
  return Boolean(req.offloadToCpu || req.clipOnCpu || req.vaeOnCpu);
}

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
  };
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
    // Wire up push events for this generation
    imageLocalEngine.onProgress = (progress) => {
      event.sender.send(IPC.SDIMAGE_GENERATE_PROGRESS, progress);
    };
    imageLocalEngine.onComplete = (requestId, result) => {
      event.sender.send(IPC.SDIMAGE_GENERATE_COMPLETE, { requestId, result });
    };
    imageLocalEngine.onError = (requestId, error, code, details) => {
      event.sender.send(IPC.SDIMAGE_GENERATE_ERROR, { requestId, error, code, details });
    };

    // VRAM/RAM preflight (backlog A5): block models too big for VRAM *and* RAM
    // with a friendly typed error; auto-enable CPU offload for over-VRAM models
    // instead of letting sd-cli OOM. Missing/unscanned models fall through to the
    // engine's own "not installed" handling.
    let request = data;
    let autoOffloadEnabled = false;
    const modelId = data.modelId ?? imageLocalEngine.getActiveModelId();
    if (modelId) {
      const installed =
        getLastScan()?.installed.find((m) => m.id === modelId) ??
        (await scanImageLibrary()).installed.find((m) => m.id === modelId);
      if (installed) {
        const fit = await evaluateInstalledFit(installed);
        if (fit.level === 'wont-fit') {
          throw new ModelLibraryError('insufficient-memory', fit.reason);
        }
        if (fit.level === 'offload' && !hasOffloadFlag(request)) {
          request = { ...request, offloadToCpu: true };
          autoOffloadEnabled = true;
        }
      }
    }

    const requestId = imageLocalEngine.enqueue(request);
    return { success: true, requestId, autoOffloadEnabled: autoOffloadEnabled || undefined };
  } catch (err) {
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
