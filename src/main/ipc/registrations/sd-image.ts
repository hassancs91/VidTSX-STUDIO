import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleSdImageStatus,
  handleSdImageModelsList,
  handleSdImageModelDownload,
  handleSdImageModelDelete,
  handleSdImageCliStatus,
  handleSdImageSetActiveModel,
  handleSdImageGenerate,
  handleSdImageCancel,
  handleSdImageCancelAll,
  handleSdImageQueueGet,
  handleSdImageSettingsGet,
  handleSdImageSettingsSave,
} from '../sdimage-handlers';

export function registerSdImageIpc(): void {
  ipcMain.handle(IPC.SDIMAGE_STATUS, handleSdImageStatus);
  ipcMain.handle(IPC.SDIMAGE_MODELS_LIST, handleSdImageModelsList);
  ipcMain.handle(IPC.SDIMAGE_MODEL_DOWNLOAD, handleSdImageModelDownload);
  ipcMain.handle(IPC.SDIMAGE_MODEL_DELETE, handleSdImageModelDelete);
  ipcMain.handle(IPC.SDIMAGE_CLI_STATUS, handleSdImageCliStatus);
  ipcMain.handle(IPC.SDIMAGE_SET_ACTIVE_MODEL, handleSdImageSetActiveModel);
  ipcMain.handle(IPC.SDIMAGE_GENERATE, handleSdImageGenerate);
  ipcMain.handle(IPC.SDIMAGE_CANCEL, handleSdImageCancel);
  ipcMain.handle(IPC.SDIMAGE_CANCEL_ALL, handleSdImageCancelAll);
  ipcMain.handle(IPC.SDIMAGE_QUEUE_GET, handleSdImageQueueGet);
  ipcMain.handle(IPC.SDIMAGE_SETTINGS_GET, handleSdImageSettingsGet);
  ipcMain.handle(IPC.SDIMAGE_SETTINGS_SAVE, handleSdImageSettingsSave);
}
