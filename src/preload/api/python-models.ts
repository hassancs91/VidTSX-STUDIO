import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  PythonModelCancelDownloadRequest,
  PythonModelCancelDownloadResponse,
  PythonModelDownloadRequest,
  PythonModelDownloadResponse,
  PythonModelInstallRequest,
  PythonModelInstallResponse,
  PythonModelPreflightRequest,
  PythonModelPreflightResponse,
  PythonModelRemoveRequest,
  PythonModelRemoveResponse,
  PythonModelStatusRequest,
  PythonModelStatusResponse,
} from '../../shared/ipc/types';

export const pythonModelsApi = {
  // ─── Runtime-backed Python models (catalogue) ───
  pythonModelStatus: (data: PythonModelStatusRequest = {}): Promise<PythonModelStatusResponse> =>
    ipcRenderer.invoke(IPC.PYMODEL_STATUS, data),
  pythonModelDownload: (data: PythonModelDownloadRequest): Promise<PythonModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.PYMODEL_DOWNLOAD, data),
  pythonModelCancelDownload: (data: PythonModelCancelDownloadRequest): Promise<PythonModelCancelDownloadResponse> =>
    ipcRenderer.invoke(IPC.PYMODEL_CANCEL_DOWNLOAD, data),
  pythonModelRemove: (data: PythonModelRemoveRequest): Promise<PythonModelRemoveResponse> =>
    ipcRenderer.invoke(IPC.PYMODEL_REMOVE, data),
  pythonModelPreflight: (data: PythonModelPreflightRequest): Promise<PythonModelPreflightResponse> =>
    ipcRenderer.invoke(IPC.PYMODEL_PREFLIGHT, data),
  pythonModelInstall: (data: PythonModelInstallRequest): Promise<PythonModelInstallResponse> =>
    ipcRenderer.invoke(IPC.PYMODEL_INSTALL, data),
};
