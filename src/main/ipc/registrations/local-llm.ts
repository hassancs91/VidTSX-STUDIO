import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleLocalLlmStatus,
  handleLocalLlmModelsList,
  handleLocalLlmModelDownload,
  handleLocalLlmModelDelete,
  handleLocalLlmLoadModel,
  handleLocalLlmUnloadModel,
  handleLocalLlmGenerate,
  handleLocalLlmChat,
  handleLocalLlmCancel,
  handleLocalLlmSessionClear,
  handleLocalLlmGpuInfo,
  handleLocalLlmSettingsGet,
  handleLocalLlmSettingsSave,
} from '../llm-local-handlers';
import { ensureLocalLlmEngine } from '../../services/llm-local-init';
import { lazily } from './lazy';

export function registerLocalLlmIpc(): void {
  // Engine-runtime handlers import node-llama-cpp (+ GPU probe) on first
  // call; catalog/download/settings handlers stay engine-free.
  ipcMain.handle(IPC.LOCAL_LLM_STATUS, lazily(ensureLocalLlmEngine, handleLocalLlmStatus));
  ipcMain.handle(IPC.LOCAL_LLM_MODELS_LIST, handleLocalLlmModelsList);
  ipcMain.handle(IPC.LOCAL_LLM_MODEL_DOWNLOAD, handleLocalLlmModelDownload);
  ipcMain.handle(IPC.LOCAL_LLM_MODEL_DELETE, handleLocalLlmModelDelete);
  ipcMain.handle(IPC.LOCAL_LLM_LOAD_MODEL, lazily(ensureLocalLlmEngine, handleLocalLlmLoadModel));
  ipcMain.handle(IPC.LOCAL_LLM_UNLOAD_MODEL, lazily(ensureLocalLlmEngine, handleLocalLlmUnloadModel));
  ipcMain.handle(IPC.LOCAL_LLM_GENERATE, lazily(ensureLocalLlmEngine, handleLocalLlmGenerate));
  ipcMain.handle(IPC.LOCAL_LLM_CHAT, lazily(ensureLocalLlmEngine, handleLocalLlmChat));
  ipcMain.handle(IPC.LOCAL_LLM_CANCEL, handleLocalLlmCancel);
  ipcMain.handle(IPC.LOCAL_LLM_SESSION_CLEAR, handleLocalLlmSessionClear);
  ipcMain.handle(IPC.LOCAL_LLM_GPU_INFO, lazily(ensureLocalLlmEngine, handleLocalLlmGpuInfo));
  ipcMain.handle(IPC.LOCAL_LLM_SETTINGS_GET, handleLocalLlmSettingsGet);
  ipcMain.handle(IPC.LOCAL_LLM_SETTINGS_SAVE, handleLocalLlmSettingsSave);
}
