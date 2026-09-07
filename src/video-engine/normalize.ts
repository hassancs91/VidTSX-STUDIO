import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  closestAllowedDuration,
  pickAllowedAspect,
} from '../shared/presets/video-models';
import type { VideoResolution } from '../shared/presets/video-models';
import type {
  ProviderMediaInput,
  VideoGenerationRequest,
  VideoJobRequestSummary,
  VideoModelInfo,
  VideoProviderRequest,
} from './types';

export interface ResolvedMedia {
  firstFrame?: ProviderMediaInput;
  lastFrame?: ProviderMediaInput;
  referenceImages: ProviderMediaInput[];
}

function normalizeDuration(model: VideoModelInfo, raw: number | undefined): number {
  const wanted = raw !== undefined && Number.isFinite(raw) ? raw : DEFAULT_VIDEO_DURATION;
  if (model.durations.kind === 'discrete') {
    return closestAllowedDuration(model.durations.values, wanted);
  }
  return Math.min(model.durations.max, Math.max(model.durations.min, wanted));
}

function normalizeResolution(
  model: VideoModelInfo,
  raw: VideoResolution | undefined,
): VideoResolution | undefined {
  if (!model.resolutions?.length) return undefined;
  return raw && model.resolutions.includes(raw) ? raw : model.resolutions[0];
}

/**
 * Clamp a caller's request to what the model accepts — the same rules
 * submitVideoJob applied before the engine existed: nearest duration, allowed
 * aspect (16:9 fallback), audio only where supported, a last frame only with
 * a first frame on a model that takes one, frames only where the model has an
 * image-to-video route.
 */
export function normalizeVideoRequest(
  model: VideoModelInfo,
  request: VideoGenerationRequest,
  media: ResolvedMedia,
): VideoProviderRequest {
  const firstFrame = model.supports.firstFrame ? media.firstFrame : undefined;
  const lastFrame = firstFrame && model.supports.lastFrame ? media.lastFrame : undefined;
  const resolution = normalizeResolution(model, request.resolution);
  const seed =
    request.seed !== undefined && Number.isFinite(request.seed) ? request.seed : undefined;
  return {
    model: model.id,
    prompt: request.prompt,
    durationSeconds: normalizeDuration(model, request.durationSeconds),
    aspectRatio: pickAllowedAspect(model.aspectRatios, request.aspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO),
    ...(resolution ? { resolution } : {}),
    generateAudio: model.supports.audio ? Boolean(request.generateAudio) : false,
    ...(seed !== undefined ? { seed } : {}),
    ...(firstFrame ? { firstFrame } : {}),
    ...(lastFrame ? { lastFrame } : {}),
    ...(media.referenceImages.length ? { referenceImages: media.referenceImages } : {}),
    ...(request.signal ? { signal: request.signal } : {}),
  };
}

/** The job record's view of a normalized request: every field but the bytes. */
export function summarizeRequest(
  normalized: VideoProviderRequest,
  folderId: string | null | undefined,
): VideoJobRequestSummary {
  return {
    model: normalized.model,
    prompt: normalized.prompt,
    durationSeconds: normalized.durationSeconds,
    aspectRatio: normalized.aspectRatio,
    ...(normalized.resolution ? { resolution: normalized.resolution } : {}),
    generateAudio: normalized.generateAudio,
    ...(normalized.seed !== undefined ? { seed: normalized.seed } : {}),
    hasFirstFrame: Boolean(normalized.firstFrame),
    hasLastFrame: Boolean(normalized.lastFrame),
    ...(folderId !== undefined ? { folderId } : {}),
  };
}
