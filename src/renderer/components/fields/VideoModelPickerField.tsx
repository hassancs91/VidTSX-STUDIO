import { useEffect, useState } from 'react';
import { Select } from '@shared/components/Select';
import type { VideoModelInfoIpc, VideoProviderInfo } from '@shared/ipc/types';

interface Props {
  label: string;
  providerId: string;
  model: string;
  onChange: (providerId: string, model: string) => void;
}

/**
 * Provider + model for video generation, read from the engine rather than a
 * hard-coded list — so a model added in AI → Providers → Model Catalogs shows
 * up here, only providers with a key do, and "Local (open source)" appears
 * once a local video model is ready.
 */
export function VideoModelPickerField({ label, providerId, model, onChange }: Props) {
  const [providers, setProviders] = useState<VideoProviderInfo[] | null>(null);
  const [models, setModels] = useState<Record<string, VideoModelInfoIpc[]>>({});
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.api.videoProvidersGet().then((res) => {
      if (cancelled) return;
      const list = res.success ? res.providers : [];
      setProviders(list);
      // Nothing chosen yet (or the chosen provider lost its key): fall back to
      // the engine's active one so the node is usable straight away.
      if (list.length > 0 && !list.some((p) => p.id === providerId)) {
        const fallback = list.find((p) => p.isActive) ?? list[0];
        onChange(fallback.id, '');
      }
    });
    return () => {
      cancelled = true;
    };
    // Runs once: re-picking on every parent render would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A catalog edit re-registers the providers in main; drop the cache so the
  // next render refetches the model list.
  useEffect(() => {
    const onChanged = () => setModels({});
    window.addEventListener('vidtsx:video-providers-changed', onChanged);
    return () => window.removeEventListener('vidtsx:video-providers-changed', onChanged);
  }, []);

  useEffect(() => {
    if (!providerId || models[providerId]) return;
    let cancelled = false;
    setLoadingModels(true);
    void window.api.videoModelsGet({ providerId }).then((res) => {
      if (cancelled) return;
      setLoadingModels(false);
      if (!res.success) return;
      setModels((prev) => ({ ...prev, [providerId]: res.models }));
      if (!res.models.some((m) => m.id === model) && res.models[0]) {
        onChange(providerId, res.models[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          No video providers configured. Add a Fal or BytePlus key in AI → Providers, or download a local
          video model in AI → Video.
        </div>
      </div>
    );
  }

  const currentModels = models[providerId] ?? [];

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {label} — Provider
        </span>
        <Select
          value={providerId}
          placeholder="Select a provider"
          onChange={(next) => onChange(next, '')}
          options={providers.map((p) => ({ value: p.id, label: p.name }))}
        />
      </label>
      {providerId && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            {label} — Model
          </span>
          <Select
            value={model}
            placeholder={loadingModels ? 'Loading…' : 'Select a model'}
            disabled={loadingModels}
            onChange={(next) => onChange(providerId, next)}
            options={currentModels.map((m) => ({
              value: m.id,
              label: m.tagline ? `${m.name} (${m.tagline})` : m.name,
            }))}
          />
        </label>
      )}
    </div>
  );
}
