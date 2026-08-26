import { FalQueueClient } from '../../shared/providers/fal';
import {
  coerceVideoAspect,
  coerceVideoDuration,
  coerceVideoModel,
  getVideoModel,
  VIDEO_MAX_PROMPT_CHARS,
} from '../../shared/presets/video-models';
import type { VideoGenerateRequest, VideoJobData } from '../../shared/ipc/types/video';
import { checkGenerationPrompt } from '../../moderation-engine/generation-gate';
import { ModerationBlockedError } from '../../shared/content-safety';
import { recordBlocked } from './content-safety/blocked-counters';
import { buildVideoPayload } from './video-payloads';
import { getProviderCredentials } from './settings';
import { aiUsageService } from './ai-usage';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('VideoGen');

interface TrackedJob {
  statusUrl: string;
  responseUrl: string;
  model: string;
  durationSeconds: number;
  aspectRatio: string;
  hasAudio: boolean;
  /** Submit time, for the usage log's wall-clock duration. */
  submittedAt: number;
}

/** fal queue result shape shared by the curated video models. */
interface FalVideoResult {
  video?: { url?: string };
}

const jobs = new Map<string, TrackedJob>();

async function getClient(): Promise<FalQueueClient> {
  const credentials = await getProviderCredentials();
  if (!credentials.fal) {
    throw new Error('No Fal API key configured. Add one in Settings > API Keys.');
  }
  return new FalQueueClient({ apiKey: credentials.fal });
}

export async function submitVideoJob(req: VideoGenerateRequest): Promise<string> {
  if (!req.prompt || req.prompt.trim().length === 0) {
    throw new Error('Prompt is required.');
  }
  if (req.prompt.length > VIDEO_MAX_PROMPT_CHARS) {
    throw new Error(`Prompt too long (max ${VIDEO_MAX_PROMPT_CHARS} characters).`);
  }
  // Content Safety Gate A — visual prompt fields only (D3).
  const safety = checkGenerationPrompt(req.prompt);
  if (safety.blocked) {
    recordBlocked('prompt');
    throw new ModerationBlockedError('prompt', safety.category ?? 'sexual');
  }

  const model = coerceVideoModel(req.model);
  const normalized: VideoGenerateRequest = {
    ...req,
    model: model.id,
    durationSeconds: coerceVideoDuration(model.id, req.durationSeconds),
    aspectRatio: coerceVideoAspect(model.id, req.aspectRatio),
    generateAudio: model.supportsAudio ? req.generateAudio : false,
    lastFrame: model.supportsLastFrame ? req.lastFrame : undefined,
  };

  const { endpoint, body } = buildVideoPayload(model, normalized);
  const client = await getClient();
  const submitted = await client.submit(endpoint, body);

  jobs.set(submitted.requestId, {
    statusUrl: submitted.statusUrl,
    responseUrl: submitted.responseUrl,
    model: model.id,
    durationSeconds: normalized.durationSeconds,
    aspectRatio: normalized.aspectRatio,
    hasAudio: normalized.generateAudio ?? false,
    submittedAt: Date.now(),
  });

  log.info('Video job submitted', { jobId: submitted.requestId, model: model.id, endpoint });
  return submitted.requestId;
}

export async function getVideoJob(jobId: string): Promise<VideoJobData> {
  const tracked = jobs.get(jobId);
  if (!tracked) {
    throw new Error(`Unknown video job "${jobId}" (jobs do not survive app restarts).`);
  }

  const client = await getClient();
  const status = await client.status(tracked.statusUrl);

  const base: VideoJobData = {
    jobId,
    status: 'running',
    modelUsed: tracked.model,
    durationSeconds: tracked.durationSeconds,
    aspectRatio: tracked.aspectRatio,
    hasAudio: tracked.hasAudio,
  };

  if (status.status === 'IN_QUEUE') return { ...base, status: 'pending' };
  if (status.status === 'IN_PROGRESS') return base;

  // COMPLETED — fetch the result payload. fal reports generation errors here.
  try {
    const result = await client.result<FalVideoResult>(tracked.responseUrl);
    const videoUrl = result.video?.url;
    if (!videoUrl) {
      log.error('Video job completed without a video URL', new Error('missing video.url'), { jobId });
      return { ...base, status: 'failed', error: 'Generation completed but returned no video.' };
    }
    jobs.delete(jobId);

    // Usage log (fire-and-forget) — video generation's completion path. Cost
    // is the catalog's informational per-second estimate × requested duration.
    aiUsageService.appendEntry({
      timestamp: new Date().toISOString(),
      provider: 'fal',
      model: tracked.model,
      featureSource: 'flows',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      costUsd: (getVideoModel(tracked.model)?.pricePerSecondUsd ?? 0) * tracked.durationSeconds,
      durationMs: Date.now() - tracked.submittedAt,
      requestType: 'video',
    }).catch(() => {});

    return { ...base, status: 'completed', videoUrl };
  } catch (err) {
    jobs.delete(jobId);
    const message = err instanceof Error ? err.message : String(err);
    return { ...base, status: 'failed', error: message };
  }
}
