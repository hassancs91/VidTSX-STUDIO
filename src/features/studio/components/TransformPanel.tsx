import { useState } from 'react';
import type { LayerTransform } from '@shared/ipc/types';

// (NumberField keeps its own local draft state; the panel itself is otherwise
// controlled by the parent so the aspect lock is shared with the drag handles.)

// Floating numeric editor for the selected layer's transform. Pairs with
// TransformOverlay (drag handles): both write the same transform data, so
// edits here move the on-canvas box and vice-versa.

interface TransformPanelProps {
  transform: LayerTransform;
  compWidth: number;
  compHeight: number;
  label: string;
  // True once the layer carries an explicit transform (vs. the full-frame
  // default) — gates the Reset affordance.
  isModified: boolean;
  // Shared with the on-canvas drag handles so toggling it here also constrains
  // corner-resize dragging.
  lockAspect: boolean;
  onLockAspectChange: (locked: boolean) => void;
  onChange: (t: LayerTransform) => void;
  onReset: () => void;
}

function NumberField({
  label,
  value,
  onCommit,
  suffix,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  suffix?: string;
}) {
  // Local string state so the user can type freely (incl. "-") before commit.
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? String(Math.round(value));

  const commit = (raw: string) => {
    const n = Number(raw);
    setDraft(null);
    if (Number.isFinite(n)) onCommit(n);
  };

  return (
    <label className="flex items-center gap-[6px]">
      <span className="text-text-dim text-[10px] w-[14px]">{label}</span>
      <div className="relative flex-1">
        <input
          type="number"
          value={display}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-full h-[22px] px-[6px] rounded-[4px] text-[11px] text-text-primary outline-none"
          style={{
            backgroundColor: 'var(--color-app-active)',
            border: '0.5px solid var(--color-border)',
          }}
        />
        {suffix && (
          <span className="absolute right-[6px] top-1/2 -translate-y-1/2 text-text-ghost text-[9px] pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

export function TransformPanel({
  transform,
  compWidth,
  compHeight,
  label,
  isModified,
  lockAspect,
  onLockAspectChange,
  onChange,
  onReset,
}: TransformPanelProps) {
  const aspect = transform.height > 0 ? transform.width / transform.height : 1;

  const setWidth = (w: number) => {
    const width = Math.max(1, w);
    if (lockAspect && aspect > 0) {
      onChange({ ...transform, width, height: Math.max(1, Math.round(width / aspect)) });
    } else {
      onChange({ ...transform, width });
    }
  };

  const setHeight = (h: number) => {
    const height = Math.max(1, h);
    if (lockAspect && aspect > 0) {
      onChange({ ...transform, height, width: Math.max(1, Math.round(height * aspect)) });
    } else {
      onChange({ ...transform, height });
    }
  };

  const center = () => {
    onChange({
      ...transform,
      x: Math.round((compWidth - transform.width) / 2),
      y: Math.round((compHeight - transform.height) / 2),
    });
  };

  return (
    <div
      className="absolute top-[8px] left-[8px] z-30 rounded-[8px] p-[10px] flex flex-col gap-[8px] w-[176px]"
      style={{
        backgroundColor: 'rgba(20,20,28,0.92)',
        border: '0.5px solid var(--color-border)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-text-primary text-[11px] font-medium">
          Transform
        </span>
        <span className="text-text-ghost text-[9px]">{label}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-[8px] gap-y-[6px]">
        <NumberField label="X" value={transform.x} onCommit={(n) => onChange({ ...transform, x: n })} />
        <NumberField label="Y" value={transform.y} onCommit={(n) => onChange({ ...transform, y: n })} />
        <NumberField label="W" value={transform.width} onCommit={setWidth} />
        <NumberField label="H" value={transform.height} onCommit={setHeight} />
      </div>

      <NumberField
        label="∠"
        value={transform.rotation ?? 0}
        onCommit={(n) => onChange({ ...transform, rotation: n })}
        suffix="°"
      />

      <label className="flex items-center gap-[6px] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={lockAspect}
          onChange={(e) => onLockAspectChange(e.target.checked)}
          className="w-[12px] h-[12px] accent-[var(--color-accent)]"
        />
        <span className="text-text-dim text-[10px]">Lock aspect ratio</span>
      </label>

      <div className="flex items-center gap-[6px]">
        <button
          onClick={center}
          className="flex-1 h-[24px] rounded-[4px] text-[10px] font-medium text-text-muted transition-colors hover:bg-app-hover"
          style={{ backgroundColor: 'var(--color-app-active)' }}
        >
          Center
        </button>
        <button
          onClick={onReset}
          disabled={!isModified}
          className="flex-1 h-[24px] rounded-[4px] text-[10px] font-medium text-text-muted transition-colors hover:bg-app-hover disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-app-active)' }}
          title="Reset to full frame"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
