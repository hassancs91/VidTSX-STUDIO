import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleContentSafetyStatus } from '../content-safety-handlers';

export function registerContentSafetyIpc(): void {
  ipcMain.handle(IPC.CONTENT_SAFETY_STATUS, handleContentSafetyStatus);
}
