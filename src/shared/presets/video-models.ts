/**
 * Single source of truth for cloud video generation models (fal.ai queue API).
 * Mirrors the image (image-models.ts) and STT (stt-models.ts) catalogs so every
 * tool — the Flows "Generate Video" node today, the Videos panel later — reads
 * model ids, names, endpoints, and the per-model duration / aspect-ratio
 * constraints from one place.
 *
 * Endpoints live on fal.ai; verify each slug + schema on
 * https://fal.ai/models/{slug}/api when adding or upgrading a model. The
 * request-body *dialect* (duration as "5" vs "8s", resolution fields, frame
 * image key names) is named per entry and implemented once per family in
 * src/video-engine/dialects.ts — a new model in a known family is a catalog
 * entry, not new code.
 */

/**
 * Request-body dialects the video engine implements. Keyed by API family +
 * schema version, not by model id: every slug in a family shares one builder.
 */
export type VideoDialectId =
  | 'fal-seedance-1'
  | 'fal-kling-2.5'
  | 'fal-veo-3'
  | 'fal-wan-2.5'
  | 'fal-hailuo-02'
  | 'fal-generic';

export const VIDEO_DIALECT_IDS: readonly VideoDialectId[] = [
  'fal-seedance-1',
  'fal-kling-2.5',
  'fal-veo-3',
  'fal-wan-2.5',
  'fal-hailuo-02',
  'fal-generic',
];

export type VideoResolution = '480p' | '720p' | '1080p' | '4k';

export interface VideoModelCatalogEntry {
  id: string;
  /** Display name. */
  name: string;
  /** Short descriptor for pickers (e.g. resolution + speed/quality hint). */
  tagline: string;
  /** Request-body dialect (src/video-engine/dialects.ts). */
  dialect: VideoDialectId;
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
  /**
   * Output resolutions the dialect can request; the first is the default the
   * engine sends when the caller names none. Absent → the endpoint has no
   * resolution field.
   */
  resolutions?: readonly VideoResolution[];
  /**
   * Estimated price per second of output video, for the usage dashboard's
   * cost column only (× requested duration). Informational — fal is the
   * billing authority; absent/unknown logs $0.
   */
  pricePerSecondUsd?: number;
}

export const VIDEO_MAX_PROMPT_CHARS = 4000;

export const VIDEO_MODEL_CATALOG: readonly VideoModelCatalogEntry[] = [
  {
    id: 'kling-2.5-turbo-pro',
    name: 'Kling 2.5 Turbo Pro',
    tagline: '1080p, strong motion',
    dialect: 'fal-kling-2.5',
    textToVideoEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    imageToVideoEndpoint: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    supportsLastFrame: true,
    supportsAudio: false,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    pricePerSecondUsd: 0.08,
  },
  {
    id: 'veo-3-fast',
    name: 'Veo 3 Fast',
    tagline: '720p, with audio',
    dialect: 'fal-veo-3',
    textToVideoEndpoint: 'fal-ai/veo3/fast',
    imageToVideoEndpoint: 'fal-ai/veo3/fast/image-to-video',
    supportsLastFrame: false,
    supportsAudio: true,
    allowedDurations: [8],
    allowedAspectRatios: ['16:9', '9:16'],
    pricePerSecondUsd: 0.15,
  },
  {
    id: 'wan-2.5',
    name: 'WAN 2.5',
    tagline: '1080p, with audio',
    dialect: 'fal-wan-2.5',
    textToVideoEndpoint: 'fal-ai/wan-25-preview/text-to-video',
    imageToVideoEndpoint: 'fal-ai/wan-25-preview/image-to-video',
    supportsLastFrame: false,
    supportsAudio: true,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p'],
  },
  {
    id: 'hailuo-02',
    name: 'MiniMax Hailuo 02',
    tagline: '768p, natural motion',
    dialect: 'fal-hailuo-02',
    textToVideoEndpoint: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    imageToVideoEndpoint: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    supportsLastFrame: false,
    supportsAudio: false,
    allowedDurations: [6, 10],
    allowedAspectRatios: ['16:9'],
    pricePerSecondUsd: 0.045,
  },
  {
    id: 'seedance-1-lite',
    name: 'Seedance 1.0 Lite',
    tagline: '720p, fast + cheap',
    dialect: 'fal-seedance-1',
    textToVideoEndpoint: 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
    imageToVideoEndpoint: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    supportsLastFrame: true,
    supportsAudio: false,
    allowedDurations: [5, 10],
    allowedAspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p'],
    pricePerSecondUsd: 0.03,
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
 * Closest allowed duration to `raw` — the capability-list form the engine
 * uses. Legacy configs (e.g. 15s from the removed VidTSX models) degrade to
 * the nearest value the model accepts.
 */
export function closestAllowedDuration(allowed: readonly number[], raw: number): number {
  if (allowed.includes(raw)) return raw;
  let best = allowed[0] ?? DEFAULT_VIDEO_DURATION;
  for (const d of allowed) {
    if (Math.abs(d - raw) < Math.abs(best - raw)) best = d;
  }
  return best;
}

/** `raw` if the model accepts it, else 16:9 when accepted, else the model's first. */
export function pickAllowedAspect(allowed: readonly string[], raw: string): string {
  if (allowed.includes(raw)) return raw;
  return allowed.includes(DEFAULT_VIDEO_ASPECT_RATIO) ? DEFAULT_VIDEO_ASPECT_RATIO : allowed[0];
}

/** Clamp a duration to one the model accepts (see closestAllowedDuration). */
export function coerceVideoDuration(modelId: string, raw: number): number {
  return closestAllowedDuration(coerceVideoModel(modelId).allowedDurations, raw);
}

/** Clamp an aspect ratio to one the model accepts, falling back to its first. */
export function coerceVideoAspect(modelId: string, raw: string): string {
  return pickAllowedAspect(coerceVideoModel(modelId).allowedAspectRatios, raw);
}
