import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SdImageCancelAllResponse,
  SdImageCancelRequest,
  SdImageCancelResponse,
  SdImageCliStatusResponse,
  SdImageDownloadProgressEvent,
  SdImageGenerateCompleteEvent,
  SdImageGenerateErrorEvent,
  SdImageGenerateProgressEvent,
  SdImageGenerateRequest,
  SdImageGenerateResponse,
  SdImageModelDeleteRequest,
  SdImageModelDeleteResponse,
  SdImageModelDownloadRequest,
  SdImageModelDownloadResponse,
  SdImageModelsListResponse,
  SdImageQueueGetResponse,
  SdImageSetActiveModelRequest,
  SdImageSetActiveModelResponse,
  SdImageSettingsGetResponse,
  SdImageSettingsSaveRequest,
  SdImageSettingsSaveResponse,
  SdImageStatusResponse,
} from '../../shared/ipc/types';

export const sdImageApi = {
  // ─── Local SD image engine operations ───
  // Local SD image engine operations
  sdImageStatus: (): Promise<SdImageStatusResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_STATUS),
  sdImageModelsList: (): Promise<SdImageModelsListResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_MODELS_LIST),
  sdImageModelDownload: (data: SdImageModelDownloadRequest): Promise<SdImageModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_MODEL_DOWNLOAD, data),
  sdImageModelDelete: (data: SdImageModelDeleteRequest): Promise<SdImageModelDeleteResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_MODEL_DELETE, data),
  onSdImageDownloadProgress: (callback: (data: SdImageDownloadProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SdImageDownloadProgressEvent) => callback(data);
    ipcRenderer.on(IPC.SDIMAGE_DOWNLOAD_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.SDIMAGE_DOWNLOAD_PROGRESS, handler); };
  },
  sdImageCliStatus: (): Promise<SdImageCliStatusResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_CLI_STATUS),
  sdImageSetActiveModel: (data: SdImageSetActiveModelRequest): Promise<SdImageSetActiveModelResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_SET_ACTIVE_MODEL, data),
  sdImageGenerate: (data: SdImageGenerateRequest): Promise<SdImageGenerateResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_GENERATE, data),
  onSdImageGenerateProgress: (callback: (data: SdImageGenerateProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SdImageGenerateProgressEvent) => callback(data);
    ipcRenderer.on(IPC.SDIMAGE_GENERATE_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.SDIMAGE_GENERATE_PROGRESS, handler); };
  },
  onSdImageGenerateComplete: (callback: (data: SdImageGenerateCompleteEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SdImageGenerateCompleteEvent) => callback(data);
    ipcRenderer.on(IPC.SDIMAGE_GENERATE_COMPLETE, handler);
    return () => { ipcRenderer.removeListener(IPC.SDIMAGE_GENERATE_COMPLETE, handler); };
  },
  onSdImageGenerateError: (callback: (data: SdImageGenerateErrorEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SdImageGenerateErrorEvent) => callback(data);
    ipcRenderer.on(IPC.SDIMAGE_GENERATE_ERROR, handler);
    return () => { ipcRenderer.removeListener(IPC.SDIMAGE_GENERATE_ERROR, handler); };
  },
  sdImageCancel: (data: SdImageCancelRequest): Promise<SdImageCancelResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_CANCEL, data),
  sdImageCancelAll: (): Promise<SdImageCancelAllResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_CANCEL_ALL),
  sdImageQueueGet: (): Promise<SdImageQueueGetResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_QUEUE_GET),
  sdImageSettingsGet: (): Promise<SdImageSettingsGetResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_SETTINGS_GET),
  sdImageSettingsSave: (data: SdImageSettingsSaveRequest): Promise<SdImageSettingsSaveResponse> =>
    ipcRenderer.invoke(IPC.SDIMAGE_SETTINGS_SAVE, data),
};
