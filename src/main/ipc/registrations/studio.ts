import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleStudioRootGet,
  handleStudioRootSet,
  handleStudioProjectList,
  handleStudioProjectCreate,
  handleStudioProjectLoad,
  handleStudioProjectSave,
  handleStudioProjectDelete,
  handleStudioMediaImport,
  handleStudioCacheRead,
} from '../studio-handlers';

export function registerStudioIpc(): void {
  ipcMain.handle(IPC.STUDIO_ROOT_GET, handleStudioRootGet);
  ipcMain.handle(IPC.STUDIO_ROOT_SET, handleStudioRootSet);
  ipcMain.handle(IPC.STUDIO_PROJECT_LIST, handleStudioProjectList);
  ipcMain.handle(IPC.STUDIO_PROJECT_CREATE, handleStudioProjectCreate);
  ipcMain.handle(IPC.STUDIO_PROJECT_LOAD, handleStudioProjectLoad);
  ipcMain.handle(IPC.STUDIO_PROJECT_SAVE, handleStudioProjectSave);
  ipcMain.handle(IPC.STUDIO_PROJECT_DELETE, handleStudioProjectDelete);
  ipcMain.handle(IPC.STUDIO_MEDIA_IMPORT, handleStudioMediaImport);
  ipcMain.handle(IPC.STUDIO_CACHE_READ, handleStudioCacheRead);
}
