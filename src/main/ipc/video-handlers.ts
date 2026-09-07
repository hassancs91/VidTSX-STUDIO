import { BrowserWindow } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { pathToFileURL } from 'url';
import { IPC } from '../../shared/ipc/channels';
import type {
  VideoCancelRequest,
  VideoCancelResponse,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoJobData,
  VideoJobResponse,
} from '../../shared/ipc/types/video';
import { videoEngine, mediaInputFromString } from '../../video-engine';
import type { VideoJobRecord } from '../../video-engine';
import { initVideoEngine } from '../services/video-init';
import { ModerationBlockedError } from '../../shared/content-safety';

/** Job record → the IPC shape. The URL is the gated local clip, never remote. */
export function toVideoJobData(record: VideoJobRecord): VideoJobData {
  return {
    jobId: record.jobId,
    status: record.status,
    providerId: record.providerId,
    modelUsed: record.request.model,
    durationSeconds: record.request.durationSeconds,
    aspectRatio: record.request.aspectRatio,
    hasAudio: record.request.generateAudio,
    ...(record.result
      ? { videoUrl: pathToFileURL(record.result.filePath).href, entry: record.result.entry }
      : {}),
    ...(record.error ? { error: record.error } : {}),
    ...(record.blocked ? { blocked: record.blocked } : {}),
  };
}

export async function handleVideoGenerate(
  _event: IpcMainInvokeEvent,
  req: VideoGenerateRequest,
): Promise<VideoGenerateResponse> {
  try {
    // A key entered since startup registers on save; this covers a first
    // call that races that re-init.
    if (videoEngine.getProviders().length === 0) await initVideoEngine();
    const record = await videoEngine.submit({
      ...(req.providerId ? { providerId: req.providerId } : {}),
      model: req.model,
      prompt: req.prompt,
      durationSeconds: req.durationSeconds,
      aspectRatio: req.aspectRatio,
      ...(req.generateAudio !== undefined ? { generateAudio: req.generateAudio } : {}),
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
      ...(req.firstFrame ? { firstFrame: mediaInputFromString(req.firstFrame) } : {}),
      ...(req.lastFrame ? { lastFrame: mediaInputFromString(req.lastFrame) } : {}),
      ...(req.folderId !== undefined ? { folderId: req.folderId } : {}),
      featureSource: req.featureSource ?? 'flows',
    });
    return { success: true, data: { jobId: record.jobId } };
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
  const record = videoEngine.getJob(jobId);
  if (!record) {
    return { success: false, error: `Unknown video job "${jobId}" (jobs do not survive app restarts).` };
  }
  return { success: true, data: toVideoJobData(record) };
}

export async function handleVideoCancel(
  _event: IpcMainInvokeEvent,
  req: VideoCancelRequest,
): Promise<VideoCancelResponse> {
  try {
    await videoEngine.cancel(req.jobId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Bridge every job update to `video:job-progress` on every window. */
export function registerVideoJobProgressPush(): () => void {
  return videoEngine.subscribe((record) => {
    const data = toVideoJobData(record);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.VIDEO_JOB_PROGRESS, data);
    }
  });
}
