import type { IpcMainInvokeEvent } from 'electron';
import type {
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoJobResponse,
} from '../../shared/ipc/types/video';
import { submitVideoJob, getVideoJob } from '../services/video-generation';
import { ModerationBlockedError } from '../../shared/content-safety';

export async function handleVideoGenerate(
  _event: IpcMainInvokeEvent,
  req: VideoGenerateRequest,
): Promise<VideoGenerateResponse> {
  try {
    const jobId = await submitVideoJob(req);
    return { success: true, data: { jobId } };
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      return { success: false, error: err.message, blocked: err.toBlockInfo() };
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function handleVideoGetJob(
  _event: IpcMainInvokeEvent,
  jobId: string,
): Promise<VideoJobResponse> {
  try {
    const data = await getVideoJob(jobId);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
