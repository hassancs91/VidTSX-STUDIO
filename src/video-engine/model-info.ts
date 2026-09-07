import type { VideoModelCatalogEntry, VideoResolution } from '../shared/presets/video-models';
import type { VideoDurationSpec, VideoModelInfo } from './types';

function durationSpec(entry: VideoModelCatalogEntry): VideoDurationSpec {
  if (entry.durationRange) {
    return {
      kind: 'range',
      min: entry.durationRange.min,
      max: entry.durationRange.max,
      ...(entry.durationRange.auto ? { auto: true } : {}),
    };
  }
  return { kind: 'discrete', values: [...entry.allowedDurations] };
}

/** Capability view of a catalog entry — what pickers and the normalizer read. */
export function toVideoModelInfo(entry: VideoModelCatalogEntry): VideoModelInfo {
  return {
    id: entry.id,
    name: entry.name,
    tagline: entry.tagline,
    dialect: entry.dialect,
    durations: durationSpec(entry),
    aspectRatios: [...entry.allowedAspectRatios],
    ...(entry.resolutions ? { resolutions: [...entry.resolutions] } : {}),
    supports: {
      audio: entry.supportsAudio,
      firstFrame: Boolean(entry.imageToVideoEndpoint),
      lastFrame: entry.supportsLastFrame,
      seed: entry.supportsSeed !== false,
      ...(entry.references && entry.referenceToVideoEndpoint
        ? { references: { ...entry.references } }
        : {}),
    },
    ...(entry.pricePerSecondUsd !== undefined ? { pricePerSecondUsd: entry.pricePerSecondUsd } : {}),
    ...(entry.pricePerSecondByResolutionUsd
      ? { pricePerSecondByResolutionUsd: { ...entry.pricePerSecondByResolutionUsd } }
      : {}),
  };
}

/**
 * Narrow a model's reference limits to what this provider can actually carry.
 * BytePlus takes reference videos only as URLs, so without a host to upload
 * them to the model reports zero videos and the picker hides the input.
 */
export function withReferenceLimits(
  info: VideoModelInfo,
  limit: (kind: 'videos' | 'audios', declared: number) => number,
): VideoModelInfo {
  const references = info.supports.references;
  if (!references) return info;
  return {
    ...info,
    supports: {
      ...info.supports,
      references: {
        images: references.images,
        videos: limit('videos', references.videos),
        audios: limit('audios', references.audios),
      },
    },
  };
}

/**
 * The per-second rate to estimate a job at: the resolution's own published
 * rate where the catalog carries one, else the model's headline (720p) rate,
 * else zero. Informational — the provider is the billing authority.
 */
export function modelRatePerSecond(
  model: VideoModelInfo | undefined,
  resolution: VideoResolution | undefined,
): number {
  if (!model) return 0;
  const byResolution = resolution
    ? model.pricePerSecondByResolutionUsd?.[resolution]
    : undefined;
  return byResolution ?? model.pricePerSecondUsd ?? 0;
}
