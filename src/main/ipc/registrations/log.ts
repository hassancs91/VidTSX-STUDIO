import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleLogWrite,
} from '../log-handlers';

export function registerLogIpc(): void {
  ipcMain.handle(IPC.LOG_WRITE, handleLogWrite);
}
