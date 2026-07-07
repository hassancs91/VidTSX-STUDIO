import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ThumbnailReadRequest,
  ThumbnailReadResponse,
  ThumbnailReadyEvent,
} from '../../shared/ipc/types';

export const thumbnailApi = {
  // ─── Thumbnail operations ───
  // Thumbnail operations
  thumbnailRead: (data: ThumbnailReadRequest): Promise<ThumbnailReadResponse> =>
    ipcRenderer.invoke(IPC.THUMBNAIL_READ, data),
  onThumbnailReady: (callback: (data: ThumbnailReadyEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ThumbnailReadyEvent) => callback(data);
    ipcRenderer.on(IPC.THUMBNAIL_READY, handler);
    return () => ipcRenderer.removeListener(IPC.THUMBNAIL_READY, handler);
  },
};
