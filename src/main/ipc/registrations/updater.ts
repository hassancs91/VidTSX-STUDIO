import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleUpdaterCancel,
  handleUpdaterCheck,
  handleUpdaterDownload,
  handleUpdaterGetState,
  handleUpdaterInstall,
  handleUpdaterSetPrefs,
} from '../updater-handlers';

export function registerUpdaterIpc(): void {
  ipcMain.handle(IPC.UPDATER_GET_STATE, handleUpdaterGetState);
  ipcMain.handle(IPC.UPDATER_CHECK, handleUpdaterCheck);
  ipcMain.handle(IPC.UPDATER_DOWNLOAD, handleUpdaterDownload);
  ipcMain.handle(IPC.UPDATER_CANCEL, handleUpdaterCancel);
  ipcMain.handle(IPC.UPDATER_INSTALL, handleUpdaterInstall);
  ipcMain.handle(IPC.UPDATER_SET_PREFS, handleUpdaterSetPrefs);
}
