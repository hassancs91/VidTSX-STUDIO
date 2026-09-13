import { useCallback, useEffect, useState } from 'react';
import type { BrandOption } from './useBrandList';
import { notifyBrandsChanged } from './useBrandList';

export interface ProjectBrandState {
  /** The project's own `brand.json`, as a picker option; null = none. */
  snapshot: BrandOption | null;
  /** Copy the snapshot into the library; resolves to the new brand id, or an error message. */
  promote: () => Promise<{ brandId: string } | { error: string }>;
  promoting: boolean;
}

/**
 * The project-local brand snapshot (video-10 feedback item 7): the file the
 * package import's "keep the tokens with the project" option writes, which
 * main renders against when no library brand is set. Loaded once per project;
 * "Save to library" promotes it through main and tells every brand list to
 * refresh.
 */
export function useProjectBrand(projectId: string): ProjectBrandState {
  const [snapshot, setSnapshot] = useState<BrandOption | null>(null);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await window.api.studioProjectBrandGet({ projectId });
      if (cancelled) return;
      const brand = res.success ? res.brand : null;
      setSnapshot(brand ? { id: brand.id, name: brand.name, palette: brand.palette, fonts: brand.fonts } : null);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const promote = useCallback(async () => {
    setPromoting(true);
    try {
      const res = await window.api.studioProjectBrandPromote({ projectId });
      if (!res.success || !res.brand) return { error: res.error ?? 'Could not save the brand to the library.' };
      notifyBrandsChanged();
      return { brandId: res.brand.id };
    } finally {
      setPromoting(false);
    }
  }, [projectId]);

  return { snapshot, promote, promoting };
}
