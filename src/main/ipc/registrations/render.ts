import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleRenderStart,
  handleRenderCancel,
  handleRenderQueueGet,
  handleRenderQueueSave,
  handleRenderQueueLoad,
  handleRenderOpenFile,
  handleRenderOpenFolder,
  handleRenderGetVideosDir,
  handleRenderHistoryLoad,
  handleRenderHistoryAppend,
} from '../render-handlers';

export function registerRenderIpc(): void {
  ipcMain.handle(IPC.RENDER_START, handleRenderStart);
  ipcMain.handle(IPC.RENDER_CANCEL, handleRenderCancel);
  ipcMain.handle(IPC.RENDER_QUEUE_GET, handleRenderQueueGet);
  ipcMain.handle(IPC.RENDER_QUEUE_SAVE, handleRenderQueueSave);
  ipcMain.handle(IPC.RENDER_QUEUE_LOAD, handleRenderQueueLoad);
  ipcMain.handle(IPC.RENDER_OPEN_FILE, handleRenderOpenFile);
  ipcMain.handle(IPC.RENDER_OPEN_FOLDER, handleRenderOpenFolder);
  ipcMain.handle(IPC.RENDER_GET_VIDEOS_DIR, handleRenderGetVideosDir);
  ipcMain.handle(IPC.RENDER_HISTORY_LOAD, handleRenderHistoryLoad);
  ipcMain.handle(IPC.RENDER_HISTORY_APPEND, handleRenderHistoryAppend);
}
