import { useState } from 'react';
import { X, Plus, RotateCcw } from 'lucide-react';
import { Button, TextInput } from '@shared/components';
import type { ProviderModelCatalogIpc } from '@shared/ipc/types';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';

const PROVIDER_LABELS: Record<string, string> = {
  fal: 'Fal',
  openrouter: 'OpenRouter',
};

const CATEGORY_LABELS: Record<string, string> = {
  image: 'Image models',
};

export interface ModelCatalogCardProps {
  catalog: ProviderModelCatalogIpc;
  busy: boolean;
  onSave: (models: ImageModelCatalogEntry[]) => Promise<boolean>;
  onReset: () => Promise<boolean>;
}

/**
 * One editable provider×category model list: remove entries, add by model id,
 * reset to the shipped defaults. Every action saves immediately — the main
 * process re-registers providers so pickers update right away.
 */
export function ModelCatalogCard({ catalog, busy, onSave, onReset }: ModelCatalogCardProps) {
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
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
    const ok = await onSave([...catalog.models, { id, name: newName.trim() || id }]);
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
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <div>
          <span className="text-[12px] text-text-secondary font-medium">{providerLabel}</span>
          <span className="text-[11px] text-text-dim ml-1.5">· {categoryLabel}</span>
        </div>
        <span
          className={`text-[9px] px-[5px] py-[1px] rounded-[4px] ${
            catalog.isDefault ? 'bg-app-hover text-text-dim' : 'bg-[#3C3489] text-[#AFA9EC]'
          }`}
        >
          {catalog.isDefault ? 'Defaults' : 'Customized'}
        </span>
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
            placeholder={catalog.providerId === 'fal' ? 'Model id or endpoint (e.g. fal-ai/flux/dev)' : 'Model id (e.g. google/gemini-3-pro-image)'}
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
    </div>
  );
}
