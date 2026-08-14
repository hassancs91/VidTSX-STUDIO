import { useCallback, useEffect, useState } from 'react';
import type { StudioBrand } from '@shared/types/asset-library';
import type { StudioBrandInput } from '@shared/studio/brand';

/**
 * Brand list + default pointer for the Assets screen (L3/D11). Mutations
 * return an error string (null = ok) so the dialog can show inline feedback;
 * every successful mutation re-fetches, keeping the list authoritative.
 */
export function useBrands() {
  const [brands, setBrands] = useState<StudioBrand[]>([]);
  const [defaultBrandId, setDefaultBrandId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.libraryBrandsGet();
      if (res.success) {
        setBrands(res.brands ?? []);
        setDefaultBrandId(res.defaultBrandId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveBrand = useCallback(
    async (input: StudioBrandInput, brandId?: string): Promise<string | null> => {
      const res = await window.api.libraryBrandSave({ ...(brandId ? { brandId } : {}), input });
      if (!res.success) return res.error ?? 'Failed to save the brand';
      await refresh();
      return null;
    },
    [refresh],
  );

  const deleteBrand = useCallback(
    async (brandId: string): Promise<string | null> => {
      const res = await window.api.libraryBrandDelete({ brandId });
      if (!res.success) return res.error ?? 'Failed to delete the brand';
      await refresh();
      return null;
    },
    [refresh],
  );

  const setDefault = useCallback(
    async (brandId: string | null): Promise<string | null> => {
      const res = await window.api.libraryBrandDefaultSet({ brandId });
      if (!res.success) return res.error ?? 'Failed to set the default brand';
      await refresh();
      return null;
    },
    [refresh],
  );

  return { brands, defaultBrandId, loading, refresh, saveBrand, deleteBrand, setDefault };
}
