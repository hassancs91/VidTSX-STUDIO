import type { StudioEffect, StudioEffectType, StudioVideoClip } from '@shared/ipc/types';
import {
  EFFECT_DEFINITIONS,
  findEffect,
  toggleEffect,
  updateEffectParam,
  type EffectParamControl,
} from '../services/effects';

// Effects tab — add/remove and tune per-clip visual effects on the currently
// selected video clip. Effects render in the shared StudioComposition, so what
// you tune here previews live and exports identically. v1 is Video-track only.

interface EffectsTabProps {
  // The selected Video-track clip, or null when nothing (or a non-video clip)
  // is selected.
  clip: StudioVideoClip | null;
  // Whether the project has any video clips at all — drives the empty-state copy
  // ("add a clip" vs "select a clip").
  hasVideoClips: boolean;
  // Replace the clip's effect stack. Undefined/empty clears all effects.
  onChange: (clipId: string, effects: StudioEffect[] | undefined) => void;
}

const fieldStyle = {
  backgroundColor: 'var(--color-app-active)',
  border: '0.5px solid var(--color-border)',
} as const;

function Slider({
  control,
  value,
  onChange,
}: {
  control: EffectParamControl;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-[8px]">
      <span className="text-text-dim text-[10px] w-[58px] shrink-0">{control.label}</span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-[3px] accent-[var(--color-accent)] cursor-pointer"
      />
      <span className="text-text-muted text-[10px] w-[40px] shrink-0 text-right tabular-nums">
        {control.format(value)}
      </span>
    </label>
  );
}

function EffectCard({
  type,
  effect,
  onToggle,
  onParamChange,
}: {
  type: StudioEffectType;
  effect: StudioEffect | undefined;
  onToggle: () => void;
  onParamChange: (key: string, value: number) => void;
}) {
  const def = EFFECT_DEFINITIONS.find((d) => d.type === type)!;
  const enabled = !!effect;

  return (
    <div
      className="rounded-[6px] p-[10px] flex flex-col gap-[8px]"
      style={{
        border: '0.5px solid var(--color-border)',
        backgroundColor: enabled ? 'var(--color-app-active)' : 'transparent',
      }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between gap-[8px] text-left transition-colors"
      >
        <span
          className="text-[11px] font-medium"
          style={{ color: enabled ? 'var(--color-accent-light)' : 'var(--color-text-primary)' }}
        >
          {def.label}
        </span>
        {/* Toggle pill */}
        <span
          className="relative w-[28px] h-[16px] rounded-full shrink-0 transition-colors"
          style={{
            backgroundColor: enabled ? 'var(--color-accent)' : 'var(--color-app-hover)',
          }}
        >
          <span
            className="absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-all"
            style={{ left: enabled ? '14px' : '2px' }}
          />
        </span>
      </button>

      {enabled && effect ? (
        <div className="flex flex-col gap-[7px]">
          {def.params.map((p) => (
            <Slider
              key={p.key}
              control={p}
              value={(effect as unknown as Record<string, number>)[p.key]}
              onChange={(v) => onParamChange(p.key, v)}
            />
          ))}
        </div>
      ) : (
        <p className="text-text-ghost text-[10px] leading-relaxed">{def.description}</p>
      )}
    </div>
  );
}

export function EffectsTab({ clip, hasVideoClips, onChange }: EffectsTabProps) {
  if (!clip) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-[8px] p-[16px] text-center">
        <span className="text-text-dim text-[11px] font-medium">No clip selected</span>
        <span className="text-text-ghost text-[10px] leading-relaxed">
          {hasVideoClips
            ? 'Select a video clip on the timeline to add effects like fade, zoom, blur, black & white, or camera shake.'
            : 'Add a video clip to the timeline first, then select it to apply effects.'}
        </span>
      </div>
    );
  }

  const effects = clip.effects;
  const anyEnabled = !!effects && effects.length > 0;

  return (
    <div className="h-full flex flex-col overflow-y-auto p-[12px] gap-[10px]">
      <div className="flex items-center justify-between gap-[8px]">
        <span className="text-text-primary text-[11px] font-medium truncate" title={clip.fileName}>
          Effects · {clip.fileName}
        </span>
        {anyEnabled && (
          <button
            onClick={() => onChange(clip.id, undefined)}
            className="text-text-dim text-[10px] hover:text-status-error transition-colors shrink-0"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col gap-[8px]">
        {EFFECT_DEFINITIONS.map((def) => (
          <EffectCard
            key={def.type}
            type={def.type}
            effect={findEffect(effects, def.type)}
            onToggle={() => onChange(clip.id, toggleEffect(effects, def.type))}
            onParamChange={(key, value) =>
              onChange(clip.id, updateEffectParam(effects, def.type, key, value))
            }
          />
        ))}
      </div>
    </div>
  );
}
