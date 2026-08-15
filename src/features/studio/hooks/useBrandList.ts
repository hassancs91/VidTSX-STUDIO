import { useEffect, useState } from 'react';
import type { StudioBrandPalette } from '@shared/types/asset-library';

export interface BrandOption {
  id: string;
  name: string;
  /** Colors + fonts — what caption templates paint with (D13). The shot
   *  pipeline injects the brand in main, so only captions read these here. */
  palette: StudioBrandPalette;
  fonts: { display: string; body?: string };
}

/**
 * Read-only brand list for the per-project brand picker (D11). The studio
 * feature never imports asset-library — the shared library IPC surface is
 * the one crossing point. Fetched once per mount; brand curation happens on
 * the Assets screen, so staleness within an editor session is acceptable.
 */
export function useBrandList(): BrandOption[] {
  const [brands, setBrands] = useState<BrandOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void window.api.libraryBrandsGet().then((res) => {
      if (!cancelled && res.success && res.brands) {
        setBrands(res.brands.map(({ id, name, palette, fonts }) => ({ id, name, palette, fonts })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return brands;
}
