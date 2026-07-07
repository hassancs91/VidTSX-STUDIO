import { useCallback, useEffect, useState } from 'react';
import type { StudioBrand } from '@shared/ipc/types';
import {
  createEmptyBrand,
  deleteBrand as deleteBrandRemote,
  fetchBrands,
  saveBrand as saveBrandRemote,
} from '../services/brands-service';

interface UseStudioBrandsResult {
  brands: StudioBrand[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  createBrand: () => Promise<StudioBrand>;
  updateBrand: (id: string, patch: { name?: string; content?: string }) => Promise<void>;
  removeBrand: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStudioBrands(): UseStudioBrandsResult {
  const [brands, setBrands] = useState<StudioBrand[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const next = await fetchBrands();
      setBrands(next);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brands');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createBrand = useCallback(async (): Promise<StudioBrand> => {
    const draft = createEmptyBrand();
    await saveBrandRemote(draft);
    setBrands((prev) => [draft, ...prev]);
    return draft;
  }, []);

  const updateBrand = useCallback(
    async (id: string, patch: { name?: string; content?: string }) => {
      const existing = brands.find((b) => b.id === id);
      if (!existing) return;
      const next: StudioBrand = {
        ...existing,
        name: patch.name ?? existing.name,
        content: patch.content ?? existing.content,
        updatedAt: Date.now(),
      };
      // Optimistic — list re-orders by updatedAt desc so the edited brand floats up.
      setBrands((prev) => {
        const without = prev.filter((b) => b.id !== id);
        return [next, ...without];
      });
      await saveBrandRemote(next);
    },
    [brands]
  );

  const removeBrand = useCallback(async (id: string) => {
    setBrands((prev) => prev.filter((b) => b.id !== id));
    await deleteBrandRemote(id);
  }, []);

  return { brands, status, error, createBrand, updateBrand, removeBrand, refresh };
}
