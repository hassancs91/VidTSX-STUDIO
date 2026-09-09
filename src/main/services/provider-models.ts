/**
 * Editable per-provider model catalogs (currently image models for fal /
 * OpenRouter). Defaults ship in shared/presets/provider-model-defaults.ts;
 * user edits persist as overrides in settings. Engines and the Providers UI
 * both read the merged view, so a saved catalog immediately drives every
 * model picker and provider registration.
 */
import {
  getDefaultProviderModels,
  isVideoCatalogEntry,
  listDefaultCatalogKeys,
  type ProviderModelCatalogEntry,
  type ProviderModelCategory,
} from '../../shared/presets/provider-model-defaults';
import { isVideoDialectId } from '../../shared/presets/video-models';
import type { VideoDialectId, VideoModelCatalogEntry } from '../../shared/presets/video-models';
import { hydrateVideoEntry } from '../../video-engine';
import { hydrateImageEntry } from '../../image-engine/dialect-capabilities';
import type { ImageModelCatalogEntry } from '../../shared/presets/image-models';
import { getProviderModelOverrides, saveProviderModelOverrides } from './settings';

/** Family a video entry falls back to when none is named or it is unknown. */
const DEFAULT_VIDEO_DIALECT: Record<string, VideoDialectId> = {
  byteplus: 'byteplus-seedance',
  fal: 'fal-seedance-2',
};

export interface ProviderModelCatalog {
  providerId: string;
  category: ProviderModelCategory;
  models: ProviderModelCatalogEntry[];
  /** True when no user override is stored — the list equals the shipped defaults. */
  isDefault: boolean;
}

/**
 * Stored rows keep only what a user can meaningfully edit — id, name, and for
 * image and video the dialect. Everything else (routes, durations, aspect
 * ratios, reference limits, accepted parameters) is re-derived from the
 * dialect on load, so a saved catalog can never carry stale or hand-written
 * capabilities. An image row without a dialect (pre-W2c) resolves to the
 * shipped entry's dialect or the provider default.
 */
function sanitizeEntries(
  models: ProviderModelCatalogEntry[],
  category: ProviderModelCategory,
  providerId: string,
): ProviderModelCatalogEntry[] {
  const seen = new Set<string>();
  const clean: ProviderModelCatalogEntry[] = [];
  for (const entry of models) {
    const id = entry.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (category === 'video') {
      // A row fresh from the catalog card is {id, name, dialect} — not yet hydrated.
      const named = 'dialect' in entry && typeof entry.dialect === 'string' ? entry.dialect : undefined;
      const dialect =
        named && isVideoDialectId(named)
          ? named
          : (DEFAULT_VIDEO_DIALECT[providerId] ?? 'fal-generic');
      clean.push(hydrateVideoEntry({ id, dialect, ...(entry.name ? { name: entry.name } : {}) }));
    } else if (category === 'image') {
      const named = 'dialect' in entry && typeof entry.dialect === 'string' ? entry.dialect : undefined;
      clean.push(hydrateImageEntry(providerId, { id, name: entry.name, dialect: named }));
    } else {
      clean.push({ id, name: entry.name?.trim() || id });
    }
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
      models: stored
        ? sanitizeEntries(stored, category, providerId)
        : getDefaultProviderModels(providerId, category),
      isDefault: !stored,
    };
  });
}

/** Effective model list for one provider×category, for engine registration. */
export async function getProviderModels(
  providerId: string,
  category: ProviderModelCategory,
): Promise<ProviderModelCatalogEntry[]> {
  const overrides = await getProviderModelOverrides();
  const stored = overrides[providerId]?.[category];
  return stored
    ? sanitizeEntries(stored, category, providerId)
    : getDefaultProviderModels(providerId, category);
}

/** The image view of a catalog, for registering an image provider. */
export async function getProviderImageModels(
  providerId: string,
): Promise<ImageModelCatalogEntry[]> {
  const models = await getProviderModels(providerId, 'image');
  return models.filter((m): m is ImageModelCatalogEntry => !isVideoCatalogEntry(m));
}

/** The video view of a catalog, for registering a video provider. */
export async function getProviderVideoModels(
  providerId: string,
): Promise<VideoModelCatalogEntry[]> {
  const models = await getProviderModels(providerId, 'video');
  return models.filter(isVideoCatalogEntry);
}

export async function saveProviderModels(
  providerId: string,
  category: ProviderModelCategory,
  models: ProviderModelCatalogEntry[],
): Promise<void> {
  const clean = sanitizeEntries(models, category, providerId);
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
