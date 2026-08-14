import { getValue, setValue } from '../settings-db';

/**
 * The Studio default-brand pointer (ASSET_LIBRARY_DESIGN.md L3). Read
 * straight from the settings KV store — settings.ts is owned by a parallel
 * workstream right now (the assetsRootOverride precedent in library-paths.ts);
 * fold a typed accessor in when it settles. New projects COPY this id into
 * project.settings.brandId at creation; it is never read again for existing
 * projects.
 */

const DEFAULT_BRAND_KEY = 'studioDefaultBrandId';

export function getDefaultBrandId(): string | undefined {
  const id = getValue<string>(DEFAULT_BRAND_KEY);
  return id && id.trim() !== '' ? id : undefined;
}

/** Set or clear (null) the app-wide default brand. */
export function setDefaultBrandId(brandId: string | null): void {
  setValue(DEFAULT_BRAND_KEY, brandId === null ? undefined : brandId);
}
