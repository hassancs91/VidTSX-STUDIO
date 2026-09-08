// Provider selection for an agent session (agents plan §1.8).
//
// Two rules that are not the app's usual ones, which is why this is its own
// hook rather than a shared picker:
//
//   * A provider is REQUIRED. With none usable the workspace shows one empty
//     state and creates no session at all — `usable` false says so.
//   * Preselection order is per agent: the provider this agent's last session
//     used, then the app's active provider, then the first usable one.

import { useCallback, useEffect, useState } from 'react';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { filterUsableLlmProviders } from '@shared/services/llm-provider-filter';

export function useAgentProviders(lastUsedProviderId?: string) {
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await window.api.llmProvidersGet();
      const usable = filterUsableLlmProviders(result.providers);
      setProviders(usable);
      setProviderId((current) => {
        if (current && usable.some((p) => p.id === current)) return current;
        if (lastUsedProviderId && usable.some((p) => p.id === lastUsedProviderId)) {
          return lastUsedProviderId;
        }
        const active = result.activeProvider;
        if (active && usable.some((p) => p.id === active)) return active;
        return usable[0]?.id ?? '';
      });
    } catch {
      setProviders([]);
    } finally {
      setLoaded(true);
    }
  }, [lastUsedProviderId]);

  useEffect(() => {
    void load();
    window.addEventListener('vidtsx:llm-providers-changed', load);
    return () => window.removeEventListener('vidtsx:llm-providers-changed', load);
  }, [load]);

  return { providers, providerId, setProviderId, usable: providers.length > 0, loaded };
}
