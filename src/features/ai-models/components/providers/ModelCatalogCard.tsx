import { useState } from 'react';
import { X, Plus, RotateCcw } from 'lucide-react';
import { Button, Panel, StatusBadge, TextInput } from '@shared/components';
import { Select } from '@shared/components/Select';
import type { ProviderModelCatalogIpc } from '@shared/ipc/types';
import type { ProviderModelCatalogEntry } from '@shared/presets/provider-model-defaults';
import {
  VIDEO_DIALECT_IDS,
  VIDEO_DIALECT_LABELS,
  type VideoDialectId,
} from '@shared/presets/video-models';

const PROVIDER_LABELS: Record<string, string> = {
  fal: 'Fal',
  byteplus: 'BytePlus',
  openrouter: 'OpenRouter',
  cloudflare: 'Cloudflare',
};

const CATEGORY_LABELS: Record<string, string> = {
  image: 'Image models',
  video: 'Video models',
};

/** The dialect a provider's new video entries default to. */
const DEFAULT_DIALECT: Record<string, VideoDialectId> = {
  fal: 'fal-seedance-2',
  byteplus: 'byteplus-seedance',
};

const VIDEO_ID_PLACEHOLDER: Record<string, string> = {
  fal: 'Endpoint (e.g. bytedance/seedance-2.5/text-to-video)',
  byteplus: 'ModelArk model id (e.g. dreamina-seedance-2-5-260628)',
};

export interface ModelCatalogCardProps {
  catalog: ProviderModelCatalogIpc;
  busy: boolean;
  onSave: (models: ProviderModelCatalogEntry[]) => Promise<boolean>;
  onReset: () => Promise<boolean>;
}

/**
 * One editable provider×category model list: remove entries, add by model id,
 * reset to the shipped defaults. Every action saves immediately — the main
 * process re-registers providers so pickers update right away.
 */
export function ModelCatalogCard({ catalog, busy, onSave, onReset }: ModelCatalogCardProps) {
  const isVideo = catalog.category === 'video';
  const defaultDialect = DEFAULT_DIALECT[catalog.providerId] ?? 'fal-generic';
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDialect, setNewDialect] = useState<VideoDialectId>(defaultDialect);
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
    const entry = isVideo
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
        {catalog.models.map((model) => (
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
              {'dialect' in model && (
                <div className="text-[10px] text-text-dim truncate">
                  {VIDEO_DIALECT_LABELS[model.dialect] ?? model.dialect}
                </div>
              )}
            </div>
            <button
              onClick={() => handleRemove(model.id)}
              disabled={busy}
              className="flex items-center justify-center w-[20px] h-[20px] rounded-[4px] text-text-dim opacity-0 group-hover:opacity-100 hover:text-accent-red hover:bg-app-hover transition-all shrink-0"
              title={`Remove ${model.name}`}
              type="button"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        ))}
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
        {isVideo && (
          <div className="mb-2">
            <div className="text-[10px] text-text-dim mb-1">
              Request dialect — the API family whose request body this model speaks.
            </div>
            <Select
              value={newDialect}
              onChange={(next) => setNewDialect(next as VideoDialectId)}
              options={VIDEO_DIALECT_IDS.map((id) => ({
                value: id,
                label: VIDEO_DIALECT_LABELS[id],
              }))}
            />
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
