// The generic knobs of one filter entry (docs/studio/FILTER_PACKS_DESIGN.md
// "UI" → Inspector): the manifest's `parameters` drawn as sliders and colour
// wells — authors never write UI. Every control live-previews while it moves
// (`onLive`, an ephemeral override) and commits once on release (`onCommit`,
// one undo step), the Inspector's contract.

import { useState } from 'react';
import type { FilterParameter } from '../types';

export interface ControlHandlers {
  onLive: (key: string, value: number | string) => void;
  onCommit: (key: string, value: number | string) => void;
}

interface Props extends ControlHandlers {
  parameters: readonly FilterParameter[];
  /** Resolved values (the document's over the defaults). */
  values: Readonly<Record<string, number | string>>;
}

export function EffectControls({ parameters, values, onLive, onCommit }: Props) {
  if (parameters.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" data-effect-controls>
      {parameters.map((spec) =>
        spec.type === 'range' ? (
          <RangeControl
            key={spec.key}
            label={spec.label}
            value={typeof values[spec.key] === 'number' ? (values[spec.key] as number) : spec.default}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            {...(spec.unit ? { unit: spec.unit } : {})}
            onLive={(v) => onLive(spec.key, v)}
            onCommit={(v) => onCommit(spec.key, v)}
            testId={spec.key}
          />
        ) : (
          <ColorControl
            key={spec.key}
            label={spec.label}
            value={typeof values[spec.key] === 'string' ? (values[spec.key] as string) : spec.default}
            onLive={(v) => onLive(spec.key, v)}
            onCommit={(v) => onCommit(spec.key, v)}
            testId={spec.key}
          />
        ),
      )}
    </div>
  );
}

/** Decimals a step needs, so 0.05 shows as 0.05 and 1 as 1. */
function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : Math.min(4, text.length - dot - 1);
}

/** A labelled slider with a live value: moves preview, release commits. */
export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onLive,
  onCommit,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onLive: (value: number) => void;
  onCommit: (value: number) => void;
  testId?: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;
  const commit = () => {
    if (drag === null) return;
    onCommit(drag);
    setDrag(null);
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-text-dim">
        {label} · {shown.toFixed(decimalsOf(step))}
        {unit ?? ''}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => {
          const next = Number(e.target.value);
          setDrag(next);
          onLive(next);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-accent cursor-pointer"
        style={{ height: 18 }}
        {...(testId ? { 'data-effect-param': testId } : {})}
      />
    </div>
  );
}

/** A colour well: the native picker previews while open and commits on close. */
function ColorControl({
  label,
  value,
  onLive,
  onCommit,
  testId,
}: {
  label: string;
  value: string;
  onLive: (value: string) => void;
  onCommit: (value: string) => void;
  testId?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-text-dim">{label}</span>
      <input
        type="color"
        value={value}
        onInput={(e) => onLive((e.target as HTMLInputElement).value)}
        onChange={(e) => onCommit(e.target.value)}
        className="w-[36px] h-[20px] rounded-[4px] bg-app-base cursor-pointer"
        style={{ border: '0.5px solid var(--color-border)' }}
        {...(testId ? { 'data-effect-param': testId } : {})}
      />
    </label>
  );
}
