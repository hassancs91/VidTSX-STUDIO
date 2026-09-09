import type { ImageModelCatalogEntry } from '../shared/presets/image-models';
import {
  DEFAULT_IMAGE_DIALECT,
  IMAGE_DIALECT_DEFAULTS,
  isImageDialectId,
  type ImageDialectId,
} from '../shared/presets/image-dialects';
import type { ImageParamSchema } from '../shared/presets/image-model-params';
import { PROVIDER_MODEL_DEFAULTS } from '../shared/presets/provider-model-defaults';

/** The shipped entry for a provider's image id, if any. */
function shippedImageEntry(providerId: string, id: string): ImageModelCatalogEntry | undefined {
  const list = PROVIDER_MODEL_DEFAULTS[providerId]?.image ?? [];
  return list.find((m): m is ImageModelCatalogEntry => m.id === id);
}

/** The dialect an entry resolves to: named → shipped → the provider's default. */
export function resolveImageDialect(
  providerId: string,
  entry: Pick<ImageModelCatalogEntry, 'id' | 'dialect'>,
): ImageDialectId {
  const named = typeof entry.dialect === 'string' ? entry.dialect : undefined;
  if (named && isImageDialectId(named)) return named;
  const shipped = shippedImageEntry(providerId, entry.id)?.dialect;
  return shipped ?? DEFAULT_IMAGE_DIALECT[providerId] ?? 'fal-generic';
}

/**
 * Turn a stored catalog row (id + name + dialect) into a full image entry —
 * the image half of `hydrateVideoEntry`. Stored rows keep only what the user
 * can meaningfully edit; the price stays with the shipped entry (the usage
 * dashboard reads it from there by id).
 */
export function hydrateImageEntry(
  providerId: string,
  row: { id: string; name?: string; dialect?: string },
): ImageModelCatalogEntry {
  return {
    id: row.id,
    name: row.name?.trim() || row.id,
    dialect: resolveImageDialect(providerId, { id: row.id, dialect: row.dialect as ImageDialectId }),
  };
}

/** The params the dialog and the request builder agree on for one entry. */
export function imageEntryParamSchema(
  providerId: string,
  entry: Pick<ImageModelCatalogEntry, 'id' | 'dialect'>,
): ImageParamSchema {
  return IMAGE_DIALECT_DEFAULTS[resolveImageDialect(providerId, entry)].paramSchema;
}
