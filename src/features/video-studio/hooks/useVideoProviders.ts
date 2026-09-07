import { useState, useEffect, useCallback } from 'react';
import type { VideoProviderInfo } from '@shared/ipc/types';

/**
 * Video providers that currently have a key, plus the one the panel is
 * pointed at. There is no `videoProviderSwitch` IPC — `videoGenerate` takes a
 * `providerId` per job — so the selection lives here and is seeded from the
 * engine's active provider.
 */
export function useVideoProviders() {
  const [providers, setProviders] = useState<VideoProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const result = await window.api.videoProvidersGet();
      if (!result.success) {
        setError(result.error || 'Failed to load video providers');
        return;
      }
      setProviders(result.providers);
      // Keep the current pick when it still has a key; otherwise fall back to
      // the engine's active provider, then to the first usable one — the
      // select is hidden with a single provider, so a stale id would dead-end
      // the model picker with no way out.
      setSelectedProvider((prev) => {
        if (prev && result.providers.some((p) => p.id === prev)) return prev;
        const active = result.providers.find((p) => p.id === result.activeProvider);
        return (active ?? result.providers[0])?.id ?? null;
      });
    } catch {
      setError('Failed to load video providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A key change or a catalog save re-registers the engine's providers.
  useEffect(() => {
    const handler = () => {
      void reload();
    };
    window.addEventListener('vidtsx:video-providers-changed', handler);
    return () => window.removeEventListener('vidtsx:video-providers-changed', handler);
  }, [reload]);

  return { providers, selectedProvider, setSelectedProvider, loading, error, reload };
}
