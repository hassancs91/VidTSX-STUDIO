import { useEffect, useState } from 'react';
import { Select } from '@shared/components/Select';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { FlowModelMode } from '@shared/types/flows';
import { filterUsableLlmProviders } from '@shared/services/llm-provider-filter';
import { ModelSelect } from '../ModelSelect';
import { useModelPicker } from '../../hooks/useModelPicker';

interface Props {
  label: string;
  providerId: string;
  model: string;
  onChange: (providerId: string, model: string) => void;
  /** Decision 12 (flows plan): how the binding is honoured at run time. */
  modelMode?: FlowModelMode;
  onModeChange?: (mode: FlowModelMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: { value: FlowModelMode; label: string }[] = [
  { value: 'default', label: 'App default (ignore the binding)' },
  { value: 'preferred', label: 'Preferred (fall back to the default)' },
  { value: 'required', label: 'Required (refuse to run without it)' },
];

/**
 * LLM provider + model for a flow node (W1 catalog, flows plan §0.1 item
 * 10): the provider list, the shared `ModelSelect` over `useModelPicker`
 * (the editable catalog with "Custom…" as the free-text escape hatch), and
 * the binding mode beside it.
 */
export function LlmModelPickerField({ label, providerId, model, onChange, modelMode, onModeChange, disabled }: Props) {
  const [providers, setProviders] = useState<LlmProviderConfig[] | null>(null);
  const picker = useModelPicker(providerId);

  useEffect(() => {
    let cancelled = false;
    void window.api.llmProvidersGet().then((res) => {
      if (cancelled) return;
      setProviders(filterUsableLlmProviders(res.providers));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (providers === null) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
        <div className="text-[11px] text-text-dim">Loading providers…</div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
        <div className="text-[11px] text-text-dim">No LLM providers configured. Add one in AI → Providers.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-llm-model-picker>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label} — Provider</span>
        <Select
          value={providerId}
          placeholder="Select a provider"
          disabled={disabled}
          onChange={(nextProviderId) => onChange(nextProviderId, '')}
          options={providers.map((p) => ({ value: p.id, label: p.name }))}
        />
      </label>
      {providerId && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">{label} — Model</span>
          <ModelSelect
            models={picker.models}
            defaultModel={picker.defaultModel}
            value={model}
            disabled={disabled}
            onChange={(next) => onChange(providerId, next)}
          />
        </div>
      )}
      {onModeChange && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Binding</span>
          <Select
            value={modelMode ?? 'default'}
            disabled={disabled}
            onChange={(next) => onModeChange(next as FlowModelMode)}
            options={MODE_OPTIONS}
          />
        </label>
      )}
    </div>
  );
}
