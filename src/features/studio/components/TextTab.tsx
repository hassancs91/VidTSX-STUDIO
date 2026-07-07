import { useState, type ReactNode } from 'react';
import type { StudioTextClip, StudioTextStyle } from '@shared/ipc/types';

// Text tab — add styled text blocks and edit the selected block's content +
// style. The block is positioned/sized on the canvas via the shared transform
// overlay (see StudioScreen), so this tab owns only content + styling.

// Curated font list. These render reliably in headless Chromium during export,
// so the preview and the final video match. Custom/Google-font loading is out
// of scope for now.
const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'System Sans', value: 'system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
];

const WEIGHT_OPTIONS = [400, 500, 600, 700, 800, 900];

interface TextTabProps {
  clips: StudioTextClip[];
  selectedClipId: string | null;
  onAddText: () => void;
  onSelectClip: (id: string | null) => void;
  onChangeText: (id: string, text: string) => void;
  onChangeStyle: (id: string, patch: Partial<StudioTextStyle>) => void;
  onDelete: (id: string) => void;
}

const fieldStyle = {
  backgroundColor: 'var(--color-app-active)',
  border: '0.5px solid var(--color-border)',
} as const;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-[8px]">
      <span className="text-text-dim text-[10px] w-[64px] shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-[6px]">{children}</div>
    </label>
  );
}

function NumberInput({
  value,
  onCommit,
  step = 1,
  suffix,
}: {
  value: number;
  onCommit: (n: number) => void;
  step?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const n = Number(raw);
    setDraft(null);
    if (Number.isFinite(n)) onCommit(n);
  };
  return (
    <div className="relative flex-1">
      <input
        type="number"
        step={step}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full h-[22px] px-[6px] rounded-[4px] text-[11px] text-text-primary outline-none"
        style={fieldStyle}
      />
      {suffix && (
        <span className="absolute right-[6px] top-1/2 -translate-y-1/2 text-text-ghost text-[9px] pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[22px] w-[28px] rounded-[4px] cursor-pointer bg-transparent"
      style={{ border: '0.5px solid var(--color-border)' }}
    />
  );
}

function StyleControls({
  clip,
  onChangeStyle,
}: {
  clip: StudioTextClip;
  onChangeStyle: (id: string, patch: Partial<StudioTextStyle>) => void;
}) {
  const s = clip.style;
  const set = (patch: Partial<StudioTextStyle>) => onChangeStyle(clip.id, patch);

  const bgEnabled = !!s.backgroundColor;
  const shadowEnabled = !!s.shadow;
  const outlineEnabled = !!s.outline && s.outline.width > 0;

  return (
    <div className="flex flex-col gap-[8px]">
      <Row label="Font">
        <select
          value={s.fontFamily}
          onChange={(e) => set({ fontFamily: e.target.value })}
          className="flex-1 h-[22px] px-[4px] rounded-[4px] text-[11px] text-text-primary outline-none"
          style={fieldStyle}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Size">
        <NumberInput value={s.fontSize} onCommit={(n) => set({ fontSize: Math.max(1, n) })} suffix="px" />
        <select
          value={s.fontWeight}
          onChange={(e) => set({ fontWeight: Number(e.target.value) })}
          className="w-[64px] h-[22px] px-[4px] rounded-[4px] text-[11px] text-text-primary outline-none"
          style={fieldStyle}
          title="Font weight"
        >
          {WEIGHT_OPTIONS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Color">
        <ColorInput value={s.color} onChange={(hex) => set({ color: hex })} />
        <button
          onClick={() => set({ italic: !s.italic })}
          className="h-[22px] px-[8px] rounded-[4px] text-[11px] italic transition-colors"
          style={{
            ...fieldStyle,
            color: s.italic ? 'var(--color-accent-light)' : 'var(--color-text-dim)',
          }}
          title="Italic"
        >
          I
        </button>
        <div className="flex items-center gap-[2px]">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              onClick={() => set({ align: a })}
              className="h-[22px] w-[24px] rounded-[4px] text-[10px] transition-colors"
              style={{
                ...fieldStyle,
                color: s.align === a ? 'var(--color-accent-light)' : 'var(--color-text-dim)',
              }}
              title={`Align ${a}`}
            >
              {a === 'left' ? '⯇' : a === 'center' ? '≡' : '⯈'}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Line / Spc">
        <NumberInput value={s.lineHeight ?? 1.2} step={0.1} onCommit={(n) => set({ lineHeight: n })} />
        <NumberInput value={s.letterSpacing ?? 0} onCommit={(n) => set({ letterSpacing: n })} suffix="px" />
      </Row>

      {/* Background */}
      <Row label="Background">
        <input
          type="checkbox"
          checked={bgEnabled}
          onChange={(e) => set({ backgroundColor: e.target.checked ? '#000000' : undefined })}
          className="w-[12px] h-[12px] accent-[var(--color-accent)]"
        />
        {bgEnabled && (
          <>
            <ColorInput value={s.backgroundColor ?? '#000000'} onChange={(hex) => set({ backgroundColor: hex })} />
            <NumberInput
              value={Math.round((s.backgroundOpacity ?? 1) * 100)}
              onCommit={(n) => set({ backgroundOpacity: Math.max(0, Math.min(1, n / 100)) })}
              suffix="%"
            />
          </>
        )}
      </Row>

      {/* Shadow */}
      <Row label="Shadow">
        <input
          type="checkbox"
          checked={shadowEnabled}
          onChange={(e) =>
            set({ shadow: e.target.checked ? { x: 0, y: 2, blur: 6, color: '#000000' } : undefined })
          }
          className="w-[12px] h-[12px] accent-[var(--color-accent)]"
        />
        {shadowEnabled && s.shadow && (
          <ColorInput value={s.shadow.color} onChange={(hex) => set({ shadow: { ...s.shadow!, color: hex } })} />
        )}
      </Row>
      {shadowEnabled && s.shadow && (
        <Row label="X / Y / Blur">
          <NumberInput value={s.shadow.x} onCommit={(n) => set({ shadow: { ...s.shadow!, x: n } })} />
          <NumberInput value={s.shadow.y} onCommit={(n) => set({ shadow: { ...s.shadow!, y: n } })} />
          <NumberInput value={s.shadow.blur} onCommit={(n) => set({ shadow: { ...s.shadow!, blur: Math.max(0, n) } })} />
        </Row>
      )}

      {/* Outline / stroke */}
      <Row label="Outline">
        <input
          type="checkbox"
          checked={outlineEnabled}
          onChange={(e) => set({ outline: e.target.checked ? { width: 2, color: '#000000' } : undefined })}
          className="w-[12px] h-[12px] accent-[var(--color-accent)]"
        />
        {outlineEnabled && s.outline && (
          <>
            <NumberInput
              value={s.outline.width}
              onCommit={(n) => set({ outline: { ...s.outline!, width: Math.max(0, n) } })}
              suffix="px"
            />
            <ColorInput value={s.outline.color} onChange={(hex) => set({ outline: { ...s.outline!, color: hex } })} />
          </>
        )}
      </Row>
    </div>
  );
}

export function TextTab({
  clips,
  selectedClipId,
  onAddText,
  onSelectClip,
  onChangeText,
  onChangeStyle,
  onDelete,
}: TextTabProps) {
  const selected = clips.find((c) => c.id === selectedClipId) ?? null;

  return (
    <div className="h-full flex flex-col overflow-y-auto p-[12px] gap-[12px]">
      <button
        onClick={onAddText}
        className="h-[30px] rounded-[6px] text-[11px] font-medium text-white transition-colors shrink-0"
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        + Add text
      </button>

      {selected ? (
        <div className="flex flex-col gap-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-text-primary text-[11px] font-medium">Edit text</span>
            <button
              onClick={() => onSelectClip(null)}
              className="text-text-dim text-[10px] hover:text-text-primary transition-colors"
            >
              Back
            </button>
          </div>

          <textarea
            value={selected.text}
            onChange={(e) => onChangeText(selected.id, e.target.value)}
            rows={3}
            placeholder="Type your text…"
            className="w-full px-[8px] py-[6px] rounded-[4px] text-[12px] text-text-primary outline-none resize-y"
            style={fieldStyle}
          />

          <StyleControls clip={selected} onChangeStyle={onChangeStyle} />

          <button
            onClick={() => onDelete(selected.id)}
            className="h-[26px] rounded-[4px] text-[10px] text-text-muted hover:text-status-error transition-colors"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            Delete text block
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-[6px]">
          {clips.length === 0 ? (
            <p className="text-text-dim text-[10px] leading-relaxed">
              No text blocks yet. Click <span className="text-text-muted">+ Add text</span> to drop a styled
              text block onto the canvas, then drag and resize it like any other layer.
            </p>
          ) : (
            clips.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectClip(c.id)}
                className="text-left px-[8px] py-[6px] rounded-[4px] text-[11px] text-text-muted truncate hover:bg-app-hover transition-colors"
                style={{ border: '0.5px solid var(--color-border)' }}
                title={c.text}
              >
                {c.text.split('\n')[0] || '(empty)'}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
