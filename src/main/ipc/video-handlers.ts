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
  VideoMediaInputIpc,
  VideoModelsGetRequest,
  VideoModelsGetResponse,
  VideoProvidersGetResponse,
  VideoProviderTestRequest,
  VideoProviderTestResponse,
} from '../../shared/ipc/types/video';
import { videoEngine, mediaInputFromString, VIDEO_PROVIDER_PRESETS } from '../../video-engine';
import type { MediaInput, VideoJobRecord } from '../../video-engine';
import type { VideoResolution } from '../../shared/presets/video-models';
import {
  ensureVideoProvidersReady,
  LOCAL_VIDEO_PROVIDER_ID,
  LOCAL_VIDEO_PROVIDER_NAME,
  usableVideoProviderIds,
} from '../services/video-init';
import { getProviderCredentials } from '../services/settings';
import { BytePlusArkClient } from '../../shared/providers/byteplus';
import { isProviderKeyId } from '../../shared/providers/registry';
import { ModerationBlockedError } from '../../shared/content-safety';

const VIDEO_RESOLUTIONS: readonly string[] = ['480p', '720p', '1080p', '4k'];

function toMediaInputs(items: VideoMediaInputIpc[] | undefined): MediaInput[] | undefined {
  if (!items?.length) return undefined;
  return items.map((item) => ({
    kind: item.kind,
    value: item.value,
    ...(item.contentType ? { contentType: item.contentType } : {}),
  }));
}

/** Job record → the IPC shape. The URL is the gated local clip, never remote. */
export function toVideoJobData(record: VideoJobRecord): VideoJobData {
  return {
    jobId: record.jobId,
    status: record.status,
    providerId: record.providerId,
    ...(record.progress ? { progress: record.progress } : {}),
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
    // call that races that re-init, and the local models' lazy scan.
    await ensureVideoProvidersReady();
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
      ...(req.resolution && VIDEO_RESOLUTIONS.includes(req.resolution)
        ? { resolution: req.resolution as VideoResolution }
        : {}),
      ...(req.references
        ? {
            references: {
              ...(toMediaInputs(req.references.images)
                ? { images: toMediaInputs(req.references.images)! }
                : {}),
              ...(toMediaInputs(req.references.videos)
                ? { videos: toMediaInputs(req.references.videos)! }
                : {}),
              ...(toMediaInputs(req.references.audios)
                ? { audios: toMediaInputs(req.references.audios)! }
                : {}),
            },
          }
        : {}),
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

/**
 * Video providers that can take a job right now, for the model pickers: the
 * cloud ones with a key, and "Local (open source)" once an installed model is
 * ready (the LocalSdImageProvider rule — a provider with no models is not
 * offered). The active id is narrowed the same way so a picker never lands
 * on a provider it cannot show.
 */
export async function handleVideoProvidersGet(): Promise<VideoProvidersGetResponse> {
  try {
    await ensureVideoProvidersReady();
    const usable = usableVideoProviderIds();
    const engineActive = videoEngine.getActiveProvider();
    const active = engineActive && usable.includes(engineActive) ? engineActive : (usable[0] ?? null);
    const providers = usable.map((id) => ({
      id,
      name:
        id === LOCAL_VIDEO_PROVIDER_ID
          ? LOCAL_VIDEO_PROVIDER_NAME
          : (VIDEO_PROVIDER_PRESETS.find((p) => p.id === id)?.name ?? id),
      isActive: id === active,
    }));
    return { success: true, providers, activeProvider: active };
  } catch (err) {
    return {
      success: false,
      providers: [],
      activeProvider: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** One provider's models, with the capabilities pickers narrow themselves by. */
export async function handleVideoModelsGet(
  _event: IpcMainInvokeEvent,
  req: VideoModelsGetRequest = {},
): Promise<VideoModelsGetResponse> {
  try {
    await ensureVideoProvidersReady();
    return { success: true, models: videoEngine.getModels(req.providerId) };
  } catch (err) {
    return { success: false, models: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Providers-page test for a video key. Costs nothing: it lists the account's
 * recent tasks rather than generating anything. The draft key from the input
 * is used when given, so a key can be tested before it is saved.
 */
export async function handleVideoProviderTest(
  _event: IpcMainInvokeEvent,
  req: VideoProviderTestRequest,
): Promise<VideoProviderTestResponse> {
  const started = Date.now();
  try {
    if (req.providerId !== 'byteplus') {
      return { success: false, error: `No video test for provider "${req.providerId}".` };
    }
    if (!isProviderKeyId(req.providerId)) {
      return { success: false, error: `Unknown provider "${req.providerId}".` };
    }
    const apiKey = req.apiKey?.trim() || (await getProviderCredentials())[req.providerId];
    if (!apiKey) return { success: false, error: 'No API key saved for this provider.' };
    await new BytePlusArkClient({ apiKey }).listTasks();
    return { success: true, durationMs: Date.now() - started };
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
