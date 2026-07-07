/**
 * Single source of truth for video generation models (fal.ai queue API).
 * Mirrors the image (image-models.ts) and STT (stt-models.ts) catalogs so every
 * tool — the Flows "Generate Video" node today, a video-studio generation UI
 * later — reads model ids, names, endpoints, and the per-model duration /
 * aspect-ratio constraints from one place.
 *
 * Endpoints + parameter dialects live on fal.ai; verify each slug + schema on
 * https://fal.ai/models/{slug}/api when adding or upgrading a model. Per-model
 * request-body differences are isolated in src/main/services/video-payloads.ts.
 */

export interface VideoModelCatalogEntry {
  id: string;
  /** Display name. */
  name: string;
  /** Short descriptor for pickers (e.g. resolution + speed/quality hint). */
  tagline: string;
  /** fal endpoint for text-to-video. */
  textToVideoEndpoint: string;
  /** fal endpoint when a first-frame image is provided (image-to-video). */
  imageToVideoEndpoint?: string;
  /** Whether the model accepts a last/tail frame (image-to-video only). */
  supportsLastFrame: boolean;
  /** Whether the model can generate audio. */
  supportsAudio: boolean;
  /** Discrete durations (seconds) this model accepts. */
  allowedDurations: readonly number[];
  /** Aspect ratios this model accepts. */
  allowedAspectRatios: readonly string[];
}

export const VIDEO_MAX_PROMPT_CHARS = 4000;

export const VIDEO_MODEL_CATALOG: readonly VideoModelCatalogEntry[] = [
  {
    id: 'kling-2.5-turbo-pro',
    name: 'Kling 2.5 Turbo Pro',
    tagline: '1080p, strong motion',
    textToVideoEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    imageToVideoEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    supportsLastFrame: true,
    supportsAudio: false,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
  },
  {
    id: 'veo-3-fast',
    name: 'Veo 3 Fast',
    tagline: '720p, with audio',
    textToVideoEndpoint: 'fal-ai/veo3/fast',
    imageToVideoEndpoint: 'fal-ai/veo3/fast/image-to-video',
    supportsLastFrame: false,
    supportsAudio: true,
    allowedDurations: [8],
    allowedAspectRatios: ['16:9', '9:16'],
  },
  {
    id: 'wan-2.5',
    name: 'WAN 2.5',
    tagline: '1080p, with audio',
    textToVideoEndpoint: 'fal-ai/wan-25-preview/text-to-video',
    imageToVideoEndpoint: 'fal-ai/wan-25-preview/image-to-video',
    supportsLastFrame: false,
    supportsAudio: true,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
  },
  {
    id: 'hailuo-02',
    name: 'MiniMax Hailuo 02',
    tagline: '768p, natural motion',
    textToVideoEndpoint: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    imageToVideoEndpoint: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    supportsLastFrame: false,
    supportsAudio: false,
    allowedDurations: [6, 10],
    allowedAspectRatios: ['16:9'],
  },
  {
    id: 'seedance-1-lite',
    name: 'Seedance 1.0 Lite',
    tagline: '720p, fast + cheap',
    textToVideoEndpoint: 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
    imageToVideoEndpoint: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    supportsLastFrame: true,
    supportsAudio: false,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  },
];

export const DEFAULT_VIDEO_MODEL = 'kling-2.5-turbo-pro' as const;
export const DEFAULT_VIDEO_ASPECT_RATIO = '16:9' as const;
export const DEFAULT_VIDEO_DURATION = 5 as const;

export function getVideoModel(id: string): VideoModelCatalogEntry | undefined {
  return VIDEO_MODEL_CATALOG.find((m) => m.id === id);
}

/**
 * Map an unknown/legacy model id (e.g. removed vidtsx-video-* ids persisted in
 * saved flows) onto a catalog entry, falling back to the default model.
 */
export function coerceVideoModel(id: string): VideoModelCatalogEntry {
  return getVideoModel(id) ?? getVideoModel(DEFAULT_VIDEO_MODEL)!;
}

/**
 * Clamp a duration to one the model accepts. Prefers the closest allowed value
 * so legacy configs (e.g. 15s from the removed VidTSX models) degrade sanely.
 */
export function coerceVideoDuration(modelId: string, raw: number): number {
  const allowed = coerceVideoModel(modelId).allowedDurations;
  if (allowed.includes(raw)) return raw;
  let best = allowed[0] ?? DEFAULT_VIDEO_DURATION;
  for (const d of allowed) {
    if (Math.abs(d - raw) < Math.abs(best - raw)) best = d;
  }
  return best;
}

/** Clamp an aspect ratio to one the model accepts, falling back to its first. */
export function coerceVideoAspect(modelId: string, raw: string): string {
  const entry = coerceVideoModel(modelId);
  if (entry.allowedAspectRatios.includes(raw)) return raw;
  return entry.allowedAspectRatios.includes(DEFAULT_VIDEO_ASPECT_RATIO)
    ? DEFAULT_VIDEO_ASPECT_RATIO
    : entry.allowedAspectRatios[0];
}
