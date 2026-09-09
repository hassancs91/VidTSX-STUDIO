import { useState, useEffect, useCallback } from 'react';
import type { LlmProviderConfig } from '../../shared/ipc/types';
import { filterUsableLlmProviders } from '../../shared/services/llm-provider-filter';

/**
 * Provider selection for any screen that generates with an LLM: exposes the
 * usable providers (enabled + configured, no Local — see
 * filterUsableLlmProviders) and a selection that survives config changes.
 * Refreshes automatically when the Providers UI saves
 * (`vidtsx:llm-providers-changed`).
 */
export function useProviderPicker() {
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  const loadProviders = useCallback(async () => {
    try {
      const result = await window.api.llmProvidersGet();
      const usable = filterUsableLlmProviders(result.providers);
      setProviders(usable);
      // Preserve the current selection if still usable; otherwise fall back
      // to the backend-active provider, then the first usable one.
      setSelectedProvider((current) => {
        if (current && usable.some((p) => p.id === current)) return current;
        const active = result.activeProvider;
        if (active && usable.some((p) => p.id === active)) return active;
        return usable.length > 0 ? usable[0].id : '';
      });
    } catch {
      // Silently fail — dropdown shows "No providers configured"
    }
  }, []);

  useEffect(() => {
    loadProviders();
    window.addEventListener('vidtsx:llm-providers-changed', loadProviders);
    return () => window.removeEventListener('vidtsx:llm-providers-changed', loadProviders);
  }, [loadProviders]);

  return { providers, selectedProvider, setSelectedProvider, reload: loadProviders };
}
