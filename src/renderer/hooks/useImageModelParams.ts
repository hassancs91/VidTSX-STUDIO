import { useCallback, useEffect, useState } from 'react';
import {
  imageParamKey,
  type ImageModelParamOverrides,
  type ImageModelParams,
} from '@shared/presets/image-model-params';

/** Fired on the window after an override is saved or reset, so model lists re-read `params`. */
export const IMAGE_MODEL_PARAMS_CHANGED_EVENT = 'vidtsx:image-model-params-changed';

/**
 * Per-model image parameter overrides (AI → Models gear buttons, Image
 * Studio's advanced panel). Reads the whole map once; `save` with `null`
 * resets a model to its defaults. Both the local rows and the cloud catalog
 * rows key the same store as `provider/model`.
 */
export function useImageModelParams() {
  const [overrides, setOverrides] = useState<ImageModelParamOverrides>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await window.api.imageModelParamsGet();
      if (res.success) {
        setOverrides(res.overrides);
        setError(null);
      } else {
        setError(res.error ?? 'Failed to load model parameters');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model parameters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    window.addEventListener(IMAGE_MODEL_PARAMS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(IMAGE_MODEL_PARAMS_CHANGED_EVENT, reload);
  }, [reload]);

  const get = useCallback(
    (providerId: string, modelId: string): ImageModelParams | undefined =>
      overrides[imageParamKey(providerId, modelId)],
    [overrides],
  );

  const save = useCallback(
    async (providerId: string, modelId: string, params: ImageModelParams | null): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await window.api.imageModelParamsSave({ providerId, modelId, params });
        if (!res.success) {
          setError(res.error ?? 'Failed to save model parameters');
          return false;
        }
        setOverrides(res.overrides);
        setError(null);
        window.dispatchEvent(new CustomEvent(IMAGE_MODEL_PARAMS_CHANGED_EVENT));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save model parameters');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { overrides, loading, busy, error, get, save, reload };
}
