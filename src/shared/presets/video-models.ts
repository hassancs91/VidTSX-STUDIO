/**
 * Single source of truth for cloud video generation models. Mirrors the image
 * (image-models.ts) and STT (stt-models.ts) catalogs so every tool — the Flows
 * "Generate Video" node, the Videos panel later — reads model ids, names,
 * endpoints and the per-model duration / aspect-ratio / reference constraints
 * from one place.
 *
 * This file holds the *types and helpers*; the entries live in
 * video-model-entries.ts and are re-exported here, and the editable
 * per-provider default catalogs are composed from them in
 * provider-model-defaults.ts.
 *
 * The request-body *dialect* (duration as "5" vs "8s", resolution fields,
 * frame image key names, ModelArk's content array) is named per entry and
 * implemented once per family in src/video-engine/dialects.ts — a new model in
 * a known family is a catalog entry, not new code.
 */

/**
 * Request-body dialects the video engine implements. Keyed by API family +
 * schema version, not by model id: every slug in a family shares one builder.
 */
export type VideoDialectId =
  | 'fal-seedance-2'
  | 'fal-seedance-1'
  | 'fal-kling-2.5'
  | 'fal-veo-3'
  | 'fal-wan-2.5'
  | 'fal-hailuo-02'
  | 'fal-generic'
  | 'byteplus-seedance';

export const VIDEO_DIALECT_IDS: readonly VideoDialectId[] = [
  'fal-seedance-2',
  'fal-seedance-1',
  'fal-kling-2.5',
  'fal-veo-3',
  'fal-wan-2.5',
  'fal-hailuo-02',
  'fal-generic',
  'byteplus-seedance',
];

/** Short labels for the catalog card's dialect select. */
export const VIDEO_DIALECT_LABELS: Record<VideoDialectId, string> = {
  'fal-seedance-2': 'Seedance 2.x (fal)',
  'fal-seedance-1': 'Seedance 1.x (fal)',
  'fal-kling-2.5': 'Kling 2.5 (fal)',
  'fal-veo-3': 'Veo 3.x (fal)',
  'fal-wan-2.5': 'WAN 2.5 (fal)',
  'fal-hailuo-02': 'Hailuo 02 (fal)',
  'fal-generic': 'Generic (fal)',
  'byteplus-seedance': 'Seedance (BytePlus ModelArk)',
};

export function isVideoDialectId(value: string): value is VideoDialectId {
  return (VIDEO_DIALECT_IDS as readonly string[]).includes(value);
}

export type VideoResolution = '480p' | '720p' | '1080p' | '4k';

/** Per-model reference-input limits (Seedance omni reference-to-video). */
export interface VideoReferenceLimits {
  images: number;
  videos: number;
  audios: number;
}

export interface VideoModelCatalogEntry {
  id: string;
  /** Display name. */
  name: string;
  /** Short descriptor for pickers (e.g. resolution + speed/quality hint). */
  tagline: string;
  /** Request-body dialect (src/video-engine/dialects.ts). */
  dialect: VideoDialectId;
  /**
   * Text-to-video route. A fal endpoint slug; for direct-API providers
   * (BytePlus) it is the provider-side model id.
   */
  textToVideoEndpoint: string;
  /** Route used when a first-frame image is provided (image-to-video). */
  imageToVideoEndpoint?: string;
  /** Route used when reference images / videos / audio are provided. */
  referenceToVideoEndpoint?: string;
  /** Whether the model accepts a last/tail frame (image-to-video only). */
  supportsLastFrame: boolean;
  /** Whether the model can generate audio. */
  supportsAudio: boolean;
  /** Whether the model accepts a seed. Absent = yes (the older families). */
  supportsSeed?: boolean;
  /** Discrete durations (seconds) this model accepts. */
  allowedDurations: readonly number[];
  /**
   * Continuous duration range, for models that take any whole second in a
   * span (Seedance 2.x). `allowedDurations` then only seeds legacy pickers.
   */
  durationRange?: { min: number; max: number; auto?: boolean };
  /** Aspect ratios this model accepts. */
  allowedAspectRatios: readonly string[];
  /**
   * Output resolutions the dialect can request; the first is the default the
   * engine sends when the caller names none. Absent → the endpoint has no
   * resolution field.
   */
  resolutions?: readonly VideoResolution[];
  /** Reference-input limits; absent → the model has no reference route. */
  references?: VideoReferenceLimits;
  /**
   * Estimated price per second of output video, for the usage dashboard's
   * cost column only (× requested duration). Informational — the provider is
   * the billing authority; absent/unknown logs $0.
   */
  pricePerSecondUsd?: number;
}

export {
  FAL_VIDEO_MODELS,
  FAL_LEGACY_VIDEO_MODELS,
  BYTEPLUS_VIDEO_MODELS,
  VIDEO_MODEL_CATALOG,
} from './video-model-entries';

import { VIDEO_MODEL_CATALOG as KNOWN_VIDEO_MODELS } from './video-model-entries';

export const VIDEO_MAX_PROMPT_CHARS = 4000;

export const DEFAULT_VIDEO_MODEL = 'kling-2.5-turbo-pro' as const;
export const DEFAULT_BYTEPLUS_VIDEO_MODEL = 'dreamina-seedance-2-5-260628' as const;
export const DEFAULT_VIDEO_ASPECT_RATIO = '16:9' as const;
export const DEFAULT_VIDEO_DURATION = 5 as const;

export function getVideoModel(id: string): VideoModelCatalogEntry | undefined {
  return KNOWN_VIDEO_MODELS.find((m) => m.id === id);
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
  const model = coerceVideoModel(modelId);
  if (model.durationRange) {
    return Math.min(model.durationRange.max, Math.max(model.durationRange.min, Math.round(raw)));
  }
  return closestAllowedDuration(model.allowedDurations, raw);
}

/** Clamp an aspect ratio to one the model accepts, falling back to its first. */
export function coerceVideoAspect(modelId: string, raw: string): string {
  return pickAllowedAspect(coerceVideoModel(modelId).allowedAspectRatios, raw);
}
