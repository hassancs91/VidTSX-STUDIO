import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleHomeSummary } from '../home-handlers';

export function registerHomeIpc(): void {
  ipcMain.handle(IPC.HOME_SUMMARY, handleHomeSummary);
}
