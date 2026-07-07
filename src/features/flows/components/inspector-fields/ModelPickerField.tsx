import { useEffect, useState } from 'react';
import { Select } from '@shared/components/Select';
import type {
  ImageProviderInfo,
  ImageModelInfoIpc,
} from '@shared/ipc/types';

interface Props {
  label: string;
  providerId: string;
  model: string;
  onChange: (providerId: string, model: string) => void;
}

interface ModelsByProvider {
  [providerId: string]: ImageModelInfoIpc[];
}

export function ModelPickerField({ label, providerId, model, onChange }: Props) {
  const [providers, setProviders] = useState<ImageProviderInfo[] | null>(null);
  const [models, setModels] = useState<ModelsByProvider>({});
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.api.imageProvidersGet().then((res) => {
      if (cancelled) return;
      if (res.success && res.providers) {
        setProviders(res.providers.filter((p) => p.enabled && p.hasApiKey));
      } else {
        setProviders([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providerId) return;
    if (models[providerId]) return;
    let cancelled = false;
    setLoadingModels(true);
    void window.api.imageModelsGet({ providerId }).then((res) => {
      if (cancelled) return;
      setLoadingModels(false);
      if (res.success && res.models) {
        setModels((prev) => ({ ...prev, [providerId]: res.models }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [providerId, models]);

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
          No image providers configured. Add one in Settings → Image Providers.
        </div>
      </div>
    );
  }

  const currentModels = models[providerId] ?? [];

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label} — Provider</span>
        <Select
          value={providerId}
          placeholder="Select a provider"
          onChange={(nextProviderId) => {
            const provider = providers.find((p) => p.id === nextProviderId);
            onChange(nextProviderId, provider?.defaultModel ?? '');
          }}
          options={providers.map((p) => ({ value: p.id, label: p.name }))}
        />
      </label>
      {providerId && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">{label} — Model</span>
          <Select
            value={model}
            placeholder={loadingModels ? 'Loading…' : 'Select a model'}
            disabled={loadingModels}
            onChange={(next) => onChange(providerId, next)}
            options={currentModels.map((m) => ({
              value: m.id,
              label: m.credits ? `${m.name} · ${m.credits} cr` : m.name,
            }))}
          />
        </label>
      )}
    </div>
  );
}
