import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleHomepageGet,
} from '../homepage-handlers';

export function registerHomepageIpc(): void {
  ipcMain.handle(IPC.HOMEPAGE_GET, handleHomepageGet);
}
