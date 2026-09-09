import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LlmProviderConfig, ProviderModelCatalogIpc } from '../../shared/ipc/types';
import type { LlmModelCatalogEntry } from '../../shared/presets/llm-models';
import { findDefaultLlmModel, getDefaultLlmModels } from '../../shared/presets/llm-models';

export interface ModelPickerState {
  /** The provider the list belongs to — `providerId`, or the app's active
   *  provider when the caller passes '' ("app default"). */
  providerId: string;
  /** That provider's own default model (what '' selects). */
  defaultModel: string | undefined;
  /** The effective llm catalog: user overrides merged over shipped defaults. */
  models: LlmModelCatalogEntry[];
  loading: boolean;
}

/**
 * The model list for one LLM provider, beside `useProviderPicker`. Reads the
 * editable catalogs (AI page → Model Catalogs, category 'llm') and re-reads on
 * the catalog and provider change events. Stored rows are `{id, name}` only,
 * so tier / thinking flags are restored from the shipped entry by id.
 */
export function useModelPicker(providerId: string | undefined): ModelPickerState {
  const [catalogs, setCatalogs] = useState<ProviderModelCatalogIpc[] | null>(null);
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const loadCatalogs = useCallback(async () => {
    try {
      const res = await window.api.providerModelsGet();
      setCatalogs(res.success ? res.catalogs : []);
    } catch {
      setCatalogs([]);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const res = await window.api.llmProvidersGet();
      setProviders(res.providers);
      setActiveProvider(res.activeProvider);
    } catch {
      // The picker degrades to the shipped catalog for the given id.
    }
  }, []);

  useEffect(() => {
    void loadCatalogs();
    void loadProviders();
    window.addEventListener('vidtsx:llm-models-changed', loadCatalogs);
    window.addEventListener('vidtsx:llm-providers-changed', loadProviders);
    return () => {
      window.removeEventListener('vidtsx:llm-models-changed', loadCatalogs);
      window.removeEventListener('vidtsx:llm-providers-changed', loadProviders);
    };
  }, [loadCatalogs, loadProviders]);

  const resolvedId = providerId || activeProvider || '';

  const models = useMemo(() => {
    if (!resolvedId) return [];
    const stored = catalogs?.find((c) => c.providerId === resolvedId && c.category === 'llm');
    if (!stored) return getDefaultLlmModels(resolvedId);
    return stored.models.map((m) => ({ ...findDefaultLlmModel(resolvedId, m.id), id: m.id, name: m.name }));
  }, [catalogs, resolvedId]);

  const defaultModel = providers.find((p) => p.id === resolvedId)?.defaultModel;

  return { providerId: resolvedId, defaultModel, models, loading: catalogs === null };
}
