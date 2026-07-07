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
import { imageLocalEngine } from '../../local-image-engine';
import { SD_MODEL_CATALOG } from '../../local-image-engine/model-registry';
import {
  isSdModelDownloaded,
  downloadSdModel,
  deleteSdModel,
  isSdCliInstalled,
  getSdCliBinaryPath,
} from '../services/sdimage-models';
import { getSdImageSettings, saveSdImageSettings } from '../services/settings';

export async function handleSdImageStatus(
  _event: IpcMainInvokeEvent,
): Promise<SdImageStatusResponse> {
  return {
    sdCliInstalled: isSdCliInstalled(),
    activeModelId: imageLocalEngine.getActiveModelId(),
  };
}

export async function handleSdImageModelsList(
  _event: IpcMainInvokeEvent,
): Promise<SdImageModelsListResponse> {
  try {
    const models = imageLocalEngine.getAvailableModels();
    const result: SdImageModelIpc[] = models.map((m) => ({
      id: m.id,
      name: m.name,
      family: m.family,
      sizeLabel: m.sizeLabel,
      sizeBytes: m.sizeBytes,
      downloaded: isSdModelDownloaded(m.id),
      defaults: m.defaults,
      capabilities: m.capabilities,
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
    await downloadSdModel(data.modelId, (progress) => {
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
    await deleteSdModel(data.modelId);
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
    imageLocalEngine.onError = (requestId, error) => {
      event.sender.send(IPC.SDIMAGE_GENERATE_ERROR, { requestId, error });
    };

    const requestId = imageLocalEngine.enqueue(data);
    return { success: true, requestId };
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
