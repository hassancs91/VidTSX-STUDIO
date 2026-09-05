import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleSd3dCancel, handleSd3dGenerate } from '../sd3d-handlers';

export function registerSd3dIpc(): void {
  ipcMain.handle(IPC.SD3D_GENERATE, handleSd3dGenerate);
  ipcMain.handle(IPC.SD3D_CANCEL, handleSd3dCancel);
}
