import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleFileList,
  handleFileRead,
  handleFileWrite,
  handleFileDelete,
  handleFileCreateFolder,
  handleFileImport,
  handleFileReadBinary,
  handleFileRename,
  handleFileMove,
  handleFileGetProjectsDir,
  handleFileGetAssetsDir,
  handleDialogOpen,
  handleDialogSave,
} from '../file-handlers';

export function registerFileIpc(): void {
  ipcMain.handle(IPC.FILE_LIST, handleFileList);
  ipcMain.handle(IPC.FILE_READ, handleFileRead);
  ipcMain.handle(IPC.FILE_WRITE, handleFileWrite);
  ipcMain.handle(IPC.FILE_DELETE, handleFileDelete);
  ipcMain.handle(IPC.FILE_CREATE_FOLDER, handleFileCreateFolder);
  ipcMain.handle(IPC.FILE_IMPORT, handleFileImport);
  ipcMain.handle(IPC.FILE_READ_BINARY, handleFileReadBinary);
  ipcMain.handle(IPC.FILE_RENAME, handleFileRename);
  ipcMain.handle(IPC.FILE_MOVE, handleFileMove);
  ipcMain.handle(IPC.FILE_GET_PROJECTS_DIR, handleFileGetProjectsDir);
  ipcMain.handle(IPC.FILE_GET_ASSETS_DIR, handleFileGetAssetsDir);
  ipcMain.handle(IPC.DIALOG_OPEN, handleDialogOpen);
  ipcMain.handle(IPC.DIALOG_SAVE, handleDialogSave);
}
