import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  TemplatesImportRequest,
  TemplatesImportResponse,
  TemplatesListResponse,
  TemplatesPackageOpenFileEvent,
  TemplatesPendingPackageResponse,
  TemplatesRemoveRequest,
  TemplatesRemoveResponse,
  TemplatesStageRequest,
  TemplatesStageResponse,
  TemplatesStateLoadRequest,
  TemplatesStateLoadResponse,
  TemplatesStateSaveRequest,
  TemplatesStateSaveResponse,
} from '../../shared/ipc/types';

export const templatesApi = {
  templatesList: (): Promise<TemplatesListResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_LIST),
  templatesStage: (data: TemplatesStageRequest): Promise<TemplatesStageResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_STAGE, data),
  templatesStateLoad: (data: TemplatesStateLoadRequest): Promise<TemplatesStateLoadResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_STATE_LOAD, data),
  templatesStateSave: (data: TemplatesStateSaveRequest): Promise<TemplatesStateSaveResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_STATE_SAVE, data),
  templatesImport: (data: TemplatesImportRequest = {}): Promise<TemplatesImportResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_IMPORT, data),
  templatesRemove: (data: TemplatesRemoveRequest): Promise<TemplatesRemoveResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_REMOVE, data),
  templatesPendingPackage: (): Promise<TemplatesPendingPackageResponse> =>
    ipcRenderer.invoke(IPC.TEMPLATES_PENDING_PACKAGE),
  onTemplatesPackageOpenFile: (callback: (event: TemplatesPackageOpenFileEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: TemplatesPackageOpenFileEvent) => callback(data);
    ipcRenderer.on(IPC.TEMPLATES_PACKAGE_OPEN_FILE, listener);
    return () => ipcRenderer.removeListener(IPC.TEMPLATES_PACKAGE_OPEN_FILE, listener);
  },
};
