import { useState } from 'react';
import type {
  StudioClipTransition,
  StudioTransitionType,
  StudioVideoClip,
} from '@shared/ipc/types';
import {
  TRANSITION_DEFINITIONS,
  DEFAULT_TRANSITION_DURATION_SECONDS,
  MIN_TRANSITION_DURATION_SECONDS,
  MAX_TRANSITION_DURATION_SECONDS,
} from '../services/transitions';
import { TransitionPreview } from './TransitionPreview';

// Transitions tab — assign entrance/exit transitions to the selected Video-track
// clip. `In` plays as the clip enters (over the previous clip, or from the
// background for the first clip); `Out` plays as it exits (over its last frames).
// Both render in the shared StudioComposition, so what you set here previews
// live and exports identically. v1 is Video-track only.

interface TransitionsTabProps {
  // The selected Video-track clip, or null when nothing (or a non-video clip)
  // is selected.
  clip: StudioVideoClip | null;
  // Whether the project has any video clips at all — drives the empty-state copy.
  hasVideoClips: boolean;
  // Filename of the clip immediately before this one on the track (abutting), or
  // null when this is the first clip / has a gap before it. Used to phrase the
  // "In" transition ("over X" vs "from the start").
  previousClipName: string | null;
  // True when this is the last clip on the track — phrases the "Out" transition.
  isLastClip: boolean;
  // Set (or clear) one of the clip's edge transitions.
  onChange: (
    clipId: string,
    edge: 'in' | 'out',
    transition: StudioClipTransition | undefined
  ) => void;
}

function TransitionEdgeEditor({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: StudioClipTransition | undefined;
  onChange: (transition: StudioClipTransition | undefined) => void;
}) {
  const selected = value?.type;

  const pick = (type: StudioTransitionType) => {
    if (type === selected) {
      onChange(undefined); // tapping the active type clears it
      return;
    }
    onChange({
      type,
      durationInSeconds: value?.durationInSeconds ?? DEFAULT_TRANSITION_DURATION_SECONDS,
    });
  };

  return (
    <div
      className="rounded-[6px] p-[10px] flex flex-col gap-[9px]"
      style={{
        border: '0.5px solid var(--color-border)',
        backgroundColor: value ? 'var(--color-app-active)' : 'transparent',
      }}
    >
      <div className="flex flex-col gap-[2px]">
        <span
          className="text-[11px] font-medium"
          style={{ color: value ? 'var(--color-accent-light)' : 'var(--color-text-primary)' }}
        >
          {title}
        </span>
        <span className="text-text-ghost text-[10px] leading-relaxed">{hint}</span>
      </div>

      <div className="grid grid-cols-3 gap-[5px]">
        {TRANSITION_DEFINITIONS.map((def) => {
          const active = def.type === selected;
          return (
            <button
              key={def.type}
              onClick={() => pick(def.type)}
              title={def.description}
              className="h-[26px] rounded-[4px] text-[10px] font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-accent)' : 'var(--color-app-hover)',
                color: active ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {def.label}
            </button>
          );
        })}
        <button
          onClick={() => onChange(undefined)}
          className="h-[26px] rounded-[4px] text-[10px] font-medium transition-colors"
          style={{
            backgroundColor: !selected ? 'var(--color-accent)' : 'var(--color-app-hover)',
            color: !selected ? 'white' : 'var(--color-text-muted)',
          }}
        >
          None
        </button>
      </div>

      {value && (
        <label className="flex items-center gap-[8px]">
          <span className="text-text-dim text-[10px] w-[58px] shrink-0">Duration</span>
          <input
            type="range"
            min={MIN_TRANSITION_DURATION_SECONDS}
            max={MAX_TRANSITION_DURATION_SECONDS}
            step={0.1}
            value={value.durationInSeconds}
            onChange={(e) =>
              onChange({ ...value, durationInSeconds: Number(e.target.value) })
            }
            className="flex-1 h-[3px] accent-[var(--color-accent)] cursor-pointer"
          />
          <span className="text-text-muted text-[10px] w-[40px] shrink-0 text-right tabular-nums">
            {value.durationInSeconds.toFixed(1)}s
          </span>
        </label>
      )}
    </div>
  );
}

export function TransitionsTab({
  clip,
  hasVideoClips,
  previousClipName,
  isLastClip,
  onChange,
}: TransitionsTabProps) {
  const [activeEdge, setActiveEdge] = useState<'in' | 'out'>('in');

  if (!clip) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-[8px] p-[16px] text-center">
        <span className="text-text-dim text-[11px] font-medium">No clip selected</span>
        <span className="text-text-ghost text-[10px] leading-relaxed">
          {hasVideoClips
            ? 'Select a video clip on the timeline to add a transition at its start, its end, or between it and the previous clip.'
            : 'Add a video clip to the timeline first, then select it to add transitions.'}
        </span>
      </div>
    );
  }

  const inHint = previousClipName
    ? `Plays as this clip enters — cross-fading over “${previousClipName}”.`
    : 'Plays as the video starts — entering from the background.';
  const outHint = isLastClip
    ? 'Plays as the video ends.'
    : 'Plays as this clip exits, before the next clip begins.';

  const active = activeEdge === 'in' ? clip.transitionIn : clip.transitionOut;
  const previewLabel = active
    ? TRANSITION_DEFINITIONS.find((d) => d.type === active.type)!.label
    : null;

  const EDGES: { id: 'in' | 'out'; label: string }[] = [
    { id: 'in', label: 'In' },
    { id: 'out', label: 'Out' },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto p-[12px] gap-[10px]">
      <span
        className="text-text-primary text-[11px] font-medium truncate"
        title={clip.fileName}
      >
        Transitions · {clip.fileName}
      </span>

      {/* In / Out sub-tabs (segmented control) */}
      <div
        className="flex rounded-[5px] p-[2px] gap-[2px]"
        style={{ backgroundColor: 'var(--color-app-base)', border: '0.5px solid var(--color-border)' }}
      >
        {EDGES.map((edge) => {
          const isActive = activeEdge === edge.id;
          const isSet = (edge.id === 'in' ? clip.transitionIn : clip.transitionOut) != null;
          return (
            <button
              key={edge.id}
              onClick={() => setActiveEdge(edge.id)}
              className="flex-1 h-[24px] rounded-[4px] text-[10px] font-medium transition-colors flex items-center justify-center gap-[5px]"
              style={{
                backgroundColor: isActive ? 'var(--color-app-active)' : 'transparent',
                color: isActive ? 'var(--color-accent-light)' : 'var(--color-text-dim)',
              }}
            >
              {edge.label}
              {isSet && (
                <span
                  className="w-[5px] h-[5px] rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                  title="Transition set"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Animated preview — follows the active edge (type + duration + direction)
          so it plays the actual In/Out motion at true speed. Hidden when the edge
          has no transition (None): there's nothing to preview. */}
      {active && (
        <div className="flex flex-col gap-[5px]">
          <span className="text-text-dim text-[10px]">
            Preview · {activeEdge === 'in' ? 'In' : 'Out'} · {previewLabel}
            {` · ${active.durationInSeconds.toFixed(1)}s`}
          </span>
          <TransitionPreview
            type={active.type}
            durationSeconds={active.durationInSeconds}
            dir={activeEdge}
          />
        </div>
      )}

      {activeEdge === 'in' ? (
        <TransitionEdgeEditor
          title="In"
          hint={inHint}
          value={clip.transitionIn}
          onChange={(t) => onChange(clip.id, 'in', t)}
        />
      ) : (
        <TransitionEdgeEditor
          title="Out"
          hint={outHint}
          value={clip.transitionOut}
          onChange={(t) => onChange(clip.id, 'out', t)}
        />
      )}
    </div>
  );
}
