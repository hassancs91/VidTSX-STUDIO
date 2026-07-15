import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleModelsConfigure,
  handleModelsImport,
  handleModelsOpenFolder,
  handleModelsRemove,
  handleModelsScan,
  handleModelsSetFolder,
  handleModelsUsageGet,
} from '../model-library-handlers';

export function registerModelLibraryIpc(): void {
  ipcMain.handle(IPC.MODELS_SCAN, handleModelsScan);
  ipcMain.handle(IPC.MODELS_IMPORT, handleModelsImport);
  ipcMain.handle(IPC.MODELS_CONFIGURE, handleModelsConfigure);
  ipcMain.handle(IPC.MODELS_REMOVE, handleModelsRemove);
  ipcMain.handle(IPC.MODELS_USAGE_GET, handleModelsUsageGet);
  ipcMain.handle(IPC.MODELS_OPEN_FOLDER, handleModelsOpenFolder);
  ipcMain.handle(IPC.MODELS_SET_FOLDER, handleModelsSetFolder);
}
