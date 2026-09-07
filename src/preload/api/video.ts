import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  VideoCancelRequest,
  VideoCancelResponse,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoJobProgressEvent,
  VideoJobResponse,
} from '../../shared/ipc/types/video';

export const videoApi = {
  videoGenerate: (data: VideoGenerateRequest): Promise<VideoGenerateResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_GENERATE, data),
  videoGetJob: (jobId: string): Promise<VideoJobResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_GET_JOB, jobId),
  videoCancel: (data: VideoCancelRequest): Promise<VideoCancelResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_CANCEL, data),
  onVideoJobProgress: (callback: (data: VideoJobProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: VideoJobProgressEvent) => callback(data);
    ipcRenderer.on(IPC.VIDEO_JOB_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.VIDEO_JOB_PROGRESS, handler); };
  },
};
