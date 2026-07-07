import { useEffect, useMemo, useState } from 'react';
import type { StudioPreset } from '@shared/ipc/types';

interface PresetsTabProps {
  presets: StudioPreset[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  onCreate: () => Promise<StudioPreset>;
  onUpdate: (id: string, patch: { name?: string; content?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  // Project binding: which library presets stack onto the current project's
  // AI flows. Null when no project is open. Presets compose, hence array.
  activePresetIds: string[] | null;
  onToggleActivePreset: ((presetId: string) => void) | null;
}

const CONTENT_PLACEHOLDER = `# Editing guidelines
Paste the rules you want Claude to follow when editing the video.

Example:
- Cut every filler word (um, uh, like, you know).
- Keep pace tight — remove silences longer than 0.7s.
- Never cut over a payoff line.
- Hook lives in the first 3 seconds.

This gets injected as guidelines into the auto-edit / TSX generation flow.`;

export function PresetsTab({
  presets,
  status,
  error,
  onCreate,
  onUpdate,
  onDelete,
  activePresetIds,
  onToggleActivePreset,
}: PresetsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // If the selected preset disappears (deleted, list reloaded), drop selection.
  useEffect(() => {
    if (selectedId && !presets.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, presets]);

  const selected = useMemo(
    () => (selectedId ? presets.find((p) => p.id === selectedId) ?? null : null),
    [selectedId, presets]
  );

  const handleCreate = async () => {
    const created = await onCreate();
    setSelectedId(created.id);
  };

  if (selected) {
    return (
      <PresetEditor
        key={selected.id}
        preset={selected}
        onUpdate={onUpdate}
        onDelete={async (id) => {
          await onDelete(id);
          setSelectedId(null);
        }}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const activeCount = activePresetIds?.length ?? 0;

  return (
    <div className="h-full flex flex-col p-[12px] gap-[8px]">
      {onToggleActivePreset && (
        <div
          className="shrink-0 flex items-center gap-[6px] rounded-[6px] px-[8px] py-[6px]"
          style={{
            backgroundColor: 'var(--color-app-base)',
            border: '0.5px solid var(--color-border)',
          }}
        >
          <span className="text-text-ghost text-[10px] uppercase tracking-wider shrink-0">
            For project
          </span>
          <span className="text-text-dim text-[11px]">
            {activeCount === 0
              ? 'None applied'
              : `${activeCount} preset${activeCount === 1 ? '' : 's'} applied`}
          </span>
          <span className="flex-1" />
          <span className="text-text-ghost text-[10px] shrink-0">Toggle below ✓</span>
        </div>
      )}

      <div className="flex items-center justify-between shrink-0">
        <span className="text-text-muted text-[10px] uppercase tracking-wider">Presets</span>
        <button
          onClick={handleCreate}
          className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] font-medium text-white transition-colors"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <svg width={10} height={10} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M6 2V10M2 6H10" />
          </svg>
          New
        </button>
      </div>

      {error && (
        <div className="text-status-error text-[10px] shrink-0">{error}</div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-[6px]">
        {status === 'loading' && presets.length === 0 ? (
          <span className="text-text-ghost text-[10px]">Loading…</span>
        ) : presets.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center gap-[6px] py-[24px] px-[8px] rounded-[6px]"
            style={{
              backgroundColor: 'var(--color-app-base)',
              border: '0.5px dashed var(--color-border)',
            }}
          >
            <span className="text-text-dim text-[11px]">No presets yet</span>
            <span className="text-text-ghost text-[10px]">
              Create one to define editing guidelines for Claude.
            </span>
          </div>
        ) : (
          presets.map((p) => (
            <PresetRow
              key={p.id}
              preset={p}
              isActive={activePresetIds?.includes(p.id) ?? false}
              onOpen={() => setSelectedId(p.id)}
              onToggleActive={onToggleActivePreset ? () => onToggleActivePreset(p.id) : null}
            />
          ))
        )}
      </div>

      <span className="text-text-ghost text-[10px] shrink-0">
        Presets are shared across projects.
      </span>
    </div>
  );
}

function PresetRow({
  preset,
  isActive,
  onOpen,
  onToggleActive,
}: {
  preset: StudioPreset;
  isActive: boolean;
  onOpen: () => void;
  onToggleActive: (() => void) | null;
}) {
  const preview = preset.content.trim().split('\n')[0]?.slice(0, 80) ?? '';
  return (
    <div
      className="flex items-stretch rounded-[6px] transition-colors hover:opacity-90"
      style={{
        backgroundColor: 'var(--color-app-base)',
        border: isActive ? '1px solid var(--color-accent)' : '0.5px solid var(--color-border)',
      }}
    >
      {onToggleActive && (
        <button
          onClick={onToggleActive}
          className="shrink-0 flex items-center justify-center w-[28px] border-r"
          style={{ borderColor: 'var(--color-border)' }}
          title={isActive ? 'Remove from this project' : 'Apply to this project'}
        >
          <span
            className="flex items-center justify-center w-[14px] h-[14px] rounded-[3px]"
            style={{
              backgroundColor: isActive ? 'var(--color-accent)' : 'transparent',
              border: isActive
                ? '1px solid var(--color-accent)'
                : '1px solid var(--color-border)',
            }}
          >
            {isActive && (
              <svg width={9} height={9} viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6L5 9L10 3" />
              </svg>
            )}
          </span>
        </button>
      )}
      <button
        onClick={onOpen}
        className="flex-1 min-w-0 text-left px-[10px] py-[8px]"
      >
        <div className="text-text-primary text-[12px] font-medium truncate">
          {preset.name || 'Untitled preset'}
        </div>
        <div className="text-text-ghost text-[10px] truncate mt-[2px]">
          {preview || 'Empty — open to add content'}
        </div>
      </button>
    </div>
  );
}

interface PresetEditorProps {
  preset: StudioPreset;
  onUpdate: (id: string, patch: { name?: string; content?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

function PresetEditor({ preset, onUpdate, onDelete, onBack }: PresetEditorProps) {
  const [name, setName] = useState(preset.name);
  const [content, setContent] = useState(preset.content);

  // Sync drafts when caller swaps to a different preset.
  useEffect(() => {
    setName(preset.name);
    setContent(preset.content);
  }, [preset.id, preset.name, preset.content]);

  const flushName = () => {
    const next = name.trim() || 'Untitled preset';
    if (next !== preset.name) {
      void onUpdate(preset.id, { name: next });
    }
  };

  const flushContent = () => {
    if (content !== preset.content) {
      void onUpdate(preset.id, { content });
    }
  };

  const handleDelete = () => {
    const ok = window.confirm(`Delete preset "${preset.name || 'Untitled preset'}"?`);
    if (!ok) return;
    void onDelete(preset.id);
  };

  return (
    <div className="h-full flex flex-col p-[12px] gap-[8px]">
      <div className="flex items-center gap-[6px] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-text-muted hover:bg-app-hover transition-colors"
          title="Back to presets"
        >
          <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3L4.5 7L8.5 11" />
          </svg>
        </button>
        <span className="text-text-muted text-[10px] uppercase tracking-wider">Edit Preset</span>
        <div className="flex-1" />
        <span className="text-text-ghost text-[10px]">{content.length} chars</span>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={flushName}
        placeholder="Preset name"
        className="shrink-0 rounded-[6px] px-[10px] h-[28px] text-[12px] text-text-primary placeholder:text-text-ghost outline-none focus:ring-1 focus:ring-accent"
        style={{
          backgroundColor: 'var(--color-app-base)',
          border: '0.5px solid var(--color-border)',
        }}
        spellCheck={false}
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={flushContent}
        placeholder={CONTENT_PLACEHOLDER}
        className="flex-1 min-h-0 resize-none rounded-[6px] px-[10px] py-[8px] text-[12px] text-text-primary placeholder:text-text-ghost outline-none focus:ring-1 focus:ring-accent font-mono leading-relaxed"
        style={{
          backgroundColor: 'var(--color-app-base)',
          border: '0.5px solid var(--color-border)',
        }}
        spellCheck={false}
      />

      <div className="flex items-center justify-between shrink-0">
        <span className="text-text-ghost text-[10px]">Saved on blur.</span>
        <button
          onClick={handleDelete}
          className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] font-medium transition-colors"
          style={{
            color: 'var(--color-status-error)',
            border: '0.5px solid var(--color-border)',
          }}
        >
          <svg width={10} height={10} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M3 3L9 9M9 3L3 9" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}
