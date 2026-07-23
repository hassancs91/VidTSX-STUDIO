import { useCallback, useEffect, useState } from 'react';
import type { ProviderKeyId } from '@shared/ipc/types';

export interface ProviderKeysState {
  hasKeys: Record<ProviderKeyId, boolean>;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const INITIAL: ProviderKeysState = {
  hasKeys: { fal: false, openrouter: false, assemblyai: false, zai: false },
  loading: true,
  saving: false,
  error: null,
};

/**
 * Shared BYOK provider credentials (Fal / OpenRouter / AssemblyAI). Raw keys
 * never reach the renderer — only hasKeys booleans. Saving re-registers every
 * engine in the main process so new keys take effect immediately.
 */
export function useProviderKeys() {
  const [state, setState] = useState<ProviderKeysState>(INITIAL);

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.providerKeysGet();
      setState((prev) => ({
        ...prev,
        hasKeys: res.hasKeys,
        loading: false,
        error: res.success ? null : (res.error ?? 'Failed to load keys'),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load keys',
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveKeys = useCallback(
    async (keys: Partial<Record<ProviderKeyId, string>>, clear?: ProviderKeyId[]) => {
      setState((prev) => ({ ...prev, saving: true, error: null }));
      try {
        const res = await window.api.providerKeysSave({ keys, clear });
        setState((prev) => ({
          ...prev,
          hasKeys: res.hasKeys,
          saving: false,
          error: res.success ? null : (res.error ?? 'Failed to save keys'),
        }));
        if (res.success) {
          // Image providers re-registered in main — refresh dependent pickers.
          window.dispatchEvent(new CustomEvent('vidtsx:image-providers-changed'));
        }
        return res.success;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: err instanceof Error ? err.message : 'Failed to save keys',
        }));
        return false;
      }
    },
    [],
  );

  return { ...state, refresh, saveKeys };
}
