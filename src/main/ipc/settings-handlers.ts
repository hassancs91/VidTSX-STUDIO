import { dialog, IpcMainInvokeEvent } from 'electron';
import { getOutputFolder, setOutputFolder, getWhisperModel, setWhisperModel, getAiModelsFolder, setAiModelsFolder, getRenderTimeoutSeconds, setRenderTimeoutSeconds, getRenderDefaultCpuUsage, setRenderDefaultCpuUsage, getRenderDefaultGpuBackend, setRenderDefaultGpuBackend, getRenderDefaultHardwareAcceleration, setRenderDefaultHardwareAcceleration, getRenderDefaultExportEngine, setRenderDefaultExportEngine, getCrashReportingEnabled, setCrashReportingEnabled, getPromptPresets, savePromptPresets, resetPromptPresets } from '../services/settings';
import { DEFAULT_EXPORT_ENGINE_ID, isExportEngineId } from '../../shared/studio/export-engines';
import { isCrashReportingAvailable, setCrashReportingConsent } from '../services/crash-reporting';
import { setAiModelsFolderPath } from '../services/audio-models';
import type {
  SettingsGetResponse,
  SettingsSetOutputFolderRequest,
  SettingsSetOutputFolderResponse,
  SettingsSetWhisperModelRequest,
  SettingsSetWhisperModelResponse,
  SettingsSetAiModelsFolderRequest,
  SettingsSetAiModelsFolderResponse,
  SettingsSetRenderTimeoutRequest,
  SettingsSetRenderTimeoutResponse,
  SettingsSetRenderDefaultCpuUsageRequest,
  SettingsSetRenderDefaultCpuUsageResponse,
  SettingsSetRenderDefaultGpuBackendRequest,
  SettingsSetRenderDefaultGpuBackendResponse,
  SettingsSetRenderDefaultHardwareAccelerationRequest,
  SettingsSetRenderDefaultHardwareAccelerationResponse,
  SettingsSetRenderDefaultExportEngineRequest,
  SettingsSetRenderDefaultExportEngineResponse,
  SettingsSetCrashReportingRequest,
  SettingsSetCrashReportingResponse,
  DialogOpenFolderResponse,
  PromptPresetsSaveRequest,
} from '../../shared/ipc/types';

export async function handleSettingsGet(): Promise<SettingsGetResponse> {
  try {
    const outputFolder = await getOutputFolder();
    const aiModelsFolder = await getAiModelsFolder();
    const whisperModel = await getWhisperModel();
    const renderTimeoutSeconds = await getRenderTimeoutSeconds();
    const renderDefaultCpuUsage = await getRenderDefaultCpuUsage();
    const renderDefaultGpuBackend = await getRenderDefaultGpuBackend();
    const renderDefaultHardwareAcceleration = await getRenderDefaultHardwareAcceleration();
    const renderDefaultExportEngine = await getRenderDefaultExportEngine();
    const crashReportingEnabled = await getCrashReportingEnabled();
    return { outputFolder, aiModelsFolder, whisperModel, renderTimeoutSeconds, renderDefaultCpuUsage, renderDefaultGpuBackend, renderDefaultHardwareAcceleration, renderDefaultExportEngine, crashReportingEnabled, crashReportingAvailable: isCrashReportingAvailable() };
  } catch (err) {
    // Return defaults on error, let UI handle default
    return { outputFolder: '', aiModelsFolder: '', whisperModel: 'base', renderTimeoutSeconds: 600, renderDefaultCpuUsage: 'medium', renderDefaultGpuBackend: 'swangle', renderDefaultHardwareAcceleration: 'if-possible', renderDefaultExportEngine: DEFAULT_EXPORT_ENGINE_ID, crashReportingEnabled: false, crashReportingAvailable: false };
  }
}

export async function handleSettingsSetRenderDefaultExportEngine(
  _event: IpcMainInvokeEvent,
  data: SettingsSetRenderDefaultExportEngineRequest
): Promise<SettingsSetRenderDefaultExportEngineResponse> {
  try {
    if (!isExportEngineId(data.exportEngine)) {
      return { success: false, error: `Unknown export engine: ${String(data.exportEngine)}` };
    }
    await setRenderDefaultExportEngine(data.exportEngine);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleSettingsSetOutputFolder(
  _event: IpcMainInvokeEvent,
  data: SettingsSetOutputFolderRequest
): Promise<SettingsSetOutputFolderResponse> {
  try {
    if (!data.path) {
      return { success: false, error: 'Path is required' };
    }

    await setOutputFolder(data.path);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleSettingsSetAiModelsFolder(
  _event: IpcMainInvokeEvent,
  data: SettingsSetAiModelsFolderRequest,
): Promise<SettingsSetAiModelsFolderResponse> {
  try {
    if (!data.path) {
      return { success: false, error: 'Path is required' };
    }

    await setAiModelsFolder(data.path);
    // Update the cached path used by audio-models service
    setAiModelsFolderPath(data.path);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleDialogOpenFolder(): Promise<DialogOpenFolderResponse> {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Output Folder',
    });

    return {
      folderPath: result.filePaths[0] || null,
      canceled: result.canceled,
    };
  } catch {
    return { folderPath: null, canceled: true };
  }
}

export async function handleSettingsSetWhisperModel(
  _event: IpcMainInvokeEvent,
  data: SettingsSetWhisperModelRequest
): Promise<SettingsSetWhisperModelResponse> {
  try {
    if (!data.modelId) {
      return { success: false, error: 'Model ID is required' };
    }

    await setWhisperModel(data.modelId);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleSettingsSetRenderTimeout(
  _event: IpcMainInvokeEvent,
  data: SettingsSetRenderTimeoutRequest
): Promise<SettingsSetRenderTimeoutResponse> {
  try {
    if (typeof data.seconds !== 'number' || !Number.isFinite(data.seconds)) {
      return { success: false, error: 'seconds must be a finite number' };
    }
    await setRenderTimeoutSeconds(data.seconds);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleSettingsSetRenderDefaultCpuUsage(
  _event: IpcMainInvokeEvent,
  data: SettingsSetRenderDefaultCpuUsageRequest
): Promise<SettingsSetRenderDefaultCpuUsageResponse> {
  try {
    if (!data.cpuUsage) {
      return { success: false, error: 'cpuUsage is required' };
    }
    await setRenderDefaultCpuUsage(data.cpuUsage);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleSettingsSetRenderDefaultGpuBackend(
  _event: IpcMainInvokeEvent,
  data: SettingsSetRenderDefaultGpuBackendRequest
): Promise<SettingsSetRenderDefaultGpuBackendResponse> {
  try {
    if (!data.gpuBackend) {
      return { success: false, error: 'gpuBackend is required' };
    }
    await setRenderDefaultGpuBackend(data.gpuBackend);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleSettingsSetRenderDefaultHardwareAcceleration(
  _event: IpcMainInvokeEvent,
  data: SettingsSetRenderDefaultHardwareAccelerationRequest
): Promise<SettingsSetRenderDefaultHardwareAccelerationResponse> {
  try {
    if (!data.hardwareAcceleration) {
      return { success: false, error: 'hardwareAcceleration is required' };
    }
    await setRenderDefaultHardwareAcceleration(data.hardwareAcceleration);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handleSettingsSetCrashReporting(
  _event: IpcMainInvokeEvent,
  data: SettingsSetCrashReportingRequest
): Promise<SettingsSetCrashReportingResponse> {
  try {
    if (typeof data.enabled !== 'boolean') {
      return { success: false, error: 'enabled must be a boolean' };
    }
    await setCrashReportingEnabled(data.enabled);
    // Apply immediately — no restart needed for JS error capture.
    setCrashReportingConsent(data.enabled);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save settings';
    return { success: false, error };
  }
}

export async function handlePromptPresetsGet() {
  try {
    return await getPromptPresets();
  } catch {
    return { contentPresets: [], stylePresets: [] };
  }
}

export async function handlePromptPresetsSave(
  _event: IpcMainInvokeEvent,
  data: PromptPresetsSaveRequest
) {
  try {
    await savePromptPresets(data.contentPresets, data.stylePresets);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save presets';
    return { success: false, error };
  }
}

export async function handlePromptPresetsReset() {
  try {
    return await resetPromptPresets();
  } catch {
    return { contentPresets: [], stylePresets: [] };
  }
}

export const settingsHandlers = {
  handleSettingsGet,
  handleSettingsSetOutputFolder,
  handleSettingsSetWhisperModel,
  handleSettingsSetRenderTimeout,
  handleSettingsSetRenderDefaultCpuUsage,
  handleSettingsSetRenderDefaultGpuBackend,
  handleSettingsSetRenderDefaultHardwareAcceleration,
  handleSettingsSetRenderDefaultExportEngine,
  handleSettingsSetCrashReporting,
  handleDialogOpenFolder,
  handlePromptPresetsGet,
  handlePromptPresetsSave,
  handlePromptPresetsReset,
};
