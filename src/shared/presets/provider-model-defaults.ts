/**
 * Default model catalogs per cloud provider — the single source the editable
 * per-provider model lists seed from (AI page → Providers → Model Catalogs).
 * User edits are stored as overrides in settings (`providerModels`); resetting
 * a catalog falls back to these entries.
 *
 * Image only for now: image APIs are uniform per provider, so user-added ids
 * work generically. Video models are NOT user-editable — each needs its own
 * request-payload dialect (see video-models.ts + video-payloads.ts).
 */
import type { ImageModelCatalogEntry } from './image-models';

export type ProviderModelCategory = 'image';

export interface ProviderModelCatalogKey {
  providerId: string;
  category: ProviderModelCategory;
}

/** providerId → category → default entries. */
export const PROVIDER_MODEL_DEFAULTS: Record<
  string,
  Partial<Record<ProviderModelCategory, readonly ImageModelCatalogEntry[]>>
> = {
  // priceUsd = estimated cost per ~1MP image, for the usage dashboard only
  // (the provider is the billing authority; models without a verified rate
  // omit it and log $0).
  fal: {
    image: [
      { id: 'nano-banana-pro', name: 'Nano Banana Pro', priceUsd: 0.15 },
      { id: 'nano-banana-2', name: 'Nano Banana 2', priceUsd: 0.04 },
      { id: 'seedream-v4.5', name: 'SeedREAM v4.5', priceUsd: 0.04 },
    ],
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
): ImageModelCatalogEntry[] {
  return [...(PROVIDER_MODEL_DEFAULTS[providerId]?.[category] ?? [])];
}

/**
 * Estimated per-image price for the usage dashboard, looked up from the
 * SHIPPED defaults (user catalog edits are sanitized down to id + name, so
 * they can't carry prices). Unknown provider/model → 0.
 */
export function getDefaultImageModelPriceUsd(providerId: string, modelId: string): number {
  const entry = PROVIDER_MODEL_DEFAULTS[providerId]?.image?.find((m) => m.id === modelId);
  return entry?.priceUsd ?? 0;
}
