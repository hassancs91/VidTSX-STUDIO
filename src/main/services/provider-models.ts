/**
 * Editable per-provider model catalogs (currently image models for fal /
 * OpenRouter). Defaults ship in shared/presets/provider-model-defaults.ts;
 * user edits persist as overrides in settings. Engines and the Providers UI
 * both read the merged view, so a saved catalog immediately drives every
 * model picker and provider registration.
 */
import type { ImageModelCatalogEntry } from '../../shared/presets/image-models';
import {
  getDefaultProviderModels,
  listDefaultCatalogKeys,
  type ProviderModelCategory,
} from '../../shared/presets/provider-model-defaults';
import { getProviderModelOverrides, saveProviderModelOverrides } from './settings';

export interface ProviderModelCatalog {
  providerId: string;
  category: ProviderModelCategory;
  models: ImageModelCatalogEntry[];
  /** True when no user override is stored — the list equals the shipped defaults. */
  isDefault: boolean;
}

function sanitizeEntries(models: ImageModelCatalogEntry[]): ImageModelCatalogEntry[] {
  const seen = new Set<string>();
  const clean: ImageModelCatalogEntry[] = [];
  for (const entry of models) {
    const id = entry.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    clean.push({ id, name: entry.name?.trim() || id });
  }
  return clean;
}

/** Merged catalog list (defaults overlaid with user overrides), for the UI. */
export async function getProviderModelCatalogs(): Promise<ProviderModelCatalog[]> {
  const overrides = await getProviderModelOverrides();
  return listDefaultCatalogKeys().map(({ providerId, category }) => {
    const stored = overrides[providerId]?.[category];
    return {
      providerId,
      category,
      models: stored ? sanitizeEntries(stored) : getDefaultProviderModels(providerId, category),
      isDefault: !stored,
    };
  });
}

/** Effective model list for one provider×category, for engine registration. */
export async function getProviderModels(
  providerId: string,
  category: ProviderModelCategory,
): Promise<ImageModelCatalogEntry[]> {
  const overrides = await getProviderModelOverrides();
  const stored = overrides[providerId]?.[category];
  return stored ? sanitizeEntries(stored) : getDefaultProviderModels(providerId, category);
}

export async function saveProviderModels(
  providerId: string,
  category: ProviderModelCategory,
  models: ImageModelCatalogEntry[],
): Promise<void> {
  const clean = sanitizeEntries(models);
  if (clean.length === 0) {
    throw new Error('A model catalog needs at least one model — use Reset to restore defaults.');
  }
  const overrides = await getProviderModelOverrides();
  await saveProviderModelOverrides({
    ...overrides,
    [providerId]: { ...overrides[providerId], [category]: clean },
  });
}

export async function resetProviderModels(
  providerId: string,
  category: ProviderModelCategory,
): Promise<void> {
  const overrides = await getProviderModelOverrides();
  const forProvider = { ...overrides[providerId] };
  delete forProvider[category];
  const next = { ...overrides };
  if (Object.keys(forProvider).length === 0) delete next[providerId];
  else next[providerId] = forProvider;
  await saveProviderModelOverrides(next);
}
