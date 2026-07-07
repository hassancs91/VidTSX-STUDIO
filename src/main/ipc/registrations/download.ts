import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleDownloadEnqueue,
  handleDownloadPause,
  handleDownloadResume,
  handleDownloadCancel,
  handleDownloadGetAll,
  initDownloadProgressBroadcast,
} from '../download-handlers';

export function registerDownloadIpc(): void {
  ipcMain.handle(IPC.DOWNLOAD_ENQUEUE, handleDownloadEnqueue);
  ipcMain.handle(IPC.DOWNLOAD_PAUSE, handleDownloadPause);
  ipcMain.handle(IPC.DOWNLOAD_RESUME, handleDownloadResume);
  ipcMain.handle(IPC.DOWNLOAD_CANCEL, handleDownloadCancel);
  ipcMain.handle(IPC.DOWNLOAD_GET_ALL, handleDownloadGetAll);
  initDownloadProgressBroadcast();
}
