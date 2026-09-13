import { useState } from 'react';
import type { StudioPresetEntry } from '@shared/types/studio-preset';
import type { StudioPresetInput } from '@shared/studio/preset';
import { PresetForm } from './PresetForm';

const KIND_LABEL: Record<StudioPresetEntry['videoKind'], string> = {
  short: 'Short',
  long: 'Long-form',
  course: 'Course',
  custom: 'Custom',
};

/**
 * Editing presets manager (V1 completion plan §2.5), the BrandsDialog shape:
 * a list, and a create/edit form with the PRESET.md editor. Presets live at
 * presets/<id>/ inside the assets root, so every mutation also refreshes the
 * surrounding Assets screen (onMutated).
 */
export function PresetsDialog({
  presets,
  brands,
  onSave,
  onDelete,
  onMutated,
  onClose,
  startNew = false,
}: {
  presets: StudioPresetEntry[];
  brands: Array<{ id: string; name: string }>;
  onSave: (input: StudioPresetInput, presetId?: string) => Promise<string | null>;
  onDelete: (presetId: string) => Promise<string | null>;
  onMutated: () => void;
  onClose: () => void;
  /** Open on the new-preset form (Studio's "Create preset…"). */
  startNew?: boolean;
}) {
  const [editing, setEditing] = useState<StudioPresetEntry | 'new' | null>(startNew ? 'new' : null);
  const [error, setError] = useState<string | null>(null);

  const save = async (input: StudioPresetInput, presetId?: string) => {
    const err = await onSave(input, presetId);
    if (!err) onMutated();
    return err;
  };

  const remove = async (preset: StudioPresetEntry) => {
    const ok = window.confirm(
      `Delete preset "${preset.name}"? Projects using it fall back to no preset; its PRESET.md and learned notes are removed.`,
    );
    if (!ok) return;
    setError(await onDelete(preset.id));
    onMutated();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        data-presets-dialog
        className="w-[560px] max-h-[85vh] overflow-y-auto p-4 rounded-md bg-app-surface flex flex-col gap-3"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-medium text-text-primary">
            {editing === 'new' ? 'New preset' : editing ? `Edit ${editing.name}` : 'Editing presets'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded text-[11px] text-text-muted hover:bg-app-hover"
          >
            Close
          </button>
        </div>

        {editing !== null ? (
          <PresetForm
            {...(editing === 'new' ? {} : { preset: editing })}
            brands={brands}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <div className="text-[11px] text-text-dim leading-snug">
              A preset is the playbook for one kind of video: the workflow the assistant follows,
              the style knobs, and the instructions it reads (PRESET.md). Pick one per project in
              the Studio; &ldquo;Learn from this video&rdquo; proposes changes to it.
            </div>
            {presets.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                onEdit={() => setEditing(preset)}
                onDelete={() => void remove(preset)}
              />
            ))}
            {error && <div className="text-[10px] text-accent-red">{error}</div>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditing('new')}
                data-preset-new
                className="px-3 py-1.5 rounded bg-accent text-white text-[11px] font-medium hover:opacity-90"
              >
                New preset
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PresetRow({
  preset,
  onEdit,
  onDelete,
}: {
  preset: StudioPresetEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const learned = preset.learned?.length ?? 0;
  return (
    <div
      className="flex items-center gap-2.5 p-2 rounded-[6px] bg-app-base"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-preset-row={preset.id}
    >
      <span
        className="text-[8px] font-bold uppercase tracking-wide px-[5px] py-[2px] rounded-full shrink-0 bg-app-surface text-text-muted"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        {KIND_LABEL[preset.videoKind]}
        {preset.orientation ? ` · ${preset.orientation}` : ''}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text-primary truncate">{preset.name}</div>
        <div className="text-[10px] text-text-dim truncate">
          {preset.workflow.map((s) => s.id).join(' → ') || 'no workflow'}
          {learned > 0 ? ` · learned from ${learned} video${learned === 1 ? '' : 's'}` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="px-2 py-1 rounded text-[10px] text-text-muted hover:bg-app-hover shrink-0"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="px-2 py-1 rounded text-[10px] text-accent-red hover:bg-app-hover shrink-0"
      >
        Delete
      </button>
    </div>
  );
}
