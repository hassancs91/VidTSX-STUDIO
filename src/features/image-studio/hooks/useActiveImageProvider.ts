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
      const [result, localModels, geminiModels] = await Promise.all([
        window.api.imageProvidersGet(),
        // The CLI bridges aren't stored in provider settings — each is offered
        // whenever it reports at least one ready model (local: an on-device
        // model exists; gemini-cli: agy is installed and signed in).
        window.api.imageModelsGet({ providerId: 'local' }),
        window.api.imageModelsGet({ providerId: 'gemini-cli' }),
      ]);
      if (result.success) {
        const enabled = result.providers
          .filter((p) => p.enabled && p.hasApiKey)
          .map((p) => ({ id: p.id, name: p.name }));
        if (localModels.success && localModels.models.length > 0) {
          enabled.push({ id: 'local', name: 'Local (open source)' });
        }
        if (geminiModels.success && geminiModels.models.length > 0) {
          enabled.push({ id: 'gemini-cli', name: 'Google (subscription)' });
        }
        setProviders(enabled);
        // A stale active provider (e.g. 'local' after its models were removed,
        // or a provider whose key was cleared) dead-ends the model picker —
        // the provider select is hidden when only one provider exists, so
        // nothing lets the user switch away. Fall over to the first usable one.
        const active = result.activeProvider;
        const activeIsUsable = active !== null && enabled.some((p) => p.id === active);
        if (!activeIsUsable && enabled.length > 0) {
          const next = enabled[0].id;
          const switched = await window.api.imageProviderSwitch({ providerId: next });
          setActiveProvider(switched.success ? next : active);
          // useImageModels listens for this and reloads the picker; the
          // re-entrant load() here sees a usable active provider and stops.
          if (switched.success) {
            window.dispatchEvent(new CustomEvent('vidtsx:image-providers-changed'));
          }
        } else {
          setActiveProvider(active);
        }
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
