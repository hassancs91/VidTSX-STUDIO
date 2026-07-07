import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  DownloadControlRequest,
  DownloadControlResponse,
  DownloadEnqueueRequest,
  DownloadEnqueueResponse,
  DownloadGetAllResponse,
  DownloadProgressEvent,
} from '../../shared/ipc/types';

export const downloadApi = {
  // ─── Download manager operations ───
  // Download manager operations
  downloadEnqueue: (data: DownloadEnqueueRequest): Promise<DownloadEnqueueResponse> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_ENQUEUE, data),
  downloadPause: (data: DownloadControlRequest): Promise<DownloadControlResponse> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_PAUSE, data),
  downloadResume: (data: DownloadControlRequest): Promise<DownloadControlResponse> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_RESUME, data),
  downloadCancel: (data: DownloadControlRequest): Promise<DownloadControlResponse> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_CANCEL, data),
  downloadGetAll: (): Promise<DownloadGetAllResponse> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_GET_ALL),
  onDownloadProgress: (callback: (data: DownloadProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DownloadProgressEvent) => callback(data);
    ipcRenderer.on(IPC.DOWNLOAD_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.DOWNLOAD_PROGRESS, handler); };
  },
};
