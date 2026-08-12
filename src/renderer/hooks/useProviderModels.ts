import { useCallback, useEffect, useState } from 'react';
import type { ProviderModelCatalogIpc, ProviderModelsSaveResponse } from '@shared/ipc/types';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';
import type { ProviderModelCategory } from '@shared/presets/provider-model-defaults';

/**
 * Editable per-provider model catalogs (AI page → Providers → Model Catalogs).
 * Every save/reset re-registers the image providers in the main process, so
 * dependent pickers refresh via the image-providers-changed event.
 */
export function useProviderModels() {
  const [catalogs, setCatalogs] = useState<ProviderModelCatalogIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResponse = useCallback((res: ProviderModelsSaveResponse) => {
    if (res.success) {
      setCatalogs(res.catalogs);
      setError(null);
      window.dispatchEvent(new CustomEvent('vidtsx:image-providers-changed'));
    } else {
      setError(res.error ?? 'Failed to update model catalog');
    }
    return res.success;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.api.providerModelsGet();
        if (cancelled) return;
        if (res.success) setCatalogs(res.catalogs);
        else setError(res.error ?? 'Failed to load model catalogs');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load model catalogs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (providerId: string, category: ProviderModelCategory, models: ImageModelCatalogEntry[]) => {
      setBusy(true);
      try {
        return applyResponse(await window.api.providerModelsSave({ providerId, category, models }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save model catalog');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyResponse],
  );

  const reset = useCallback(
    async (providerId: string, category: ProviderModelCategory) => {
      setBusy(true);
      try {
        return applyResponse(await window.api.providerModelsReset({ providerId, category }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reset model catalog');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyResponse],
  );

  return { catalogs, loading, busy, error, save, reset };
}
