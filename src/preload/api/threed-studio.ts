import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ThreedStudioDeleteRequest,
  ThreedStudioDeleteResponse,
  ThreedStudioListResponse,
  ThreedStudioOpenFolderRequest,
  ThreedStudioOpenFolderResponse,
  ThreedStudioReadRequest,
  ThreedStudioReadResponse,
  ThreedStudioSaveAsRequest,
  ThreedStudioSaveAsResponse,
  ThreedStudioSaveToLibraryRequest,
  ThreedStudioSaveToLibraryResponse,
} from '../../shared/ipc/types';

export const threedStudioApi = {
  // ─── 3D Studio storage ───
  threedStudioList: (): Promise<ThreedStudioListResponse> =>
    ipcRenderer.invoke(IPC.THREED_STUDIO_LIST),
  threedStudioRead: (data: ThreedStudioReadRequest): Promise<ThreedStudioReadResponse> =>
    ipcRenderer.invoke(IPC.THREED_STUDIO_READ, data),
  threedStudioDelete: (data: ThreedStudioDeleteRequest): Promise<ThreedStudioDeleteResponse> =>
    ipcRenderer.invoke(IPC.THREED_STUDIO_DELETE, data),
  threedStudioSaveAs: (data: ThreedStudioSaveAsRequest): Promise<ThreedStudioSaveAsResponse> =>
    ipcRenderer.invoke(IPC.THREED_STUDIO_SAVE_AS, data),
  threedStudioSaveToLibrary: (data: ThreedStudioSaveToLibraryRequest): Promise<ThreedStudioSaveToLibraryResponse> =>
    ipcRenderer.invoke(IPC.THREED_STUDIO_SAVE_TO_LIBRARY, data),
  threedStudioOpenFolder: (data: ThreedStudioOpenFolderRequest = {}): Promise<ThreedStudioOpenFolderResponse> =>
    ipcRenderer.invoke(IPC.THREED_STUDIO_OPEN_FOLDER, data),
};
