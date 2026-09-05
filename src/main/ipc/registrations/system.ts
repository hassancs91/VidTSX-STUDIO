import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleSystemInfoGet } from '../system-info-handlers';

export function registerSystemIpc(): void {
  ipcMain.handle(IPC.SYSTEM_INFO_GET, handleSystemInfoGet);
}
