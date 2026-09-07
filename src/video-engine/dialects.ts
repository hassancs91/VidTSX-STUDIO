import type { VideoDialectId, VideoModelCatalogEntry } from '../shared/presets/video-models';
import type { ProviderMediaInput, VideoProviderRequest } from './types';

export interface VideoDialectPayload {
  endpoint: string;
  body: Record<string, unknown>;
}

export type VideoDialectBuilder = (
  model: VideoModelCatalogEntry,
  request: VideoProviderRequest,
) => VideoDialectPayload;

function detectImageContentType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

/** fal accepts data URIs anywhere an image_url is expected. */
export function mediaToUrl(input: ProviderMediaInput): string {
  if (input.kind === 'url' || input.value.startsWith('data:')) return input.value;
  return `data:${input.contentType ?? detectImageContentType(input.value)};base64,${input.value}`;
}

function pickEndpoint(model: VideoModelCatalogEntry, request: VideoProviderRequest): string {
  return request.firstFrame && model.imageToVideoEndpoint
    ? model.imageToVideoEndpoint
    : model.textToVideoEndpoint;
}

/** `image_url` for the first frame plus, when named, the model's last-frame key. */
function frameFields(
  request: VideoProviderRequest,
  lastFrameKey?: string,
): Record<string, unknown> {
  if (!request.firstFrame) return {};
  const fields: Record<string, unknown> = { image_url: mediaToUrl(request.firstFrame) };
  if (lastFrameKey && request.lastFrame) fields[lastFrameKey] = mediaToUrl(request.lastFrame);
  return fields;
}

function seedField(request: VideoProviderRequest): Record<string, unknown> {
  return request.seed !== undefined ? { seed: request.seed } : {};
}

const falSeedance1: VideoDialectBuilder = (model, request) => ({
  endpoint: pickEndpoint(model, request),
  body: {
    prompt: request.prompt,
    duration: String(request.durationSeconds),
    aspect_ratio: request.aspectRatio,
    resolution: request.resolution ?? '720p',
    ...seedField(request),
    ...frameFields(request, 'end_image_url'),
  },
});

const falKling25: VideoDialectBuilder = (model, request) => ({
  endpoint: pickEndpoint(model, request),
  body: {
    prompt: request.prompt,
    duration: String(request.durationSeconds),
    aspect_ratio: request.aspectRatio,
    ...frameFields(request, 'tail_image_url'),
  },
});

const falVeo3: VideoDialectBuilder = (model, request) => ({
  endpoint: pickEndpoint(model, request),
  body: {
    prompt: request.prompt,
    duration: `${request.durationSeconds}s`,
    aspect_ratio: request.aspectRatio,
    generate_audio: request.generateAudio,
    ...seedField(request),
    ...frameFields(request),
  },
});

const falWan25: VideoDialectBuilder = (model, request) => ({
  endpoint: pickEndpoint(model, request),
  body: {
    prompt: request.prompt,
    duration: String(request.durationSeconds),
    aspect_ratio: request.aspectRatio,
    resolution: request.resolution ?? '720p',
    // fal's default is audio on; only an explicit off is sent.
    ...(request.generateAudio ? {} : { enable_audio: false }),
    ...seedField(request),
    ...frameFields(request),
  },
});

const falHailuo02: VideoDialectBuilder = (model, request) => ({
  endpoint: pickEndpoint(model, request),
  body: {
    prompt: request.prompt,
    duration: String(request.durationSeconds),
    ...frameFields(request),
  },
});

/** Unknown family — the common denominator every fal video app accepts. */
const falGeneric: VideoDialectBuilder = (model, request) => ({
  endpoint: pickEndpoint(model, request),
  body: {
    prompt: request.prompt,
    duration: String(request.durationSeconds),
    aspect_ratio: request.aspectRatio,
    ...frameFields(request),
  },
});

/**
 * Request-body builders keyed by dialect id — the only place that knows how
 * each API family spells duration, resolution, audio, and frame images. A
 * catalog entry names its dialect; a new model in a known family needs no
 * code.
 */
export const VIDEO_DIALECTS: Record<VideoDialectId, VideoDialectBuilder> = {
  'fal-seedance-1': falSeedance1,
  'fal-kling-2.5': falKling25,
  'fal-veo-3': falVeo3,
  'fal-wan-2.5': falWan25,
  'fal-hailuo-02': falHailuo02,
  'fal-generic': falGeneric,
};

export function buildVideoPayload(
  model: VideoModelCatalogEntry,
  request: VideoProviderRequest,
): VideoDialectPayload {
  const builder = VIDEO_DIALECTS[model.dialect] ?? VIDEO_DIALECTS['fal-generic'];
  return builder(model, request);
}
