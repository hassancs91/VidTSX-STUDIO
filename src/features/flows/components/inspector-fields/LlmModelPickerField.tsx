import { useEffect, useState } from 'react';
import { Select } from '@shared/components/Select';
import { TextInput } from '@shared/components/TextInput';
import type { LlmProviderConfig } from '@shared/ipc/types';

interface Props {
  label: string;
  providerId: string;
  model: string;
  onChange: (providerId: string, model: string) => void;
}

/**
 * LLM provider + model picker for Flow nodes. Mirrors the structure of
 * ModelPickerField (image) but:
 *  - sources providers from llmProvidersGet()
 *  - has no model catalog IPC, so the model is a free-text input that
 *    autofills from the provider's defaultModel when picked
 */
export function LlmModelPickerField({ label, providerId, model, onChange }: Props) {
  const [providers, setProviders] = useState<LlmProviderConfig[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api.llmProvidersGet().then((res) => {
      if (cancelled) return;
      // For Flow nodes we want providers the user has actually set up — same
      // filter shape as the image-side picker (enabled + reachable). LLM
      // providers don't have a `hasApiKey` flag, so use authMode + apiKey.
      const usable = res.providers.filter((p) => {
        if (!p.enabled) return false;
        if (p.authMode === 'subscription') return true;
        return Boolean(p.apiKey);
      });
      setProviders(usable);
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
        <div className="text-[11px] text-text-dim">
          No LLM providers configured. Add one in Settings → LLM Providers.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {label} — Provider
        </span>
        <Select
          value={providerId}
          placeholder="Select a provider"
          onChange={(nextProviderId) => {
            const provider = providers.find((p) => p.id === nextProviderId);
            // Auto-fill model with the provider's defaultModel on first pick so
            // the inspector isn't blank — user can still edit it.
            onChange(nextProviderId, provider?.defaultModel ?? '');
          }}
          options={providers.map((p) => ({ value: p.id, label: p.name }))}
        />
      </label>
      {providerId && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            {label} — Model
          </span>
          <TextInput
            value={model}
            onChange={(e) => onChange(providerId, e.target.value)}
            placeholder="e.g. claude-sonnet-4-6"
          />
        </label>
      )}
    </div>
  );
}
