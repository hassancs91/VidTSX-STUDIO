import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleSdVideoModelDownload } from '../sdvideo-handlers';

export function registerSdVideoIpc(): void {
  ipcMain.handle(IPC.SDVIDEO_MODEL_DOWNLOAD, handleSdVideoModelDownload);
}
