import { useState, useEffect, useCallback } from 'react';
import type { ImageModelInfoIpc } from '../../../shared/ipc/types';

export function useImageModels() {
  const [models, setModels] = useState<ImageModelInfoIpc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.imageModelsGet();
      if (result.success) {
        const t2iModels = result.models.filter((m) =>
          m.supportedOperations.includes('text-to-image')
        );
        setModels(t2iModels);
      } else {
        setError('Failed to load image models');
      }
    } catch {
      setError('Failed to load image models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Refresh when provider config changes elsewhere (e.g. Settings screen), or
  // when a model's saved parameters change (the advanced panel's placeholders).
  useEffect(() => {
    const handler = () => {
      reload();
    };
    window.addEventListener('vidtsx:image-providers-changed', handler);
    window.addEventListener('vidtsx:image-model-params-changed', handler);
    return () => {
      window.removeEventListener('vidtsx:image-providers-changed', handler);
      window.removeEventListener('vidtsx:image-model-params-changed', handler);
    };
  }, [reload]);

  return { models, loading, error, reload };
}
