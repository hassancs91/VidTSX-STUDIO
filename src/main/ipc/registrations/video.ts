import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleVideoGenerate, handleVideoGetJob } from '../video-handlers';

export function registerVideoIpc(): void {
  ipcMain.handle(IPC.VIDEO_GENERATE, handleVideoGenerate);
  ipcMain.handle(IPC.VIDEO_GET_JOB, handleVideoGetJob);
}
