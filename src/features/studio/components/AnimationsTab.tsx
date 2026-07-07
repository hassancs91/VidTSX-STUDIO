import type {
  StudioClipAnimation,
  StudioAnimationPreset,
  StudioAnimationEasing,
} from '@shared/ipc/types';
import {
  ANIMATION_PRESETS,
  getAnimationPreset,
  MIN_ANIMATION_DURATION_SECONDS,
  MAX_ANIMATION_DURATION_SECONDS,
  type AnimationDirection,
} from '../services/animations';

// Animations tab — drop Camtasia-style animation arrows on the selected object
// (video / image / text) and tune them. Each arrow tweens the object's scale /
// position / rotation / opacity over a clip-relative span; presets prefill the
// motion. Everything renders in the shared StudioComposition, so what you tune
// here previews live and exports identically. Arrow placement is via sliders in
// v1; dragging the arrow on the timeline lands in Phase 2.

// The selected object, abstracted over the three animatable tracks so the tab is
// track-agnostic. `durationSeconds` bounds the arrow start/length sliders.
export interface SelectedAnimatable {
  id: string;
  label: string;
  durationSeconds: number;
  animations?: StudioClipAnimation[];
}

interface AnimationsTabProps {
  clip: SelectedAnimatable | null;
  // Whether any animatable object exists at all — drives the empty-state copy.
  hasObjects: boolean;
  onAddAnimation: (preset: StudioAnimationPreset) => void;
  onUpdateAnimation: (animId: string, patch: Partial<StudioClipAnimation>) => void;
  onRemoveAnimation: (animId: string) => void;
  // Custom arrows: which arrow/edge is being posed on the canvas, and a toggle to
  // enter/leave that mode (pass null edge to leave).
  poseEdit?: { animId: string; edge: 'from' | 'to' } | null;
  onEditPose?: (animId: string, edge: 'from' | 'to' | null) => void;
}

const DIRECTIONS: { dir: AnimationDirection; label: string }[] = [
  { dir: 'left', label: '←' },
  { dir: 'right', label: '→' },
  { dir: 'up', label: '↑' },
  { dir: 'down', label: '↓' },
];

const EASINGS: StudioAnimationEasing[] = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-[8px]">
      <span className="text-text-dim text-[10px] w-[52px] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-[3px] accent-[var(--color-accent)] cursor-pointer"
      />
      <span className="text-text-muted text-[10px] w-[40px] shrink-0 text-right tabular-nums">
        {format(value)}
      </span>
    </label>
  );
}

function ArrowCard({
  animation,
  clipDuration,
  poseEditEdge,
  onEditPose,
  onUpdate,
  onRemove,
}: {
  animation: StudioClipAnimation;
  clipDuration: number;
  // Which edge of THIS arrow is currently being posed on the canvas (or null).
  poseEditEdge: 'from' | 'to' | null;
  onEditPose: (edge: 'from' | 'to' | null) => void;
  onUpdate: (patch: Partial<StudioClipAnimation>) => void;
  onRemove: () => void;
}) {
  const def = getAnimationPreset(animation.preset);
  const isCustom = animation.preset === 'custom';
  // Keep the arrow inside the clip: a longer duration shrinks the max start.
  const maxDuration = Math.max(
    MIN_ANIMATION_DURATION_SECONDS,
    Math.min(MAX_ANIMATION_DURATION_SECONDS, clipDuration)
  );
  const maxStart = Math.max(0, clipDuration - animation.durationSeconds);

  const setStart = (v: number) => onUpdate({ startSeconds: Math.min(v, maxStart) });
  const setDuration = (v: number) => {
    const duration = Math.min(v, clipDuration);
    // Clamp start so start+duration stays within the clip.
    const startSeconds = Math.min(animation.startSeconds, Math.max(0, clipDuration - duration));
    onUpdate({ durationSeconds: duration, startSeconds });
  };

  return (
    <div
      className="rounded-[6px] p-[10px] flex flex-col gap-[8px]"
      style={{
        border: '0.5px solid var(--color-border)',
        backgroundColor: 'var(--color-app-active)',
      }}
    >
      <div className="flex items-center justify-between gap-[8px]">
        <span className="text-accent-light text-[11px] font-medium">{def.label}</span>
        <button
          onClick={onRemove}
          className="text-text-dim text-[12px] leading-none hover:text-status-error transition-colors shrink-0"
          title="Remove animation"
        >
          ✕
        </button>
      </div>

      <Slider
        label="Start"
        value={animation.startSeconds}
        min={0}
        max={maxStart}
        step={0.05}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={setStart}
      />
      <Slider
        label="Length"
        value={animation.durationSeconds}
        min={MIN_ANIMATION_DURATION_SECONDS}
        max={maxDuration}
        step={0.05}
        format={(v) => `${v.toFixed(2)}s`}
        onChange={setDuration}
      />

      {def.directional && (
        <div className="flex items-center gap-[8px]">
          <span className="text-text-dim text-[10px] w-[52px] shrink-0">Direction</span>
          <div className="flex gap-[4px]">
            {DIRECTIONS.map(({ dir, label }) => {
              const active = (animation.direction ?? def.defaultDirection) === dir;
              return (
                <button
                  key={dir}
                  onClick={() => onUpdate({ direction: dir })}
                  className="w-[24px] h-[20px] rounded-[4px] text-[11px] transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--color-accent)' : 'var(--color-app-hover)',
                    color: active ? 'white' : 'var(--color-text-muted)',
                  }}
                  title={dir}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="flex items-center gap-[8px]">
        <span className="text-text-dim text-[10px] w-[52px] shrink-0">Easing</span>
        <select
          value={animation.easing ?? def.defaultEasing}
          onChange={(e) => onUpdate({ easing: e.target.value as StudioAnimationEasing })}
          className="flex-1 h-[22px] rounded-[4px] text-[10px] px-[6px]"
          style={{
            backgroundColor: 'var(--color-app-hover)',
            border: '0.5px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          {EASINGS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>

      {isCustom && (
        <div className="flex flex-col gap-[8px] pt-[2px]" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          {/* Drag the object on the canvas to define each pose. */}
          <div className="flex items-center gap-[6px]">
            <span className="text-text-dim text-[10px] w-[52px] shrink-0">Pose</span>
            {(['from', 'to'] as const).map((edge) => {
              const active = poseEditEdge === edge;
              return (
                <button
                  key={edge}
                  onClick={() => onEditPose(active ? null : edge)}
                  className="flex-1 h-[22px] rounded-[4px] text-[10px] font-medium transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--color-accent)' : 'var(--color-app-hover)',
                    color: active ? 'white' : 'var(--color-text-muted)',
                  }}
                  title={`Drag the object on the canvas to set its ${edge === 'from' ? 'start' : 'end'} pose`}
                >
                  {active ? `Editing ${edge === 'from' ? 'start' : 'end'}…` : `Set ${edge === 'from' ? 'start' : 'end'} pose`}
                </button>
              );
            })}
          </div>
          {/* Opacity isn't editable on the canvas — dial it here. */}
          <Slider
            label="Start α"
            value={animation.from.opacity ?? 1}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdate({ from: { ...animation.from, opacity: v } })}
          />
          <Slider
            label="End α"
            value={animation.to.opacity ?? 1}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdate({ to: { ...animation.to, opacity: v } })}
          />
        </div>
      )}
    </div>
  );
}

export function AnimationsTab({
  clip,
  hasObjects,
  onAddAnimation,
  onUpdateAnimation,
  onRemoveAnimation,
  poseEdit,
  onEditPose,
}: AnimationsTabProps) {
  if (!clip) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-[8px] p-[16px] text-center">
        <span className="text-text-dim text-[11px] font-medium">No object selected</span>
        <span className="text-text-ghost text-[10px] leading-relaxed">
          {hasObjects
            ? 'Select a video, image, or text object on the timeline, then add an animation like fade, pop, slide, or spin.'
            : 'Add a video, image, or text object to the timeline first, then select it to animate it.'}
        </span>
      </div>
    );
  }

  const animations = clip.animations ?? [];

  return (
    <div className="h-full flex flex-col overflow-y-auto p-[12px] gap-[10px]">
      <span className="text-text-primary text-[11px] font-medium truncate" title={clip.label}>
        Animations · {clip.label}
      </span>

      {/* Preset library — one click drops an arrow on the selected object. */}
      <div className="flex flex-col gap-[5px]">
        <span className="text-text-ghost text-[10px]">Add animation</span>
        <div className="grid grid-cols-2 gap-[5px]">
          {ANIMATION_PRESETS.map((def) => (
            <button
              key={def.preset}
              onClick={() => onAddAnimation(def.preset)}
              title={def.description}
              className="h-[26px] rounded-[4px] text-[10px] font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-app-hover)',
                color: 'var(--color-text-muted)',
              }}
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>

      {/* The object's current arrows. */}
      {animations.length > 0 ? (
        <div className="flex flex-col gap-[8px]">
          {animations.map((a) => (
            <ArrowCard
              key={a.id}
              animation={a}
              clipDuration={clip.durationSeconds}
              poseEditEdge={poseEdit?.animId === a.id ? poseEdit.edge : null}
              onEditPose={(edge) => onEditPose?.(a.id, edge)}
              onUpdate={(patch) => onUpdateAnimation(a.id, patch)}
              onRemove={() => onRemoveAnimation(a.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-text-ghost text-[10px] leading-relaxed">
          No animations yet. Pick a preset above to add one — it plays over a span you can tune
          here (and drag on the timeline soon).
        </p>
      )}
    </div>
  );
}
