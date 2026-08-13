import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleSdImageStatus,
  handleSdImageModelsList,
  handleSdImageModelDownload,
  handleSdImageDownloadCompanions,
  handleSdImageModelDelete,
  handleSdImageCliStatus,
  handleSdImageCliInstall,
  handleSdImageSetActiveModel,
  handleSdImageGenerate,
  handleSdImageCancel,
  handleSdImageCancelAll,
  handleSdImageQueueGet,
  handleSdImageSettingsGet,
  handleSdImageSettingsSave,
} from '../sdimage-handlers';
import { ensureSdImageEngine } from '../../services/sdimage-init';
import { lazily } from './lazy';

export function registerSdImageIpc(): void {
  // Engine-touching handlers run the first models-folder scan + engine init
  // on first call; download/delete/settings handlers stay engine-free.
  ipcMain.handle(IPC.SDIMAGE_STATUS, lazily(ensureSdImageEngine, handleSdImageStatus));
  ipcMain.handle(IPC.SDIMAGE_MODELS_LIST, handleSdImageModelsList);
  ipcMain.handle(IPC.SDIMAGE_MODEL_DOWNLOAD, handleSdImageModelDownload);
  ipcMain.handle(IPC.SDIMAGE_DOWNLOAD_COMPANIONS, handleSdImageDownloadCompanions);
  ipcMain.handle(IPC.SDIMAGE_MODEL_DELETE, handleSdImageModelDelete);
  ipcMain.handle(IPC.SDIMAGE_CLI_STATUS, handleSdImageCliStatus);
  ipcMain.handle(IPC.SDIMAGE_CLI_INSTALL, handleSdImageCliInstall);
  ipcMain.handle(IPC.SDIMAGE_SET_ACTIVE_MODEL, lazily(ensureSdImageEngine, handleSdImageSetActiveModel));
  ipcMain.handle(IPC.SDIMAGE_GENERATE, lazily(ensureSdImageEngine, handleSdImageGenerate));
  ipcMain.handle(IPC.SDIMAGE_CANCEL, handleSdImageCancel);
  ipcMain.handle(IPC.SDIMAGE_CANCEL_ALL, handleSdImageCancelAll);
  ipcMain.handle(IPC.SDIMAGE_QUEUE_GET, handleSdImageQueueGet);
  ipcMain.handle(IPC.SDIMAGE_SETTINGS_GET, handleSdImageSettingsGet);
  ipcMain.handle(IPC.SDIMAGE_SETTINGS_SAVE, handleSdImageSettingsSave);
}
