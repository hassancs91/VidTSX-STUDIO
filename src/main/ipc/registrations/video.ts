import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleVideoGenerate,
  handleVideoGetJob,
  handleVideoCancel,
  handleVideoProvidersGet,
  handleVideoModelsGet,
  handleVideoProviderTest,
  registerVideoJobProgressPush,
} from '../video-handlers';

export function registerVideoIpc(): void {
  ipcMain.handle(IPC.VIDEO_GENERATE, handleVideoGenerate);
  ipcMain.handle(IPC.VIDEO_GET_JOB, handleVideoGetJob);
  ipcMain.handle(IPC.VIDEO_CANCEL, handleVideoCancel);
  ipcMain.handle(IPC.VIDEO_PROVIDERS_GET, handleVideoProvidersGet);
  ipcMain.handle(IPC.VIDEO_MODELS_GET, handleVideoModelsGet);
  ipcMain.handle(IPC.VIDEO_PROVIDER_TEST, handleVideoProviderTest);
  registerVideoJobProgressPush();
}
