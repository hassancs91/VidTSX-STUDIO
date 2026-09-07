import { useState, useEffect, useCallback } from 'react';
import type { VideoModelInfoIpc } from '@shared/ipc/types';

/**
 * The models one provider serves, with the published capabilities the control
 * panel narrows its fields against. The engine is the only source: a model
 * added in AI → Providers → Model Catalogs appears here on the next reload.
 */
export function useVideoModels(providerId: string | null) {
  const [models, setModels] = useState<VideoModelInfoIpc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!providerId) {
      setModels([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.videoModelsGet({ providerId });
      if (result.success) {
        setModels(result.models);
      } else {
        setModels([]);
        setError(result.error || 'Failed to load video models');
      }
    } catch {
      setModels([]);
      setError('Failed to load video models');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A catalog save re-registers the engine for that category.
  useEffect(() => {
    const handler = () => {
      void reload();
    };
    window.addEventListener('vidtsx:video-providers-changed', handler);
    return () => window.removeEventListener('vidtsx:video-providers-changed', handler);
  }, [reload]);

  return { models, loading, error, reload };
}
