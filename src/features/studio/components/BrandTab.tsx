import { useEffect, useMemo, useState } from 'react';
import type { StudioBrand } from '@shared/ipc/types';

interface BrandTabProps {
  brands: StudioBrand[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  onCreate: () => Promise<StudioBrand>;
  onUpdate: (id: string, patch: { name?: string; content?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  // Project binding: which library brand applies to the current project.
  // Null when no project is open; undefined when project is open but no brand picked.
  activeBrandId: string | null | undefined;
  onSelectActiveBrand: ((brandId: string | undefined) => void) | null;
}

const CONTENT_PLACEHOLDER = `# Brand
Paste your brand markdown here.

Example:
- **Channel**: Learn With Hasan
- **Voice**: educational, direct, hype on payoffs
- **Primary color**: #6366f1
- **Aesthetic**: minimalist with punchy reveals
- **SFX style**: subtle

This is read by auto-cut and downstream AI features.`;

export function BrandTab({
  brands,
  status,
  error,
  onCreate,
  onUpdate,
  onDelete,
  activeBrandId,
  onSelectActiveBrand,
}: BrandTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // If the selected brand disappears (deleted, list reloaded), drop selection.
  useEffect(() => {
    if (selectedId && !brands.some((b) => b.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, brands]);

  const selected = useMemo(
    () => (selectedId ? brands.find((b) => b.id === selectedId) ?? null : null),
    [selectedId, brands]
  );

  const handleCreate = async () => {
    const created = await onCreate();
    setSelectedId(created.id);
  };

  if (selected) {
    return (
      <BrandEditor
        key={selected.id}
        brand={selected}
        onUpdate={onUpdate}
        onDelete={async (id) => {
          await onDelete(id);
          setSelectedId(null);
        }}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  // Resolve the currently-active brand for the "Active for this project" strip.
  // Falls back to "(none)" when a project is open but no brand is selected.
  const activeBrand = activeBrandId ? brands.find((b) => b.id === activeBrandId) ?? null : null;

  return (
    <div className="h-full flex flex-col p-[12px] gap-[8px]">
      {onSelectActiveBrand && (
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
          <select
            value={activeBrandId ?? ''}
            onChange={(e) => onSelectActiveBrand(e.target.value || undefined)}
            className="flex-1 min-w-0 bg-transparent text-text-primary text-[11px] outline-none"
          >
            <option value="">— None —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || 'Untitled brand'}
              </option>
            ))}
          </select>
          {activeBrand && (
            <span className="text-text-ghost text-[10px] shrink-0">·  applied</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between shrink-0">
        <span className="text-text-muted text-[10px] uppercase tracking-wider">Brands</span>
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
        {status === 'loading' && brands.length === 0 ? (
          <span className="text-text-ghost text-[10px]">Loading…</span>
        ) : brands.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center gap-[6px] py-[24px] px-[8px] rounded-[6px]"
            style={{
              backgroundColor: 'var(--color-app-base)',
              border: '0.5px dashed var(--color-border)',
            }}
          >
            <span className="text-text-dim text-[11px]">No brands yet</span>
            <span className="text-text-ghost text-[10px]">
              Create one to define a reusable brand voice for auto-edit.
            </span>
          </div>
        ) : (
          brands.map((b) => (
            <BrandRow
              key={b.id}
              brand={b}
              isActive={b.id === activeBrandId}
              onOpen={() => setSelectedId(b.id)}
            />
          ))
        )}
      </div>

      <span className="text-text-ghost text-[10px] shrink-0">
        Brands are shared across projects.
      </span>
    </div>
  );
}

function BrandRow({
  brand,
  isActive,
  onOpen,
}: {
  brand: StudioBrand;
  isActive: boolean;
  onOpen: () => void;
}) {
  const preview = brand.content.trim().split('\n')[0]?.slice(0, 80) ?? '';
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-[6px] px-[10px] py-[8px] transition-colors hover:opacity-90"
      style={{
        backgroundColor: 'var(--color-app-base)',
        border: isActive ? '1px solid var(--color-accent)' : '0.5px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-[6px]">
        <div className="text-text-primary text-[12px] font-medium truncate flex-1 min-w-0">
          {brand.name || 'Untitled brand'}
        </div>
        {isActive && (
          <span
            className="shrink-0 text-[9px] font-semibold uppercase tracking-wider px-[6px] py-[1px] rounded-[3px]"
            style={{
              color: 'var(--color-accent-light)',
              backgroundColor: 'var(--color-accent-bg, rgba(99,102,241,0.15))',
            }}
          >
            Active
          </span>
        )}
      </div>
      <div className="text-text-ghost text-[10px] truncate mt-[2px]">
        {preview || 'Empty — open to add content'}
      </div>
    </button>
  );
}

interface BrandEditorProps {
  brand: StudioBrand;
  onUpdate: (id: string, patch: { name?: string; content?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

function BrandEditor({ brand, onUpdate, onDelete, onBack }: BrandEditorProps) {
  const [name, setName] = useState(brand.name);
  const [content, setContent] = useState(brand.content);

  // Sync drafts when caller swaps to a different brand.
  useEffect(() => {
    setName(brand.name);
    setContent(brand.content);
  }, [brand.id, brand.name, brand.content]);

  const flushName = () => {
    const next = name.trim() || 'Untitled brand';
    if (next !== brand.name) {
      void onUpdate(brand.id, { name: next });
    }
  };

  const flushContent = () => {
    if (content !== brand.content) {
      void onUpdate(brand.id, { content });
    }
  };

  const handleDelete = () => {
    const ok = window.confirm(`Delete brand "${brand.name || 'Untitled brand'}"?`);
    if (!ok) return;
    void onDelete(brand.id);
  };

  return (
    <div className="h-full flex flex-col p-[12px] gap-[8px]">
      <div className="flex items-center gap-[6px] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-text-muted hover:bg-app-hover transition-colors"
          title="Back to brands"
        >
          <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3L4.5 7L8.5 11" />
          </svg>
        </button>
        <span className="text-text-muted text-[10px] uppercase tracking-wider">Edit Brand</span>
        <div className="flex-1" />
        <span className="text-text-ghost text-[10px]">{content.length} chars</span>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={flushName}
        placeholder="Brand name"
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
