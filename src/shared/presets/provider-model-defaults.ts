/**
 * Default model catalogs per cloud provider — the single source the editable
 * per-provider model lists seed from (AI page → Providers → Model Catalogs).
 * User edits are stored as overrides in settings (`providerModels`); resetting
 * a catalog falls back to these entries.
 *
 * Image APIs are uniform per provider, so a user-added image id works
 * generically. Video entries additionally name their request-body *dialect*
 * (video-models.ts + src/video-engine/dialects.ts), which is what makes video
 * catalogs editable too: a new slug in a family already implemented needs no
 * code, only an entry naming that family.
 */
import type { ImageModelCatalogEntry } from './image-models';
import type { LlmModelCatalogEntry } from './llm-models';
import { LLM_MODEL_CATALOG } from './llm-models';
import type { VideoModelCatalogEntry } from './video-models';
import {
  BYTEPLUS_VIDEO_MODELS,
  DEFAULT_BYTEPLUS_VIDEO_MODEL,
  DEFAULT_VIDEO_MODEL,
  FAL_VIDEO_MODELS,
} from './video-models';

/**
 * 'llm' catalogs are keyed by LLM PRESET id (`src/engine/presets.ts`), which
 * is also what `LlmProviderConfig.id` carries — so 'openrouter' holds both an
 * image list (BYOK image API) and an llm list (the Anthropic-compatible route).
 */
export type ProviderModelCategory = 'image' | 'video' | 'llm';

export type ProviderModelCatalogEntry =
  | ImageModelCatalogEntry
  | VideoModelCatalogEntry
  | LlmModelCatalogEntry;

/** A video entry is the one that names a dialect. */
export function isVideoCatalogEntry(
  entry: ProviderModelCatalogEntry,
): entry is VideoModelCatalogEntry {
  return 'dialect' in entry;
}

export interface ProviderModelCatalogKey {
  providerId: string;
  category: ProviderModelCategory;
}

type ProviderDefaults = Record<
  string,
  Partial<Record<ProviderModelCategory, readonly ProviderModelCatalogEntry[]>>
>;

/** The image/video half, keyed by BYOK provider id. */
const MEDIA_MODEL_DEFAULTS: ProviderDefaults = {
  // priceUsd = estimated cost per ~1MP image, for the usage dashboard only
  // (the provider is the billing authority; models without a verified rate
  // omit it and log $0).
  fal: {
    image: [
      { id: 'nano-banana-pro', name: 'Nano Banana Pro', priceUsd: 0.15 },
      { id: 'nano-banana-2', name: 'Nano Banana 2', priceUsd: 0.04 },
      { id: 'seedream-v4.5', name: 'SeedREAM v4.5', priceUsd: 0.04 },
    ],
    video: FAL_VIDEO_MODELS,
  },
  byteplus: {
    video: BYTEPLUS_VIDEO_MODELS,
  },
  openrouter: {
    image: [
      { id: 'black-forest-labs/flux.2-pro', name: 'FLUX.2 Pro', priceUsd: 0.03 },
      { id: 'black-forest-labs/flux.2-max', name: 'FLUX.2 Max' },
      { id: 'black-forest-labs/flux.2-flex', name: 'FLUX.2 Flex' },
    ],
  },
  cloudflare: {
    image: [
      { id: '@cf/black-forest-labs/flux-1-schnell', name: 'FLUX.1 Schnell', priceUsd: 0.0006 },
      { id: '@cf/black-forest-labs/flux-2-klein-9b', name: 'FLUX.2 Klein 9B', priceUsd: 0.015 },
      { id: '@cf/black-forest-labs/flux-2-dev', name: 'FLUX.2 Dev', priceUsd: 0.05 },
      { id: '@cf/leonardo/lucid-origin', name: 'Lucid Origin' },
      { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'SDXL Lightning' },
    ],
  },
};

/** providerId → category → default entries (media lists + the llm lists). */
export const PROVIDER_MODEL_DEFAULTS: ProviderDefaults = Object.entries(LLM_MODEL_CATALOG).reduce(
  (acc, [presetId, llm]) => {
    acc[presetId] = { ...acc[presetId], llm };
    return acc;
  },
  { ...MEDIA_MODEL_DEFAULTS } as ProviderDefaults,
);

/** The model a provider's video catalog offers first. */
export const DEFAULT_VIDEO_MODEL_BY_PROVIDER: Record<string, string> = {
  fal: DEFAULT_VIDEO_MODEL,
  byteplus: DEFAULT_BYTEPLUS_VIDEO_MODEL,
};

/** Every provider×category pair that has a default catalog, in display order. */
export function listDefaultCatalogKeys(): ProviderModelCatalogKey[] {
  const keys: ProviderModelCatalogKey[] = [];
  for (const [providerId, byCategory] of Object.entries(PROVIDER_MODEL_DEFAULTS)) {
    for (const category of Object.keys(byCategory) as ProviderModelCategory[]) {
      keys.push({ providerId, category });
    }
  }
  return keys;
}

export function getDefaultProviderModels(
  providerId: string,
  category: ProviderModelCategory,
): ProviderModelCatalogEntry[] {
  return [...(PROVIDER_MODEL_DEFAULTS[providerId]?.[category] ?? [])];
}

/**
 * Estimated per-image price for the usage dashboard, looked up from the
 * SHIPPED defaults (user catalog edits are sanitized down to id + name, so
 * they can't carry prices). Unknown provider/model → 0.
 */
export function getDefaultImageModelPriceUsd(providerId: string, modelId: string): number {
  const entry = PROVIDER_MODEL_DEFAULTS[providerId]?.image?.find((m) => m.id === modelId);
  return entry && 'priceUsd' in entry ? (entry.priceUsd ?? 0) : 0;
}
