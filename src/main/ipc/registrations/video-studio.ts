import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleVideoStudioSave,
  handleVideoStudioList,
  handleVideoStudioDelete,
  handleVideoStudioSaveAs,
  handleVideoStudioReadPath,
} from '../video-studio-handlers';
import {
  handleVideoStudioFolderCreate,
  handleVideoStudioFolderRename,
  handleVideoStudioFolderDelete,
  handleVideoStudioMoveToFolder,
} from '../video-studio-folder-handlers';

export function registerVideoStudioIpc(): void {
  ipcMain.handle(IPC.VIDEO_STUDIO_SAVE, handleVideoStudioSave);
  ipcMain.handle(IPC.VIDEO_STUDIO_LIST, handleVideoStudioList);
  ipcMain.handle(IPC.VIDEO_STUDIO_DELETE, handleVideoStudioDelete);
  ipcMain.handle(IPC.VIDEO_STUDIO_SAVE_AS, handleVideoStudioSaveAs);
  ipcMain.handle(IPC.VIDEO_STUDIO_READ_PATH, handleVideoStudioReadPath);
  ipcMain.handle(IPC.VIDEO_STUDIO_FOLDER_CREATE, handleVideoStudioFolderCreate);
  ipcMain.handle(IPC.VIDEO_STUDIO_FOLDER_RENAME, handleVideoStudioFolderRename);
  ipcMain.handle(IPC.VIDEO_STUDIO_FOLDER_DELETE, handleVideoStudioFolderDelete);
  ipcMain.handle(IPC.VIDEO_STUDIO_MOVE_TO_FOLDER, handleVideoStudioMoveToFolder);
}
