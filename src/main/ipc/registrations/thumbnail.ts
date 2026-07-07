import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleThumbnailRead,
} from '../thumbnail-handlers';

export function registerThumbnailIpc(): void {
  ipcMain.handle(IPC.THUMBNAIL_READ, handleThumbnailRead);
}
