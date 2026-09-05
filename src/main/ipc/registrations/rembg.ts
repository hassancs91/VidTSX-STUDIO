import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleRembgCancel, handleRembgRun } from '../rembg-handlers';

export function registerRembgIpc(): void {
  ipcMain.handle(IPC.REMBG_RUN, handleRembgRun);
  ipcMain.handle(IPC.REMBG_CANCEL, handleRembgCancel);
}
