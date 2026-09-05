import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handlePythonModelCancelDownload,
  handlePythonModelDownload,
  handlePythonModelInstall,
  handlePythonModelPreflight,
  handlePythonModelRemove,
  handlePythonModelStatus,
} from '../python-models-handlers';

export function registerPythonModelsIpc(): void {
  ipcMain.handle(IPC.PYMODEL_STATUS, handlePythonModelStatus);
  ipcMain.handle(IPC.PYMODEL_DOWNLOAD, handlePythonModelDownload);
  ipcMain.handle(IPC.PYMODEL_CANCEL_DOWNLOAD, handlePythonModelCancelDownload);
  ipcMain.handle(IPC.PYMODEL_REMOVE, handlePythonModelRemove);
  ipcMain.handle(IPC.PYMODEL_PREFLIGHT, handlePythonModelPreflight);
  ipcMain.handle(IPC.PYMODEL_INSTALL, handlePythonModelInstall);
}
