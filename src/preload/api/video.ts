import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoJobResponse,
} from '../../shared/ipc/types/video';

export const videoApi = {
  videoGenerate: (data: VideoGenerateRequest): Promise<VideoGenerateResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_GENERATE, data),
  videoGetJob: (jobId: string): Promise<VideoJobResponse> =>
    ipcRenderer.invoke(IPC.VIDEO_GET_JOB, jobId),
};
