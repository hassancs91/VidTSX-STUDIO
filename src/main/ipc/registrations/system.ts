import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleSystemInfoGet,
  handleSystemModelsFolderOpen,
  handleSystemRuntimeRemove,
  handleSystemRuntimesGet,
} from '../system-info-handlers';

export function registerSystemIpc(): void {
  ipcMain.handle(IPC.SYSTEM_INFO_GET, handleSystemInfoGet);
  ipcMain.handle(IPC.SYSTEM_RUNTIMES_GET, handleSystemRuntimesGet);
  ipcMain.handle(IPC.SYSTEM_RUNTIME_REMOVE, handleSystemRuntimeRemove);
  ipcMain.handle(IPC.SYSTEM_MODELS_FOLDER_OPEN, handleSystemModelsFolderOpen);
}
