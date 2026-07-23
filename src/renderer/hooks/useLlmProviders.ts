import { useState, useEffect, useCallback } from 'react';
import type {
  LlmProviderConfig,
  LlmProviderPreset,
} from '../../shared/ipc/types';

interface TestState {
  testing: boolean;
  success?: boolean;
  responseText?: string;
  durationMs?: number;
  error?: string;
}

export function useLlmProviders() {
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [presets, setPresets] = useState<LlmProviderPreset[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.llmProvidersGet();
      setPresets(result.presets);
      setActiveProvider(result.activeProvider);

      // Merge presets with saved configs: show all presets, overlay saved values
      const merged = result.presets.map((preset) => {
        const saved = result.providers.find((p) => p.id === preset.id);
        if (saved) return saved;
        // Not configured yet — default disabled (except subscription)
        return {
          ...preset,
          enabled: preset.id === 'claude-subscription',
        } as LlmProviderConfig;
      });
      // Saved providers with no matching preset are user-added custom entries.
      const customs = result.providers.filter(
        (p) => !result.presets.some((preset) => preset.id === p.id),
      );
      setProviders([...merged, ...customs]);
    } catch {
      // Silently fail — UI shows empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateProvider = useCallback((id: string, updates: Partial<LlmProviderConfig>) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setSaveError(null);
  }, []);

  const addProvider = useCallback((config: LlmProviderConfig) => {
    setProviders((prev) => [...prev, config]);
    setSaveError(null);
  }, []);

  const removeProvider = useCallback((id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    setSaveError(null);
  }, []);

  const saveProviders = useCallback(async () => {
    try {
      setSaving(true);
      setSaveError(null);
      const active = activeProvider || providers.find((p) => p.enabled)?.id || '';
      const result = await window.api.llmProvidersSave({
        providers,
        activeProvider: active,
      });
      if (!result.success) {
        setSaveError(result.error || 'Failed to save');
      } else {
        window.dispatchEvent(new CustomEvent('vidtsx:llm-providers-changed'));
      }
      return result.success;
    } catch (err) {
      setSaveError('Failed to save provider settings');
      return false;
    } finally {
      setSaving(false);
    }
  }, [providers, activeProvider]);

  const testProvider = useCallback(async (provider: LlmProviderConfig) => {
    setTestStates((prev) => ({
      ...prev,
      [provider.id]: { testing: true },
    }));

    try {
      const result = await window.api.llmProviderTest({ provider });
      setTestStates((prev) => ({
        ...prev,
        [provider.id]: {
          testing: false,
          success: result.success,
          responseText: result.responseText,
          durationMs: result.durationMs,
          error: result.error,
        },
      }));
    } catch {
      setTestStates((prev) => ({
        ...prev,
        [provider.id]: {
          testing: false,
          success: false,
          error: 'Test request failed',
        },
      }));
    }
  }, []);

  return {
    providers,
    presets,
    activeProvider,
    loading,
    saving,
    saveError,
    testStates,
    updateProvider,
    addProvider,
    removeProvider,
    setActiveProvider,
    saveProviders,
    testProvider,
    reload: load,
  };
}
