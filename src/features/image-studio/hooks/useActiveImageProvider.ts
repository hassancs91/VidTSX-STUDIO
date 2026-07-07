import { useState, useEffect, useCallback } from 'react';

interface EnabledProvider {
  id: string;
  name: string;
}

export function useActiveImageProvider() {
  const [providers, setProviders] = useState<EnabledProvider[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await window.api.imageProvidersGet();
      if (result.success) {
        const enabled = result.providers
          .filter((p) => p.enabled && p.hasApiKey)
          .map((p) => ({ id: p.id, name: p.name }));
        setProviders(enabled);
        setActiveProvider(result.activeProvider);
      } else {
        setError('Failed to load image providers');
      }
    } catch {
      setError('Failed to load image providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when provider config changes elsewhere (e.g. Settings screen).
  useEffect(() => {
    const handler = () => {
      load();
    };
    window.addEventListener('vidtsx:image-providers-changed', handler);
    return () => window.removeEventListener('vidtsx:image-providers-changed', handler);
  }, [load]);

  const switchProvider = useCallback(async (providerId: string) => {
    const result = await window.api.imageProviderSwitch({ providerId });
    if (result.success) {
      setActiveProvider(providerId);
    }
    return result.success;
  }, []);

  return { providers, activeProvider, loading, error, switchProvider };
}
