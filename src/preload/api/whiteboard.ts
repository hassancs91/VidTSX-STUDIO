import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  WhiteboardProjectDeleteRequest,
  WhiteboardProjectDeleteResponse,
  WhiteboardProjectListResponse,
  WhiteboardProjectLoadRequest,
  WhiteboardProjectLoadResponse,
  WhiteboardProjectSaveRequest,
  WhiteboardProjectSaveResponse,
  WhiteboardUserImageDeleteRequest,
  WhiteboardUserImageDeleteResponse,
  WhiteboardUserImageListResponse,
  WhiteboardUserImageUploadRequest,
  WhiteboardUserImageUploadResponse,
  WhiteboardUserSvgDeleteRequest,
  WhiteboardUserSvgDeleteResponse,
  WhiteboardUserSvgListResponse,
  WhiteboardUserSvgSaveRequest,
  WhiteboardUserSvgSaveResponse,
} from '../../shared/ipc/types';

export const whiteboardApi = {
  // ─── Whiteboard projects ───
  // Whiteboard projects
  whiteboardProjectList: (): Promise<WhiteboardProjectListResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_PROJECT_LIST),
  whiteboardProjectSave: (data: WhiteboardProjectSaveRequest): Promise<WhiteboardProjectSaveResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_PROJECT_SAVE, data),
  whiteboardProjectLoad: (data: WhiteboardProjectLoadRequest): Promise<WhiteboardProjectLoadResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_PROJECT_LOAD, data),
  whiteboardProjectDelete: (data: WhiteboardProjectDeleteRequest): Promise<WhiteboardProjectDeleteResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_PROJECT_DELETE, data),

  // ─── Whiteboard user SVG library ───
  // Whiteboard user SVG library
  whiteboardUserSvgList: (): Promise<WhiteboardUserSvgListResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_USER_SVG_LIST),
  whiteboardUserSvgSave: (data: WhiteboardUserSvgSaveRequest): Promise<WhiteboardUserSvgSaveResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_USER_SVG_SAVE, data),
  whiteboardUserSvgDelete: (data: WhiteboardUserSvgDeleteRequest): Promise<WhiteboardUserSvgDeleteResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_USER_SVG_DELETE, data),

  // ─── Whiteboard user image library ───
  // Whiteboard user image library
  whiteboardUserImageList: (): Promise<WhiteboardUserImageListResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_USER_IMAGE_LIST),
  whiteboardUserImageUpload: (data: WhiteboardUserImageUploadRequest): Promise<WhiteboardUserImageUploadResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_USER_IMAGE_UPLOAD, data),
  whiteboardUserImageDelete: (data: WhiteboardUserImageDeleteRequest): Promise<WhiteboardUserImageDeleteResponse> =>
    ipcRenderer.invoke(IPC.WHITEBOARD_USER_IMAGE_DELETE, data),
};
