import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleSdVideoCancel,
  handleSdVideoGenerate,
  handleSdVideoModelDownload,
} from '../sdvideo-handlers';
import { ensureSdVideoEngine } from '../../services/sdvideo-init';
import { lazily } from './lazy';

export function registerSdVideoIpc(): void {
  ipcMain.handle(IPC.SDVIDEO_MODEL_DOWNLOAD, handleSdVideoModelDownload);
  // Generation runs the first video-models scan + engine init on first call.
  ipcMain.handle(IPC.SDVIDEO_GENERATE, lazily(ensureSdVideoEngine, handleSdVideoGenerate));
  ipcMain.handle(IPC.SDVIDEO_CANCEL, handleSdVideoCancel);
}
