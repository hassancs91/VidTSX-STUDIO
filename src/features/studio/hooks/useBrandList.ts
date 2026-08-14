import { useEffect, useState } from 'react';

export interface BrandOption {
  id: string;
  name: string;
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
        setBrands(res.brands.map(({ id, name }) => ({ id, name })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return brands;
}
