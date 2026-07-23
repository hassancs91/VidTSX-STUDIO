import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SdVideoCancelRequest,
  SdVideoCancelResponse,
  SdVideoGenerateCompleteEvent,
  SdVideoGenerateErrorEvent,
  SdVideoGenerateProgressEvent,
  SdVideoGenerateRequest,
  SdVideoGenerateResponse,
  SdVideoModelDownloadRequest,
  SdVideoModelDownloadResponse,
} from '../../shared/ipc/types';

export const sdVideoApi = {
  sdVideoModelDownload: (data: SdVideoModelDownloadRequest): Promise<SdVideoModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.SDVIDEO_MODEL_DOWNLOAD, data),
  sdVideoGenerate: (data: SdVideoGenerateRequest): Promise<SdVideoGenerateResponse> =>
    ipcRenderer.invoke(IPC.SDVIDEO_GENERATE, data),
  sdVideoCancel: (data: SdVideoCancelRequest): Promise<SdVideoCancelResponse> =>
    ipcRenderer.invoke(IPC.SDVIDEO_CANCEL, data),
  onSdVideoGenerateProgress: (callback: (data: SdVideoGenerateProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SdVideoGenerateProgressEvent) => callback(data);
    ipcRenderer.on(IPC.SDVIDEO_GENERATE_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.SDVIDEO_GENERATE_PROGRESS, handler); };
  },
  onSdVideoGenerateComplete: (callback: (data: SdVideoGenerateCompleteEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SdVideoGenerateCompleteEvent) => callback(data);
    ipcRenderer.on(IPC.SDVIDEO_GENERATE_COMPLETE, handler);
    return () => { ipcRenderer.removeListener(IPC.SDVIDEO_GENERATE_COMPLETE, handler); };
  },
  onSdVideoGenerateError: (callback: (data: SdVideoGenerateErrorEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SdVideoGenerateErrorEvent) => callback(data);
    ipcRenderer.on(IPC.SDVIDEO_GENERATE_ERROR, handler);
    return () => { ipcRenderer.removeListener(IPC.SDVIDEO_GENERATE_ERROR, handler); };
  },
};
