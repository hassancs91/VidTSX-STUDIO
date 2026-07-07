import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleStudioFfprobe,
  handleStudioProjectList,
  handleStudioProjectSave,
  handleStudioProjectLoad,
  handleStudioProjectDelete,
  handleStudioTsxSave,
  handleStudioTsxGetPath,
  handleStudioPresetList,
  handleStudioPresetSave,
  handleStudioPresetDelete,
  handleStudioBrandList,
  handleStudioBrandSave,
  handleStudioBrandDelete,
} from '../studio-handlers';
import {
  handleTsxAnalyze,
} from '../llm-handlers';
import { handleStudioRenderStart } from '../studio-render-handlers';
import {
  handleStudioProxyGenerate,
  handleStudioProxyCancel,
  handleStudioProxyVerify,
} from '../studio-proxy-handlers';

export function registerStudioIpc(): void {
  ipcMain.handle(IPC.STUDIO_FFPROBE, handleStudioFfprobe);
  ipcMain.handle(IPC.STUDIO_PROXY_GENERATE, handleStudioProxyGenerate);
  ipcMain.handle(IPC.STUDIO_PROXY_CANCEL, handleStudioProxyCancel);
  ipcMain.handle(IPC.STUDIO_PROXY_VERIFY, handleStudioProxyVerify);
  ipcMain.handle(IPC.STUDIO_RENDER_START, handleStudioRenderStart);
  ipcMain.handle(IPC.STUDIO_PROJECT_LIST, handleStudioProjectList);
  ipcMain.handle(IPC.STUDIO_PROJECT_SAVE, handleStudioProjectSave);
  ipcMain.handle(IPC.STUDIO_PROJECT_LOAD, handleStudioProjectLoad);
  ipcMain.handle(IPC.STUDIO_PROJECT_DELETE, handleStudioProjectDelete);
  ipcMain.handle(IPC.STUDIO_TSX_ANALYZE, handleTsxAnalyze);
  ipcMain.handle(IPC.STUDIO_TSX_SAVE, handleStudioTsxSave);
  ipcMain.handle(IPC.STUDIO_TSX_GET_PATH, handleStudioTsxGetPath);
  ipcMain.handle(IPC.STUDIO_PRESET_LIST, handleStudioPresetList);
  ipcMain.handle(IPC.STUDIO_PRESET_SAVE, handleStudioPresetSave);
  ipcMain.handle(IPC.STUDIO_PRESET_DELETE, handleStudioPresetDelete);
  ipcMain.handle(IPC.STUDIO_BRAND_LIST, handleStudioBrandList);
  ipcMain.handle(IPC.STUDIO_BRAND_SAVE, handleStudioBrandSave);
  ipcMain.handle(IPC.STUDIO_BRAND_DELETE, handleStudioBrandDelete);
}
