import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleSdVideoCancel,
  handleSdVideoGenerate,
  handleSdVideoModelDownload,
} from '../sdvideo-handlers';

export function registerSdVideoIpc(): void {
  ipcMain.handle(IPC.SDVIDEO_MODEL_DOWNLOAD, handleSdVideoModelDownload);
  ipcMain.handle(IPC.SDVIDEO_GENERATE, handleSdVideoGenerate);
  ipcMain.handle(IPC.SDVIDEO_CANCEL, handleSdVideoCancel);
}
