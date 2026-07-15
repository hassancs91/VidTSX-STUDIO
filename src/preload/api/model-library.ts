import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ModelsConfigureRequest,
  ModelsConfigureResponse,
  ModelsImportRequest,
  ModelsImportResponse,
  ModelsOpenFolderRequest,
  ModelsOpenFolderResponse,
  ModelsRemoveRequest,
  ModelsRemoveResponse,
  ModelsScanRequest,
  ModelsScanResponse,
  ModelsSetFolderRequest,
  ModelsSetFolderResponse,
  ModelsUsageGetRequest,
  ModelsUsageGetResponse,
} from '../../shared/ipc/types';

export const modelLibraryApi = {
  modelsScan: (data: ModelsScanRequest): Promise<ModelsScanResponse> =>
    ipcRenderer.invoke(IPC.MODELS_SCAN, data),
  modelsImport: (data: ModelsImportRequest): Promise<ModelsImportResponse> =>
    ipcRenderer.invoke(IPC.MODELS_IMPORT, data),
  modelsConfigure: (data: ModelsConfigureRequest): Promise<ModelsConfigureResponse> =>
    ipcRenderer.invoke(IPC.MODELS_CONFIGURE, data),
  modelsRemove: (data: ModelsRemoveRequest): Promise<ModelsRemoveResponse> =>
    ipcRenderer.invoke(IPC.MODELS_REMOVE, data),
  modelsUsageGet: (data: ModelsUsageGetRequest): Promise<ModelsUsageGetResponse> =>
    ipcRenderer.invoke(IPC.MODELS_USAGE_GET, data),
  modelsOpenFolder: (data: ModelsOpenFolderRequest): Promise<ModelsOpenFolderResponse> =>
    ipcRenderer.invoke(IPC.MODELS_OPEN_FOLDER, data),
  modelsSetFolder: (data: ModelsSetFolderRequest): Promise<ModelsSetFolderResponse> =>
    ipcRenderer.invoke(IPC.MODELS_SET_FOLDER, data),
};
