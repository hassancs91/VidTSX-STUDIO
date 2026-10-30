/**
 * The known cloud video models, one entry per catalog id. Types and helpers
 * live in video-models.ts; the per-provider default catalogs the user can
 * edit are composed from these arrays in provider-model-defaults.ts.
 *
 * Endpoints and constraints verified 2026-09-07 against fal's model API pages
 * and the BytePlus ModelArk docs (docs/video-providers-plan.md §3, §6 Stage 3).
 * A new model in a family already listed in `dialect` needs no code — add it
 * in AI → Providers → Model Catalogs.
 */
import type { VideoModelCatalogEntry } from './video-models';

/**
 * fal defaults (plan D3): the Seedance-focused set, plus Kling for motion and
 * Veo for prompt adherence with audio.
 */
export const FAL_VIDEO_MODELS: readonly VideoModelCatalogEntry[] = [
  {
    id: 'seedance-2.5',
    name: 'Seedance 2.5',
    tagline: 'up to 30s, audio, omni references',
    dialect: 'fal-seedance-2',
    textToVideoEndpoint: 'bytedance/seedance-2.5/text-to-video',
    imageToVideoEndpoint: 'bytedance/seedance-2.5/image-to-video',
    referenceToVideoEndpoint: 'bytedance/seedance-2.5/reference-to-video',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    durationRange: { min: 4, max: 30, auto: true },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'auto'],
    resolutions: ['720p', '480p', '1080p'],
    references: { images: 30, videos: 10, audios: 10 },
    pricePerSecondUsd: 0.47,
    // fal publishes 2.5 per resolution; without this a 480p clip was
    // estimated at the 720p rate (the $1.88 in the Stage 3 log).
    pricePerSecondByResolutionUsd: { '480p': 0.22, '720p': 0.47 },
  },
  {
    id: 'seedance-2.0',
    name: 'Seedance 2.0',
    tagline: '4K, audio, up to 15s',
    dialect: 'fal-seedance-2',
    textToVideoEndpoint: 'bytedance/seedance-2.0/text-to-video',
    imageToVideoEndpoint: 'bytedance/seedance-2.0/image-to-video',
    referenceToVideoEndpoint: 'bytedance/seedance-2.0/reference-to-video',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 4, max: 15, auto: true },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'auto'],
    resolutions: ['720p', '480p', '1080p', '4k'],
    references: { images: 9, videos: 3, audios: 3 },
    pricePerSecondUsd: 0.3,
  },
  {
    id: 'seedance-2.0-fast',
    name: 'Seedance 2.0 Fast',
    tagline: '720p, audio, cheaper',
    dialect: 'fal-seedance-2',
    textToVideoEndpoint: 'bytedance/seedance-2.0/fast/text-to-video',
    imageToVideoEndpoint: 'bytedance/seedance-2.0/fast/image-to-video',
    referenceToVideoEndpoint: 'bytedance/seedance-2.0/fast/reference-to-video',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 4, max: 15, auto: true },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'auto'],
    resolutions: ['720p', '480p'],
    references: { images: 9, videos: 3, audios: 3 },
    pricePerSecondUsd: 0.24,
  },
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
    // fal: $0.35 per 5 s, $0.07 each further second (pricing API, 2026-10-30).
    pricePerSecondUsd: 0.07,
  },
  // Kling 3 and 4 (schemas and prices read 2026-10-30). fal's pricing API
  // quotes a flat $0.14/s for both Kling 3 tiers; the model pages split it by
  // audio, and a billed Kling 3 Standard run matched the page. The catalog
  // has one rate per model, so it carries the audio-off one (what flows send).
  {
    id: 'kling-3-pro',
    name: 'Kling 3 Pro',
    tagline: 'start + end frame, 3–15s, 1080p',
    dialect: 'fal-kling-3',
    textToVideoEndpoint: 'fal-ai/kling-video/v3/pro/text-to-video',
    imageToVideoEndpoint: 'fal-ai/kling-video/v3/pro/image-to-video',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [3, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 3, max: 15 },
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    // $0.168/s with audio on.
    pricePerSecondUsd: 0.112,
  },
  {
    id: 'kling-3-standard',
    name: 'Kling 3 Standard',
    tagline: 'start + end frame, 3–15s, cheaper',
    dialect: 'fal-kling-3',
    textToVideoEndpoint: 'fal-ai/kling-video/v3/standard/text-to-video',
    imageToVideoEndpoint: 'fal-ai/kling-video/v3/standard/image-to-video',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [3, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 3, max: 15 },
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    // $0.126/s with audio on.
    pricePerSecondUsd: 0.084,
  },
  {
    id: 'kling-4',
    name: 'Kling 4',
    tagline: 'start + end frame, up to 30s, 1080p',
    dialect: 'fal-kling-4',
    textToVideoEndpoint: 'kling/v4/text-to-video',
    imageToVideoEndpoint: 'kling/v4/image-to-video',
    supportsLastFrame: true,
    supportsAudio: false,
    supportsSeed: false,
    allowedDurations: [3, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    durationRange: { min: 3, max: 30 },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    resolutions: ['720p', '1080p'],
    // The pricing API returns only the 720p rate; 1080p is from fal's page.
    pricePerSecondUsd: 0.157,
    pricePerSecondByResolutionUsd: { '720p': 0.157, '1080p': 0.235 },
  },
  {
    id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast',
    tagline: 'up to 4K, with audio',
    dialect: 'fal-veo-3',
    textToVideoEndpoint: 'fal-ai/veo3.1/fast',
    imageToVideoEndpoint: 'fal-ai/veo3.1/fast/image-to-video',
    supportsLastFrame: false,
    supportsAudio: true,
    allowedDurations: [4, 6, 8],
    allowedAspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    pricePerSecondUsd: 0.15,
  },
];

/**
 * Out of the shipped defaults (D3) but kept in code so saved flows carrying
 * these ids still resolve — and so a user can add the id back in the catalog
 * and have its dialect already implemented. `veo-3-fast` is here because fal
 * deprecated `fal-ai/veo3/fast` in favour of the 3.1 slug above.
 */
export const FAL_LEGACY_VIDEO_MODELS: readonly VideoModelCatalogEntry[] = [
  {
    id: 'veo-3-fast',
    name: 'Veo 3 Fast (deprecated)',
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

/**
 * BytePlus ModelArk (Seedance direct). The catalog id IS the ModelArk model
 * id, and one id serves every task type — the dialect picks first-frame /
 * first+last-frame / omni-reference from the inputs, and they are mutually
 * exclusive by API rule. Prices are the published per-second rates at the
 * default 720p, for the usage dashboard only.
 */
export const BYTEPLUS_VIDEO_MODELS: readonly VideoModelCatalogEntry[] = [
  {
    id: 'dreamina-seedance-2-5-260628',
    name: 'Seedance 2.5',
    tagline: 'up to 30s, audio, omni references',
    dialect: 'byteplus-seedance',
    textToVideoEndpoint: 'dreamina-seedance-2-5-260628',
    imageToVideoEndpoint: 'dreamina-seedance-2-5-260628',
    referenceToVideoEndpoint: 'dreamina-seedance-2-5-260628',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    durationRange: { min: 4, max: 30, auto: true },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
    resolutions: ['720p', '480p', '1080p'],
    references: { images: 30, videos: 10, audios: 10 },
    pricePerSecondUsd: 0.23,
    // ModelArk bills video tokens ($10.70/M without a video input). The real
    // 4 s 480p run returned 38830 tokens = $0.4155, i.e. $0.104/s — which is
    // the published 480p rate, against the $0.92 the flat estimate logged.
    pricePerSecondByResolutionUsd: { '480p': 0.10, '720p': 0.23 },
  },
  {
    id: 'dreamina-seedance-2-0-260128',
    name: 'Seedance 2.0',
    tagline: '4K, audio, up to 15s',
    dialect: 'byteplus-seedance',
    textToVideoEndpoint: 'dreamina-seedance-2-0-260128',
    imageToVideoEndpoint: 'dreamina-seedance-2-0-260128',
    referenceToVideoEndpoint: 'dreamina-seedance-2-0-260128',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 4, max: 15, auto: true },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
    resolutions: ['720p', '480p', '1080p', '4k'],
    references: { images: 9, videos: 3, audios: 3 },
    pricePerSecondUsd: 0.15,
  },
  {
    id: 'dreamina-seedance-2-0-fast-260128',
    name: 'Seedance 2.0 Fast',
    tagline: '720p, audio, cheaper',
    dialect: 'byteplus-seedance',
    textToVideoEndpoint: 'dreamina-seedance-2-0-fast-260128',
    imageToVideoEndpoint: 'dreamina-seedance-2-0-fast-260128',
    referenceToVideoEndpoint: 'dreamina-seedance-2-0-fast-260128',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 4, max: 15, auto: true },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
    resolutions: ['720p', '480p'],
    references: { images: 9, videos: 3, audios: 3 },
    pricePerSecondUsd: 0.12,
  },
  {
    id: 'dreamina-seedance-2-0-mini-260615',
    name: 'Seedance 2.0 Mini',
    tagline: '720p, cheapest Seedance 2',
    dialect: 'byteplus-seedance',
    textToVideoEndpoint: 'dreamina-seedance-2-0-mini-260615',
    imageToVideoEndpoint: 'dreamina-seedance-2-0-mini-260615',
    referenceToVideoEndpoint: 'dreamina-seedance-2-0-mini-260615',
    supportsLastFrame: true,
    supportsAudio: true,
    supportsSeed: false,
    allowedDurations: [4, 5, 6, 8, 10, 12, 15],
    durationRange: { min: 4, max: 15, auto: true },
    allowedAspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'],
    resolutions: ['720p', '480p'],
    references: { images: 9, videos: 3, audios: 3 },
    pricePerSecondUsd: 0.08,
  },
];

/**
 * Every known entry, in one table — what `getVideoModel` / `coerceVideoModel`
 * resolve a persisted id against, across providers and past defaults.
 */
export const VIDEO_MODEL_CATALOG: readonly VideoModelCatalogEntry[] = [
  ...FAL_VIDEO_MODELS,
  ...FAL_LEGACY_VIDEO_MODELS,
  ...BYTEPLUS_VIDEO_MODELS,
];
