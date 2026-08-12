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
  fal: {
    image: [
      { id: 'nano-banana-pro', name: 'Nano Banana Pro' },
      { id: 'nano-banana-2', name: 'Nano Banana 2' },
      { id: 'seedream-v4.5', name: 'SeedREAM v4.5' },
    ],
  },
  openrouter: {
    image: [
      { id: 'black-forest-labs/flux.2-pro', name: 'FLUX.2 Pro' },
      { id: 'black-forest-labs/flux.2-max', name: 'FLUX.2 Max' },
      { id: 'black-forest-labs/flux.2-flex', name: 'FLUX.2 Flex' },
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
