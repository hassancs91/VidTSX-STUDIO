import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleModerationCheck,
} from '../moderation-handlers';

export function registerModerationIpc(): void {
  ipcMain.handle(IPC.MODERATION_CHECK, handleModerationCheck);
}
