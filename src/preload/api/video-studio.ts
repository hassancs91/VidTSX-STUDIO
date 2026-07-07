import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  VideoStudioSaveRequest,
  VideoStudioSaveResponse,
  VideoStudioListResponse,
  VideoStudioDeleteRequest,
  VideoStudioDeleteResponse,
  VideoStudioSaveAsRequest,
  VideoStudioSaveAsResponse,
  VideoStudioReadPathRequest,
  VideoStudioReadPathResponse,
  VideoStudioFolderCreateRequest,
  VideoStudioFolderCreateResponse,
  VideoStudioFolderRenameRequest,
  VideoStudioFolderRenameResponse,
  VideoStudioFolderDeleteRequest,
  VideoStudioFolderDeleteResponse,
  VideoStudioMoveToFolderRequest,
  VideoStudioMoveToFolderResponse,
} from '../../shared/ipc/types';

export const videoStudioApi = {
  videoStudioSave: (data: VideoStudioSaveRequest): Promise<VideoStudioSaveResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_SAVE, data),
  videoStudioList: (): Promise<VideoStudioListResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_LIST),
  videoStudioDelete: (data: VideoStudioDeleteRequest): Promise<VideoStudioDeleteResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_DELETE, data),
  videoStudioSaveAs: (data: VideoStudioSaveAsRequest): Promise<VideoStudioSaveAsResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_SAVE_AS, data),
  videoStudioReadPath: (data: VideoStudioReadPathRequest): Promise<VideoStudioReadPathResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_READ_PATH, data),
  videoStudioFolderCreate: (data: VideoStudioFolderCreateRequest): Promise<VideoStudioFolderCreateResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_FOLDER_CREATE, data),
  videoStudioFolderRename: (data: VideoStudioFolderRenameRequest): Promise<VideoStudioFolderRenameResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_FOLDER_RENAME, data),
  videoStudioFolderDelete: (data: VideoStudioFolderDeleteRequest): Promise<VideoStudioFolderDeleteResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_FOLDER_DELETE, data),
  videoStudioMoveToFolder: (data: VideoStudioMoveToFolderRequest): Promise<VideoStudioMoveToFolderResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_STUDIO_MOVE_TO_FOLDER, data),
};
