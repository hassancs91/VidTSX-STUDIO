import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  LocalLlmCancelResponse,
  LocalLlmChatRequest,
  LocalLlmChatResponse,
  LocalLlmCompleteEvent,
  LocalLlmDownloadProgressEvent,
  LocalLlmGenerateRequest,
  LocalLlmGenerateResponse,
  LocalLlmGpuInfoResponse,
  LocalLlmLoadModelRequest,
  LocalLlmLoadModelResponse,
  LocalLlmModelDeleteRequest,
  LocalLlmModelDeleteResponse,
  LocalLlmModelDownloadRequest,
  LocalLlmModelDownloadResponse,
  LocalLlmModelsListResponse,
  LocalLlmSessionClearRequest,
  LocalLlmSessionClearResponse,
  LocalLlmSettingsGetResponse,
  LocalLlmSettingsSaveRequest,
  LocalLlmSettingsSaveResponse,
  LocalLlmStatusResponse,
  LocalLlmTokenEvent,
  LocalLlmUnloadModelResponse,
} from '../../shared/ipc/types';

export const localLlmApi = {
  // ─── Local LLM engine operations ───
  // Local LLM engine operations
  localLlmStatus: (): Promise<LocalLlmStatusResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_STATUS),
  localLlmModelsList: (): Promise<LocalLlmModelsListResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_MODELS_LIST),
  localLlmModelDownload: (data: LocalLlmModelDownloadRequest): Promise<LocalLlmModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_MODEL_DOWNLOAD, data),
  localLlmModelDelete: (data: LocalLlmModelDeleteRequest): Promise<LocalLlmModelDeleteResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_MODEL_DELETE, data),
  onLocalLlmDownloadProgress: (callback: (data: LocalLlmDownloadProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: LocalLlmDownloadProgressEvent) => callback(data);
    ipcRenderer.on(IPC.LOCAL_LLM_DOWNLOAD_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.LOCAL_LLM_DOWNLOAD_PROGRESS, handler); };
  },
  localLlmLoadModel: (data: LocalLlmLoadModelRequest): Promise<LocalLlmLoadModelResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_LOAD_MODEL, data),
  localLlmUnloadModel: (): Promise<LocalLlmUnloadModelResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_UNLOAD_MODEL),
  localLlmGenerate: (data: LocalLlmGenerateRequest): Promise<LocalLlmGenerateResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_GENERATE, data),
  localLlmChat: (data: LocalLlmChatRequest): Promise<LocalLlmChatResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_CHAT, data),
  onLocalLlmToken: (callback: (data: LocalLlmTokenEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: LocalLlmTokenEvent) => callback(data);
    ipcRenderer.on(IPC.LOCAL_LLM_TOKEN, handler);
    return () => { ipcRenderer.removeListener(IPC.LOCAL_LLM_TOKEN, handler); };
  },
  onLocalLlmComplete: (callback: (data: LocalLlmCompleteEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: LocalLlmCompleteEvent) => callback(data);
    ipcRenderer.on(IPC.LOCAL_LLM_COMPLETE, handler);
    return () => { ipcRenderer.removeListener(IPC.LOCAL_LLM_COMPLETE, handler); };
  },
  localLlmCancel: (): Promise<LocalLlmCancelResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_CANCEL),
  localLlmSessionClear: (data: LocalLlmSessionClearRequest): Promise<LocalLlmSessionClearResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_SESSION_CLEAR, data),
  localLlmGpuInfo: (): Promise<LocalLlmGpuInfoResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_GPU_INFO),
  localLlmSettingsGet: (): Promise<LocalLlmSettingsGetResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_SETTINGS_GET),
  localLlmSettingsSave: (data: LocalLlmSettingsSaveRequest): Promise<LocalLlmSettingsSaveResponse> =>
    ipcRenderer.invoke(IPC.LOCAL_LLM_SETTINGS_SAVE, data),
};
