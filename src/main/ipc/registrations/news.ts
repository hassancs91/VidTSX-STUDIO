import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleNewsDismiss, handleNewsGet, handleNewsSetEnabled } from '../news-handlers';

export function registerNewsIpc(): void {
  ipcMain.handle(IPC.NEWS_GET, handleNewsGet);
  ipcMain.handle(IPC.NEWS_DISMISS, handleNewsDismiss);
  ipcMain.handle(IPC.NEWS_SET_ENABLED, handleNewsSetEnabled);
}
