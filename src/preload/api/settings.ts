import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  DialogOpenFolderResponse,
  SettingsGetResponse,
  SettingsSetAiModelsFolderRequest,
  SettingsSetAiModelsFolderResponse,
  SettingsSetOutputFolderRequest,
  SettingsSetOutputFolderResponse,
  SettingsSetRenderDefaultCpuUsageRequest,
  SettingsSetRenderDefaultCpuUsageResponse,
  SettingsSetRenderDefaultGpuBackendRequest,
  SettingsSetRenderDefaultGpuBackendResponse,
  SettingsSetRenderDefaultHardwareAccelerationRequest,
  SettingsSetRenderDefaultHardwareAccelerationResponse,
  SettingsSetRenderDefaultExportEngineRequest,
  SettingsSetRenderDefaultExportEngineResponse,
  SettingsSetRenderDefaultExportOutputRequest,
  SettingsSetRenderDefaultExportOutputResponse,
  SettingsSetCrashReportingRequest,
  SettingsSetCrashReportingResponse,
  SettingsSetRenderTimeoutRequest,
  SettingsSetRenderTimeoutResponse,
  SettingsSetWhisperModelRequest,
  SettingsSetWhisperModelResponse,
} from '../../shared/ipc/types';

export const settingsApi = {
  // ─── Settings operations ───
  // Settings operations
  settingsGet: (): Promise<SettingsGetResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_GET),
  settingsSetOutputFolder: (data: SettingsSetOutputFolderRequest): Promise<SettingsSetOutputFolderResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_OUTPUT_FOLDER, data),
  settingsSetWhisperModel: (data: SettingsSetWhisperModelRequest): Promise<SettingsSetWhisperModelResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_WHISPER_MODEL, data),
  settingsSetAiModelsFolder: (data: SettingsSetAiModelsFolderRequest): Promise<SettingsSetAiModelsFolderResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_AI_MODELS_FOLDER, data),
  settingsSetRenderTimeout: (data: SettingsSetRenderTimeoutRequest): Promise<SettingsSetRenderTimeoutResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_RENDER_TIMEOUT, data),
  settingsSetRenderDefaultCpuUsage: (data: SettingsSetRenderDefaultCpuUsageRequest): Promise<SettingsSetRenderDefaultCpuUsageResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_RENDER_DEFAULT_CPU_USAGE, data),
  settingsSetRenderDefaultGpuBackend: (data: SettingsSetRenderDefaultGpuBackendRequest): Promise<SettingsSetRenderDefaultGpuBackendResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_RENDER_DEFAULT_GPU_BACKEND, data),
  settingsSetRenderDefaultHardwareAcceleration: (data: SettingsSetRenderDefaultHardwareAccelerationRequest): Promise<SettingsSetRenderDefaultHardwareAccelerationResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_RENDER_DEFAULT_HARDWARE_ACCELERATION, data),
  settingsSetRenderDefaultExportEngine: (data: SettingsSetRenderDefaultExportEngineRequest): Promise<SettingsSetRenderDefaultExportEngineResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_RENDER_DEFAULT_EXPORT_ENGINE, data),
  settingsSetRenderDefaultExportOutput: (data: SettingsSetRenderDefaultExportOutputRequest): Promise<SettingsSetRenderDefaultExportOutputResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_RENDER_DEFAULT_EXPORT_OUTPUT, data),
  settingsSetCrashReporting: (data: SettingsSetCrashReportingRequest): Promise<SettingsSetCrashReportingResponse> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET_CRASH_REPORTING, data),
  dialogOpenFolder: (): Promise<DialogOpenFolderResponse> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER),
};
