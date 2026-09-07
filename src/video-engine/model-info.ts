import type { VideoModelCatalogEntry } from '../shared/presets/video-models';
import type { VideoModelInfo } from './types';

/** Capability view of a catalog entry — what pickers and the normalizer read. */
export function toVideoModelInfo(entry: VideoModelCatalogEntry): VideoModelInfo {
  return {
    id: entry.id,
    name: entry.name,
    tagline: entry.tagline,
    dialect: entry.dialect,
    durations: { kind: 'discrete', values: [...entry.allowedDurations] },
    aspectRatios: [...entry.allowedAspectRatios],
    ...(entry.resolutions ? { resolutions: [...entry.resolutions] } : {}),
    supports: {
      audio: entry.supportsAudio,
      firstFrame: Boolean(entry.imageToVideoEndpoint),
      lastFrame: entry.supportsLastFrame,
    },
    ...(entry.pricePerSecondUsd !== undefined ? { pricePerSecondUsd: entry.pricePerSecondUsd } : {}),
  };
}
