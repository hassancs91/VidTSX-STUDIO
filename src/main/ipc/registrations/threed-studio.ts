import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleThreedStudioDelete,
  handleThreedStudioList,
  handleThreedStudioOpenFolder,
  handleThreedStudioRead,
  handleThreedStudioSaveAs,
  handleThreedStudioSaveToLibrary,
} from '../threed-studio-handlers';

export function registerThreedStudioIpc(): void {
  ipcMain.handle(IPC.THREED_STUDIO_LIST, handleThreedStudioList);
  ipcMain.handle(IPC.THREED_STUDIO_READ, handleThreedStudioRead);
  ipcMain.handle(IPC.THREED_STUDIO_DELETE, handleThreedStudioDelete);
  ipcMain.handle(IPC.THREED_STUDIO_SAVE_AS, handleThreedStudioSaveAs);
  ipcMain.handle(IPC.THREED_STUDIO_SAVE_TO_LIBRARY, handleThreedStudioSaveToLibrary);
  ipcMain.handle(IPC.THREED_STUDIO_OPEN_FOLDER, handleThreedStudioOpenFolder);
}
