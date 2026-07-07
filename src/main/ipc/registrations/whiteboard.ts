import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleWhiteboardProjectList,
  handleWhiteboardProjectSave,
  handleWhiteboardProjectLoad,
  handleWhiteboardProjectDelete,
  handleWhiteboardUserSvgList,
  handleWhiteboardUserSvgSave,
  handleWhiteboardUserSvgDelete,
  handleWhiteboardUserImageList,
  handleWhiteboardUserImageUpload,
  handleWhiteboardUserImageDelete,
} from '../whiteboard-handlers';

export function registerWhiteboardIpc(): void {
  ipcMain.handle(IPC.WHITEBOARD_PROJECT_LIST, handleWhiteboardProjectList);
  ipcMain.handle(IPC.WHITEBOARD_PROJECT_SAVE, handleWhiteboardProjectSave);
  ipcMain.handle(IPC.WHITEBOARD_PROJECT_LOAD, handleWhiteboardProjectLoad);
  ipcMain.handle(IPC.WHITEBOARD_PROJECT_DELETE, handleWhiteboardProjectDelete);
  ipcMain.handle(IPC.WHITEBOARD_USER_SVG_LIST, handleWhiteboardUserSvgList);
  ipcMain.handle(IPC.WHITEBOARD_USER_SVG_SAVE, handleWhiteboardUserSvgSave);
  ipcMain.handle(IPC.WHITEBOARD_USER_SVG_DELETE, handleWhiteboardUserSvgDelete);
  ipcMain.handle(IPC.WHITEBOARD_USER_IMAGE_LIST, handleWhiteboardUserImageList);
  ipcMain.handle(IPC.WHITEBOARD_USER_IMAGE_UPLOAD, handleWhiteboardUserImageUpload);
  ipcMain.handle(IPC.WHITEBOARD_USER_IMAGE_DELETE, handleWhiteboardUserImageDelete);
}
