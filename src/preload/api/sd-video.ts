import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { SdVideoModelDownloadRequest, SdVideoModelDownloadResponse } from '../../shared/ipc/types';

export const sdVideoApi = {
  sdVideoModelDownload: (data: SdVideoModelDownloadRequest): Promise<SdVideoModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.SDVIDEO_MODEL_DOWNLOAD, data),
};
