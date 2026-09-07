import type { VideoDialectId, VideoModelCatalogEntry } from '../shared/presets/video-models';
import type { ProviderMediaInput, VideoProviderRequest } from './types';
import type {
  BytePlusContentItem,
  BytePlusContentRole,
  BytePlusCreateTaskBody,
} from '../shared/providers/byteplus';

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

export function hasReferences(request: VideoProviderRequest): boolean {
  return Boolean(
    request.referenceImages?.length ||
      request.referenceVideos?.length ||
      request.referenceAudios?.length,
  );
}

/**
 * Seedance's three routes are mutually exclusive by API rule: references win
 * when present, then a first frame, else text-to-video.
 */
function pickSeedance2Endpoint(
  model: VideoModelCatalogEntry,
  request: VideoProviderRequest,
): string {
  if (hasReferences(request) && model.referenceToVideoEndpoint) {
    return model.referenceToVideoEndpoint;
  }
  return pickEndpoint(model, request);
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
    // Veo 3.1 added 720p/1080p/4k; 3.0 has no resolution field, and its
    // catalog entries name no resolutions, so nothing is sent for them.
    ...(request.resolution ? { resolution: request.resolution } : {}),
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
 * Seedance 2.x on fal: one schema across text-, image- and reference-to-video.
 * Duration and aspect ratio are enums that include "auto", references travel
 * as URL lists addressed from the prompt as @Image1 / @Video1 / @Audio1, and
 * the family takes no seed.
 */
const falSeedance2: VideoDialectBuilder = (model, request) => {
  const endpoint = pickSeedance2Endpoint(model, request);
  const references = hasReferences(request) && endpoint === model.referenceToVideoEndpoint;
  const imageRoute = !references && Boolean(request.firstFrame);
  return {
    endpoint,
    body: {
      prompt: request.prompt,
      duration: String(request.durationSeconds),
      // The image route derives the ratio from the first frame and rejects
      // an explicit one.
      aspect_ratio: imageRoute ? 'auto' : request.aspectRatio,
      resolution: request.resolution ?? '720p',
      generate_audio: request.generateAudio,
      ...(imageRoute ? frameFields(request, 'end_image_url') : {}),
      ...(references
        ? {
            ...(request.referenceImages?.length
              ? { image_urls: request.referenceImages.map(mediaToUrl) }
              : {}),
            ...(request.referenceVideos?.length
              ? { video_urls: request.referenceVideos.map(mediaToUrl) }
              : {}),
            ...(request.referenceAudios?.length
              ? { audio_urls: request.referenceAudios.map(mediaToUrl) }
              : {}),
          }
        : {}),
    },
  };
};

function arkItem(
  input: ProviderMediaInput,
  kind: 'image' | 'video' | 'audio',
  role?: BytePlusContentRole,
): BytePlusContentItem {
  const url = mediaToUrl(input);
  if (kind === 'image') return { type: 'image_url', image_url: { url }, ...(role ? { role } : {}) };
  if (kind === 'video') return { type: 'video_url', video_url: { url }, ...(role ? { role } : {}) };
  return { type: 'audio_url', audio_url: { url }, ...(role ? { role } : {}) };
}

/**
 * BytePlus ModelArk (Seedance direct). Inputs are one `content` array of typed
 * items with a role, and the "endpoint" is the ModelArk model id — the same id
 * serves every task type, so the roles alone say whether this is a first-frame
 * animation or an omni-reference generation.
 */
const bytePlusSeedance: VideoDialectBuilder = (model, request) => {
  const references = hasReferences(request);
  const content: BytePlusContentItem[] = [{ type: 'text', text: request.prompt }];
  if (references) {
    for (const image of request.referenceImages ?? []) {
      content.push(arkItem(image, 'image', 'reference_image'));
    }
    for (const video of request.referenceVideos ?? []) {
      content.push(arkItem(video, 'video', 'reference_video'));
    }
    for (const audio of request.referenceAudios ?? []) {
      content.push(arkItem(audio, 'audio', 'reference_audio'));
    }
  } else if (request.firstFrame) {
    content.push(arkItem(request.firstFrame, 'image', 'first_frame'));
    if (request.lastFrame) content.push(arkItem(request.lastFrame, 'image', 'last_frame'));
  }
  const body: BytePlusCreateTaskBody = {
    model: model.textToVideoEndpoint,
    content,
    // Frame images fix the ratio on ModelArk; asking for another is an error.
    ratio: request.firstFrame && !references ? 'adaptive' : request.aspectRatio,
    duration: request.durationSeconds,
    generate_audio: request.generateAudio,
    watermark: false,
    ...(request.resolution ? { resolution: request.resolution } : {}),
    ...(model.supportsSeed !== false && request.seed !== undefined ? { seed: request.seed } : {}),
  };
  return { endpoint: model.textToVideoEndpoint, body: body as unknown as Record<string, unknown> };
};

/**
 * Request-body builders keyed by dialect id — the only place that knows how
 * each API family spells duration, resolution, audio, and frame images. A
 * catalog entry names its dialect; a new model in a known family needs no
 * code.
 */
export const VIDEO_DIALECTS: Record<VideoDialectId, VideoDialectBuilder> = {
  'fal-seedance-2': falSeedance2,
  'byteplus-seedance': bytePlusSeedance,
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
