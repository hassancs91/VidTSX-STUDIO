import { useState, useEffect, useCallback } from 'react';
import type { ImageProviderInfo } from '../../shared/ipc/types';

/** Local state extends server info with an editable apiKey field */
export interface ImageProviderLocal extends ImageProviderInfo {
  apiKey: string;
}

interface TestState {
  testing: boolean;
  success?: boolean;
  saved?: boolean;
  durationMs?: number;
  error?: string;
}

const DEFAULT_FAL_PROVIDER: ImageProviderLocal = {
  id: 'fal',
  name: 'Fal.ai',
  type: 'fal',
  apiKey: '',
  defaultModel: 'nano-banana-pro',
  enabled: false,
  hasApiKey: false,
};

const DEFAULT_OPENROUTER_PROVIDER: ImageProviderLocal = {
  id: 'openrouter',
  name: 'OpenRouter',
  type: 'openrouter',
  apiKey: '',
  defaultModel: 'black-forest-labs/flux.2-pro',
  enabled: false,
  hasApiKey: false,
};

export function useImageProviders() {
  const [providers, setProviders] = useState<ImageProviderLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.imageProvidersGet();

      if (result.providers.length > 0) {
        // Convert server info to local state (apiKey starts empty — user re-enters to change)
        const loaded = result.providers.map((p) => ({
          ...p,
          apiKey: '',
        }));

        if (!loaded.find((p) => p.id === 'fal')) {
          loaded.unshift({ ...DEFAULT_FAL_PROVIDER });
        }
        if (!loaded.find((p) => p.id === 'openrouter')) {
          loaded.push({ ...DEFAULT_OPENROUTER_PROVIDER });
        }

        setProviders(loaded);
      } else {
        setProviders([
          { ...DEFAULT_FAL_PROVIDER },
          { ...DEFAULT_OPENROUTER_PROVIDER },
        ]);
      }
    } catch {
      setProviders([
        { ...DEFAULT_FAL_PROVIDER },
        { ...DEFAULT_OPENROUTER_PROVIDER },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateProvider = useCallback((id: string, updates: Partial<ImageProviderLocal>) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setSaveError(null);
  }, []);

  const saveProviders = useCallback(async () => {
    try {
      setSaving(true);
      setSaveError(null);

      const toSave = providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        apiKey: p.apiKey,
        defaultModel: p.defaultModel,
        enabled: p.enabled,
      }));

      // Filter out providers with empty API keys from save (keep only key changes)
      // If apiKey is empty, the backend keeps the previously saved key
      const result = await window.api.imageProvidersSave({
        providers: toSave,
        activeProvider: providers.find((p) => p.enabled)?.id,
      });

      if (!result.success) {
        setSaveError(result.error || 'Failed to save');
        return false;
      }

      // Reload to get updated hasApiKey status
      await load();
      window.dispatchEvent(new CustomEvent('vidtsx:image-providers-changed'));
      return true;
    } catch {
      setSaveError('Failed to save image provider settings');
      return false;
    } finally {
      setSaving(false);
    }
  }, [providers, load]);

  const testProvider = useCallback(async (providerId: string) => {
    setTestStates((prev) => ({
      ...prev,
      [providerId]: { testing: true },
    }));

    const draft = providers.find((p) => p.id === providerId);

    try {
      const result = await window.api.imageProviderTest({
        providerId,
        apiKey: draft?.apiKey || undefined,
        defaultModel: draft?.defaultModel,
      });
      setTestStates((prev) => ({
        ...prev,
        [providerId]: {
          testing: false,
          success: result.success,
          durationMs: result.durationMs,
          error: result.error,
        },
      }));

      // Auto-save on successful test so users don't need a separate Save click
      if (result.success) {
        const saved = await saveProviders();
        setTestStates((prev) => ({
          ...prev,
          [providerId]: { ...prev[providerId], saved },
        }));
      }
    } catch {
      setTestStates((prev) => ({
        ...prev,
        [providerId]: {
          testing: false,
          success: false,
          error: 'Test request failed',
        },
      }));
    }
  }, [providers, saveProviders]);

  return {
    providers,
    loading,
    saving,
    saveError,
    testStates,
    updateProvider,
    saveProviders,
    testProvider,
  };
}
