// Input primitives for the Inspector's Clip section. All of them commit on
// release/blur — never per pixel or per keystroke — so every committed change
// is exactly one reducer dispatch, i.e. one undo step.

import { useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { TextInput } from '@shared/components/TextInput';

/** Volume slider (0–200% ↦ gain 0–2) with a mute toggle. */
export function VolumeControl({
  gain,
  mixed,
  muted,
  onCommit,
  onToggleMute,
}: {
  gain: number;
  /** Multi-selection with differing gains — show "mixed" until dragged. */
  mixed: boolean;
  muted: boolean;
  onCommit: (gain: number) => void;
  onToggleMute: () => void;
}) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const percent = dragValue ?? Math.round(gain * 100);
  const commit = () => {
    if (dragValue === null) return;
    onCommit(dragValue / 100);
    setDragValue(null);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-dim">
          Volume · {mixed && dragValue === null ? 'mixed' : `${percent}%`}
        </span>
        <button
          onClick={onToggleMute}
          title={muted ? 'Unmute' : 'Mute'}
          className={`flex items-center justify-center w-[22px] h-[22px] rounded-[5px] transition-colors ${
            muted ? 'bg-app-active text-text-primary' : 'text-text-muted hover:bg-app-hover'
          }`}
        >
          {muted ? (
            <VolumeX size={12} strokeWidth={1.75} />
          ) : (
            <Volume2 size={12} strokeWidth={1.75} />
          )}
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        value={percent}
        onChange={(e) => setDragValue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-accent cursor-pointer"
        style={{ height: 18 }}
      />
    </div>
  );
}

/** Labelled slider showing its live value ("Opacity · 80%"). */
export function SliderField({
  label,
  value,
  min,
  max,
  unit,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onCommit: (value: number) => void;
}) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = dragValue ?? value;
  const commit = () => {
    if (dragValue === null) return;
    onCommit(dragValue);
    setDragValue(null);
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-text-dim">
        {label} · {shown}
        {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={shown}
        onChange={(e) => setDragValue(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-accent cursor-pointer"
        style={{ height: 18 }}
      />
    </div>
  );
}

/** Numeric input that commits a parsed, clamped value on Enter/blur and
 *  reverts on Escape. Shows the document value while idle, the draft while
 *  focused. */
export function NumberField({
  value,
  min,
  max,
  suffix,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const escaped = useRef(false);
  const commit = () => {
    setEditing(false);
    if (escaped.current) {
      escaped.current = false;
      return;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(max, Math.max(min, parsed));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <div className="relative">
      <TextInput
        value={editing ? text : String(value)}
        onFocus={() => {
          setText(String(value));
          setEditing(true);
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            escaped.current = true;
            e.currentTarget.blur();
          }
        }}
        className="w-full pr-5"
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-ghost pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
  asDiv,
}: {
  label: string;
  children: React.ReactNode;
  /** Fields holding buttons must not be <label> — a label click would forward
   *  to (activate) its first button. */
  asDiv?: boolean;
}) {
  const Tag = asDiv ? 'div' : 'label';
  return (
    <Tag className="flex flex-col gap-1">
      <span className="text-[10px] text-text-dim">{label}</span>
      {children}
    </Tag>
  );
}

export function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-[26px] flex items-center px-2 rounded-[6px] bg-app-base text-[11px] text-text-secondary truncate"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      {children}
    </div>
  );
}
