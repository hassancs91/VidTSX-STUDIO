import { useState } from 'react';
import { X, Plus, RotateCcw, Settings2 } from 'lucide-react';
import { Button, Panel, StatusBadge, TextInput } from '@shared/components';
import { Select } from '@shared/components/Select';
import type { ProviderModelCatalogIpc } from '@shared/ipc/types';
import type { ProviderModelCatalogEntry } from '@shared/presets/provider-model-defaults';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';
import {
  VIDEO_DIALECT_IDS,
  VIDEO_DIALECT_LABELS,
  isVideoDialectId,
} from '@shared/presets/video-models';
import {
  DEFAULT_IMAGE_DIALECT,
  IMAGE_DIALECTS_BY_PROVIDER,
  IMAGE_DIALECT_LABELS,
  isImageDialectId,
} from '@shared/presets/image-dialects';

const PROVIDER_LABELS: Record<string, string> = {
  fal: 'Fal',
  byteplus: 'BytePlus',
  openrouter: 'OpenRouter',
  cloudflare: 'Cloudflare',
  'claude-subscription': 'Claude (Subscription)',
  'claude-api': 'Claude (API Key)',
  minimax: 'MiniMax',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  zai: 'Z.AI',
  kimi: 'Kimi (Moonshot)',
};

const CATEGORY_LABELS: Record<string, string> = {
  image: 'Image models',
  video: 'Video models',
  llm: 'Text models',
};

const LLM_ID_PLACEHOLDER: Record<string, string> = {
  openrouter: 'Model id (e.g. anthropic/claude-opus-5)',
  'claude-subscription': 'Model id (e.g. claude-opus-5)',
  'claude-api': 'Model id (e.g. claude-opus-5)',
};

/** The dialect a provider's new video entries default to. */
const DEFAULT_VIDEO_DIALECT: Record<string, string> = {
  fal: 'fal-seedance-2',
  byteplus: 'byteplus-seedance',
};

const VIDEO_ID_PLACEHOLDER: Record<string, string> = {
  fal: 'Endpoint (e.g. bytedance/seedance-2.5/text-to-video)',
  byteplus: 'ModelArk model id (e.g. dreamina-seedance-2-5-260628)',
};

/** Row line naming the dialect, for image and video entries alike. */
function dialectLabel(model: ProviderModelCatalogEntry): string | null {
  if (!('dialect' in model) || typeof model.dialect !== 'string') return null;
  if (isVideoDialectId(model.dialect)) return VIDEO_DIALECT_LABELS[model.dialect];
  if (isImageDialectId(model.dialect)) return IMAGE_DIALECT_LABELS[model.dialect];
  return model.dialect;
}

export interface ModelCatalogCardProps {
  catalog: ProviderModelCatalogIpc;
  busy: boolean;
  onSave: (models: ProviderModelCatalogEntry[]) => Promise<boolean>;
  onReset: () => Promise<boolean>;
  /** Image catalogs: opens the per-model parameters dialog (the gear on each row). */
  onParams?: (model: ImageModelCatalogEntry) => void;
  /** Image catalogs: which rows have a saved parameter override (a dot on the gear). */
  hasParams?: (modelId: string) => boolean;
}

/**
 * One editable provider×category model list: remove entries, add by model id
 * (image and video entries also name their request dialect), reset to the
 * shipped defaults. Every action saves immediately — the main process
 * re-registers providers so pickers update right away.
 */
export function ModelCatalogCard({ catalog, busy, onSave, onReset, onParams, hasParams }: ModelCatalogCardProps) {
  const isVideo = catalog.category === 'video';
  const isImage = catalog.category === 'image';
  const imageDialects = IMAGE_DIALECTS_BY_PROVIDER[catalog.providerId] ?? [];
  const dialectOptions = isVideo
    ? VIDEO_DIALECT_IDS.map((id) => ({ value: id, label: VIDEO_DIALECT_LABELS[id] }))
    : isImage
      ? imageDialects.map((id) => ({ value: id, label: IMAGE_DIALECT_LABELS[id] }))
      : [];
  const defaultDialect = isVideo
    ? (DEFAULT_VIDEO_DIALECT[catalog.providerId] ?? 'fal-generic')
    : (DEFAULT_IMAGE_DIALECT[catalog.providerId] ?? 'fal-generic');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDialect, setNewDialect] = useState<string>(defaultDialect);
  const [confirmReset, setConfirmReset] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const providerLabel = PROVIDER_LABELS[catalog.providerId] ?? catalog.providerId;
  const categoryLabel = CATEGORY_LABELS[catalog.category] ?? catalog.category;

  const handleAdd = async () => {
    const id = newId.trim();
    if (!id) return;
    if (catalog.models.some((m) => m.id === id)) {
      setRowError('That model id is already in the list');
      return;
    }
    setRowError(null);
    const entry = dialectOptions.length > 0
      ? { id, name: newName.trim() || id, dialect: newDialect }
      : { id, name: newName.trim() || id };
    const ok = await onSave([...catalog.models, entry as ProviderModelCatalogEntry]);
    if (ok) {
      setNewId('');
      setNewName('');
    }
  };

  const handleRemove = async (id: string) => {
    if (catalog.models.length <= 1) {
      setRowError('Keep at least one model — use Reset to restore defaults');
      return;
    }
    setRowError(null);
    await onSave(catalog.models.filter((m) => m.id !== id));
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    setRowError(null);
    await onReset();
  };

  return (
    <Panel>
      {/* Header */}
      <div className="p-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <div>
          <span className="text-[12px] text-text-secondary font-medium">{providerLabel}</span>
          <span className="text-[11px] text-text-dim ml-1.5">· {categoryLabel}</span>
        </div>
        <StatusBadge tone={catalog.isDefault ? 'neutral' : 'accent'}>
          {catalog.isDefault ? 'Defaults' : 'Customized'}
        </StatusBadge>
      </div>

      {/* Model rows */}
      <div>
        {catalog.models.map((model) => {
          const label = dialectLabel(model);
          const tuned = isImage && hasParams?.(model.id);
          return (
            <div
              key={model.id}
              className="px-3 py-2 flex items-center justify-between gap-2 group"
              style={{ borderBottom: '0.5px solid var(--color-border)' }}
            >
              <div className="min-w-0">
                <div className="text-[11px] text-text-secondary truncate">{model.name}</div>
                {model.name !== model.id && (
                  <div className="text-[10px] text-text-dim truncate">{model.id}</div>
                )}
                {label && <div className="text-[10px] text-text-dim truncate">{label}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isImage && onParams && (
                  <button
                    onClick={() => onParams(model as ImageModelCatalogEntry)}
                    disabled={busy}
                    className={`relative flex items-center justify-center w-[20px] h-[20px] rounded-[4px] hover:bg-app-hover transition-all ${
                      tuned ? 'text-accent-light' : 'text-text-dim opacity-0 group-hover:opacity-100 hover:text-text-secondary'
                    }`}
                    title={tuned ? `Parameters for ${model.name} (customized)` : `Parameters for ${model.name}`}
                    aria-label={`Parameters for ${model.name}`}
                    type="button"
                  >
                    <Settings2 size={12} strokeWidth={2} />
                    {tuned && <span className="absolute top-[2px] right-[2px] w-[5px] h-[5px] rounded-full bg-accent" />}
                  </button>
                )}
                <button
                  onClick={() => handleRemove(model.id)}
                  disabled={busy}
                  className="flex items-center justify-center w-[20px] h-[20px] rounded-[4px] text-text-dim opacity-0 group-hover:opacity-100 hover:text-accent-red hover:bg-app-hover transition-all"
                  title={`Remove ${model.name}`}
                  type="button"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add + reset */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TextInput
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            placeholder={
              isVideo
                ? (VIDEO_ID_PLACEHOLDER[catalog.providerId] ?? 'Model id')
                : catalog.category === 'llm'
                  ? (LLM_ID_PLACEHOLDER[catalog.providerId] ?? 'Model id, as the provider names it')
                  : catalog.providerId === 'fal'
                    ? 'Model id or endpoint (e.g. fal-ai/flux/dev)'
                    : 'Model id (e.g. google/gemini-3-pro-image)'
            }
            className="flex-1"
          />
          <TextInput
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            placeholder="Display name (optional)"
            className="w-[140px]"
          />
          <Button variant="secondary" size="sm" onClick={handleAdd} disabled={busy || !newId.trim()}>
            <span className="flex items-center gap-1"><Plus size={12} strokeWidth={2} /> Add</span>
          </Button>
        </div>
        {dialectOptions.length > 1 && (
          <div className="mb-2">
            <div className="text-[10px] text-text-dim mb-1">
              Request dialect — the API family whose request body this model speaks
              {isImage ? ' (decides which parameters its gear dialog offers)' : ''}.
            </div>
            <Select value={newDialect} onChange={setNewDialect} options={dialectOptions} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={busy || (catalog.isDefault && !confirmReset)}
            className={`flex items-center gap-1 text-[10px] transition-colors ${
              confirmReset
                ? 'text-accent-red hover:text-accent-red'
                : catalog.isDefault
                  ? 'text-text-dim opacity-50 cursor-default'
                  : 'text-text-dim hover:text-text-secondary cursor-pointer'
            }`}
            type="button"
          >
            <RotateCcw size={11} strokeWidth={2} />
            {confirmReset ? 'Click again to confirm reset' : 'Reset defaults'}
          </button>
          {rowError && <span className="text-[10px] text-accent-red">{rowError}</span>}
        </div>
      </div>
    </Panel>
  );
}
