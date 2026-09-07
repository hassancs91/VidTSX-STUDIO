import { useCallback, useEffect, useState } from 'react';
import type { ProviderKeyId } from '@shared/ipc/types';
import { PROVIDER_KEY_IDS } from '@shared/providers/registry';

export interface ProviderKeysState {
  hasKeys: Record<ProviderKeyId, boolean>;
  /** Cloudflare account id — plain (non-secret) companion to the cloudflare token. */
  cloudflareAccountId: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const INITIAL: ProviderKeysState = {
  // One entry per registry provider; the type is keyed by ProviderKeyId, so a
  // new provider is a compile error here until it is listed.
  hasKeys: Object.fromEntries(PROVIDER_KEY_IDS.map((id) => [id, false])) as Record<
    ProviderKeyId,
    boolean
  >,
  cloudflareAccountId: '',
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
        cloudflareAccountId: res.cloudflareAccountId ?? '',
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
    async (
      keys: Partial<Record<ProviderKeyId, string>>,
      clear?: ProviderKeyId[],
      cloudflareAccountId?: string,
    ) => {
      setState((prev) => ({ ...prev, saving: true, error: null }));
      try {
        const res = await window.api.providerKeysSave({ keys, clear, cloudflareAccountId });
        setState((prev) => ({
          ...prev,
          hasKeys: res.hasKeys,
          cloudflareAccountId: res.cloudflareAccountId ?? prev.cloudflareAccountId,
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
