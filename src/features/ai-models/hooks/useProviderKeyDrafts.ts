import { useCallback, useState } from 'react';
import type { LlmProviderConfig, ProviderKeyId } from '@shared/ipc/types';
import type { useLlmProviders } from '@renderer/hooks/useLlmProviders';
import type { useProviderKeys } from '@renderer/hooks/useProviderKeys';

export type ProviderKeysApi = ReturnType<typeof useProviderKeys>;
export type LlmProvidersApi = ReturnType<typeof useLlmProviders>;

export interface KeyTestState {
  testing: boolean;
  success?: boolean;
  durationMs?: number;
  error?: string;
}

/**
 * The Providers page's unsaved state, in one place: typed-but-unsaved shared
 * keys, keys marked for removal, eye toggles, per-row test results, the
 * Cloudflare account id draft, and whether an LLM row changed. One Save
 * commits the shared keys and the LLM rows together (the pre-redesign
 * contract of ApiKeysSection), then flashes "Saved".
 */
export function useProviderKeyDrafts(keys: ProviderKeysApi, llm: LlmProvidersApi) {
  const [drafts, setDrafts] = useState<Partial<Record<ProviderKeyId, string>>>({});
  const [clearing, setClearing] = useState<ProviderKeyId[]>([]);
  const [visible, setVisible] = useState<Partial<Record<ProviderKeyId, boolean>>>({});
  const [tests, setTests] = useState<Partial<Record<ProviderKeyId, KeyTestState>>>({});
  // null = untouched; the saved value renders until the user edits the field.
  const [accountIdDraft, setAccountIdDraft] = useState<string | null>(null);
  const [llmDirty, setLlmDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const accountIdDirty = accountIdDraft !== null && accountIdDraft.trim() !== keys.cloudflareAccountId;
  const keysDirty =
    clearing.length > 0 || accountIdDirty || Object.values(drafts).some((v) => !!v && v.trim().length > 0);
  const dirty = keysDirty || llmDirty;
  const saving = keys.saving || llm.saving;
  const error = keys.error || llm.saveError;

  const setDraft = useCallback((id: ProviderKeyId, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
    setClearing((prev) => prev.filter((x) => x !== id));
  }, []);

  const toggleVisible = useCallback((id: ProviderKeyId) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const markClearing = useCallback((id: ProviderKeyId) => {
    setClearing((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setDrafts((prev) => ({ ...prev, [id]: '' }));
  }, []);

  const { updateProvider, saveProviders } = llm;
  const updateLlm = useCallback(
    (id: string, updates: Partial<LlmProviderConfig>) => {
      updateProvider(id, updates);
      setLlmDirty(true);
    },
    [updateProvider],
  );

  /** Image keys prove themselves with a tiny generation; video keys by listing tasks (no spend). */
  const test = useCallback(
    async (id: ProviderKeyId, kind: 'image' | 'video') => {
      setTests((prev) => ({ ...prev, [id]: { testing: true } }));
      try {
        const apiKey = drafts[id]?.trim() || undefined;
        const result =
          kind === 'video'
            ? await window.api.videoProviderTest({ providerId: id, apiKey })
            : await window.api.imageProviderTest({
                providerId: id,
                apiKey,
                accountId: id === 'cloudflare' ? accountIdDraft?.trim() || undefined : undefined,
              });
        setTests((prev) => ({
          ...prev,
          [id]: { testing: false, success: result.success, durationMs: result.durationMs, error: result.error },
        }));
      } catch {
        setTests((prev) => ({ ...prev, [id]: { testing: false, success: false, error: 'Test request failed' } }));
      }
    },
    [drafts, accountIdDraft],
  );

  const { saveKeys } = keys;
  const save = useCallback(async () => {
    let ok = true;
    if (keysDirty) {
      ok =
        (await saveKeys(
          drafts,
          clearing.length ? clearing : undefined,
          accountIdDirty ? (accountIdDraft ?? '').trim() : undefined,
        )) && ok;
      if (ok) {
        setDrafts({});
        setClearing([]);
        setAccountIdDraft(null);
      }
    }
    if (llmDirty) {
      ok = (await saveProviders()) && ok;
      if (ok) setLlmDirty(false);
    }
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
    return ok;
  }, [keysDirty, llmDirty, drafts, clearing, accountIdDirty, accountIdDraft, saveKeys, saveProviders]);

  return {
    drafts,
    clearing,
    visible,
    tests,
    accountIdDraft,
    dirty,
    saving,
    error,
    savedFlash,
    setDraft,
    toggleVisible,
    markClearing,
    setAccountIdDraft,
    updateLlm,
    test,
    save,
  };
}

export type ProviderKeyDrafts = ReturnType<typeof useProviderKeyDrafts>;
