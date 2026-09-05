import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleSettingsGet,
  handleSettingsSetOutputFolder,
  handleSettingsSetWhisperModel,
  handleSettingsSetAiModelsFolder,
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
} from '../settings-handlers';

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.SETTINGS_GET, handleSettingsGet);
  ipcMain.handle(IPC.SETTINGS_SET_OUTPUT_FOLDER, handleSettingsSetOutputFolder);
  ipcMain.handle(IPC.SETTINGS_SET_WHISPER_MODEL, handleSettingsSetWhisperModel);
  ipcMain.handle(IPC.SETTINGS_SET_AI_MODELS_FOLDER, handleSettingsSetAiModelsFolder);
  ipcMain.handle(IPC.SETTINGS_SET_RENDER_TIMEOUT, handleSettingsSetRenderTimeout);
  ipcMain.handle(IPC.SETTINGS_SET_RENDER_DEFAULT_CPU_USAGE, handleSettingsSetRenderDefaultCpuUsage);
  ipcMain.handle(IPC.SETTINGS_SET_RENDER_DEFAULT_GPU_BACKEND, handleSettingsSetRenderDefaultGpuBackend);
  ipcMain.handle(IPC.SETTINGS_SET_RENDER_DEFAULT_HARDWARE_ACCELERATION, handleSettingsSetRenderDefaultHardwareAcceleration);
  ipcMain.handle(IPC.SETTINGS_SET_RENDER_DEFAULT_EXPORT_ENGINE, handleSettingsSetRenderDefaultExportEngine);
  ipcMain.handle(IPC.SETTINGS_SET_CRASH_REPORTING, handleSettingsSetCrashReporting);
  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, handleDialogOpenFolder);
  ipcMain.handle(IPC.PROMPT_PRESETS_GET, handlePromptPresetsGet);
  ipcMain.handle(IPC.PROMPT_PRESETS_SAVE, handlePromptPresetsSave);
  ipcMain.handle(IPC.PROMPT_PRESETS_RESET, handlePromptPresetsReset);
}
