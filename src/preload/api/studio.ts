import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioCacheReadRequest,
  StudioCacheReadResponse,
  StudioMediaImportRequest,
  StudioMediaImportResponse,
  StudioProjectCreateRequest,
  StudioProjectCreateResponse,
  StudioProjectDeleteRequest,
  StudioProjectDeleteResponse,
  StudioProjectListResponse,
  StudioProjectLoadRequest,
  StudioProjectLoadResponse,
  StudioProjectSaveRequest,
  StudioProjectSaveResponse,
  StudioRootGetResponse,
  StudioRootSetRequest,
  StudioRootSetResponse,
} from '../../shared/ipc/types';

export const studioApi = {
  // Studio (AI video editor) — projects & media
  studioRootGet: (): Promise<StudioRootGetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ROOT_GET),
  studioRootSet: (data: StudioRootSetRequest): Promise<StudioRootSetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ROOT_SET, data),
  studioProjectList: (): Promise<StudioProjectListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_LIST),
  studioProjectCreate: (data: StudioProjectCreateRequest): Promise<StudioProjectCreateResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_CREATE, data),
  studioProjectLoad: (data: StudioProjectLoadRequest): Promise<StudioProjectLoadResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_LOAD, data),
  studioProjectSave: (data: StudioProjectSaveRequest): Promise<StudioProjectSaveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_SAVE, data),
  studioProjectDelete: (data: StudioProjectDeleteRequest): Promise<StudioProjectDeleteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_DELETE, data),
  studioMediaImport: (data: StudioMediaImportRequest): Promise<StudioMediaImportResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_MEDIA_IMPORT, data),
  studioCacheRead: (data: StudioCacheReadRequest): Promise<StudioCacheReadResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CACHE_READ, data),
};
