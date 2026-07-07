import { useState } from 'react';
import { Button } from '@shared/components';
import { usePromptPresets } from '../hooks/usePromptPresets';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:2'] as const;

const RemoveIcon = () => (
  <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3L11 11M11 3L3 11" />
  </svg>
);

interface PresetRowProps<T extends { id: string }> {
  item: T;
  onUpdate: (id: string, updates: Partial<T>) => void;
  onRemove: (id: string) => void;
  renderExtraFields: (id: string, item: T, onUpdate: (id: string, updates: Partial<T>) => void) => React.ReactNode;
  canRemove: boolean;
}

function PresetRow<T extends { id: string }>({
  item,
  onUpdate,
  onRemove,
  renderExtraFields,
  canRemove,
}: PresetRowProps<T>) {
  return (
    <div className="flex gap-2 p-2 rounded border border-border bg-app-base/50 hover:border-border-hover transition-colors">
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <input
          type="text"
          className="w-full bg-transparent border-b border-border pb-1 text-[12px] text-text-primary outline-none focus:border-accent placeholder:text-text-dim"
          placeholder="Label"
          value={item.label}
          onChange={(e) => onUpdate(item.id, { label: e.target.value })}
        />
        {renderExtraFields(item.id, item, onUpdate)}
        <textarea
          className="w-full min-h-[48px] bg-transparent text-[11px] text-text-secondary outline-none focus:text-text-primary resize-none placeholder:text-text-dim"
          placeholder="Prompt suffix (e.g. 'zombie style, horror aesthetic')"
          value={item.promptSuffix}
          onChange={(e) => onUpdate(item.id, { promptSuffix: e.target.value })}
        />
      </div>
      {canRemove && (
        <button
          type="button"
          className="mt-1 w-[20px] h-[20px] rounded text-text-dim hover:text-accent-red flex items-center justify-center shrink-0"
          onClick={() => onRemove(item.id)}
          title="Remove"
        >
          <RemoveIcon />
        </button>
      )}
    </div>
  );
}

export function ContentPresetSettings() {
  const {
    contentPresets,
    loading,
    saving,
    saveError,
    updateContentPreset,
    addContentPreset,
    removeContentPreset,
    save,
    reset,
  } = usePromptPresets();

  const [savedMsg, setSavedMsg] = useState(false);

  const handleSave = async () => {
    const ok = await save();
    if (ok) {
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="py-3 text-[12px] text-text-dim">Loading presets...</div>
    );
  }

  return (
    <div className="py-3">
      {saveError && (
        <div className="mb-3 text-[11px] text-accent-red bg-accent-red/10 rounded px-2 py-1.5">
          {saveError}
        </div>
      )}

      {savedMsg && (
        <div className="mb-3 text-[11px] text-accent-green bg-accent-green/10 rounded px-2 py-1.5">
          Presets saved successfully.
        </div>
      )}

      <div className="flex items-center justify-end mb-2 gap-1.5">
        <Button variant="secondary" size="xs" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="ghost" size="xs" onClick={reset} disabled={saving}>
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {contentPresets.map((preset) => (
          <PresetRow
            key={preset.id}
            item={preset}
            onUpdate={updateContentPreset}
            onRemove={removeContentPreset}
            canRemove={preset.id.startsWith('custom-')}
            renderExtraFields={(id, item) => (
              <div className="flex gap-1 flex-wrap">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      (item as unknown as { aspectRatio: string }).aspectRatio === ratio
                        ? 'bg-accent/20 text-accent-light border border-accent'
                        : 'text-text-dim border border-transparent hover:text-text-muted'
                    }`}
                    onClick={() => updateContentPreset(id, { aspectRatio: ratio } as unknown as Partial<typeof item>)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            )}
          />
        ))}
        <button
          type="button"
          className="text-[11px] text-text-dim hover:text-accent-light py-1 text-left"
          onClick={addContentPreset}
        >
          + Add Content Preset
        </button>
      </div>
    </div>
  );
}

export function StylePresetSettings() {
  const {
    stylePresets,
    loading,
    saving,
    updateStylePreset,
    addStylePreset,
    removeStylePreset,
  } = usePromptPresets();

  if (loading) {
    return (
      <div className="py-3 text-[12px] text-text-dim">Loading presets...</div>
    );
  }

  return (
    <div className="py-3">
      <div className="flex flex-col gap-1.5">
        {stylePresets.map((preset) => (
          <PresetRow
            key={preset.id}
            item={preset}
            onUpdate={updateStylePreset}
            onRemove={removeStylePreset}
            canRemove={preset.id.startsWith('custom-')}
            renderExtraFields={() => null}
          />
        ))}
        <button
          type="button"
          className="text-[11px] text-text-dim hover:text-accent-light py-1 text-left"
          onClick={addStylePreset}
        >
          + Add Style Preset
        </button>
      </div>
    </div>
  );
}
