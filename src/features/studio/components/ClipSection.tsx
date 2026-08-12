import { useRef } from 'react';
import type { Dispatch } from 'react';
import { TextInput } from '@shared/components/TextInput';
import type { StudioClip, StudioMediaAsset, StudioTimeline } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';
import { findClip, type ClipPatch } from '../services/timeline-ops';
import {
  Field,
  NumberField,
  ReadOnlyValue,
  SliderField,
  VolumeControl,
} from './inspector-controls';

interface Props {
  timeline: StudioTimeline;
  assets: StudioMediaAsset[];
  selectedClipIds: string[];
  dispatch: Dispatch<TimelineAction>;
}

const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];

const hasAudio = (kind: StudioClip['kind']) =>
  kind === 'video' || kind === 'audio' || kind === 'sfx';
const hasPicture = (kind: StudioClip['kind']) =>
  kind === 'video' || kind === 'image' || kind === 'tsx';

/** "m:ss.cc" — clip read-outs need sub-second precision, unlike formatDuration. */
function fmtSeconds(t: number): string {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}`;
}

/**
 * Inspector body for the current clip selection: read-outs, volume + mute,
 * speed, transform, and label. Multi-selection offers volume/mute only, as
 * one undo step. Sliders and fields commit on release/blur — one committed
 * control change = one undo step.
 */
export function ClipSection({ timeline, assets, selectedClipIds, dispatch }: Props) {
  // Gains before muting, per clip id, so unmute restores the previous level.
  const preMuteGains = useRef(new Map<string, number>());

  const rememberAndMute = (clips: StudioClip[]) => {
    for (const clip of clips) {
      if ((clip.gain ?? 1) > 0) preMuteGains.current.set(clip.id, clip.gain ?? 1);
    }
  };

  if (selectedClipIds.length > 1) {
    const clips = selectedClipIds
      .map((id) => findClip(timeline, id)?.clip)
      .filter((c): c is StudioClip => c !== undefined);
    const audible = clips.filter((c) => hasAudio(c.kind));
    const audibleIds = audible.map((c) => c.id);
    const gains = audible.map((c) => c.gain ?? 1);
    const uniformGain = gains.length > 0 && gains.every((g) => g === gains[0]) ? gains[0] : null;
    const allMuted = gains.length > 0 && gains.every((g) => g === 0);
    return (
      <div className="flex flex-col gap-2">
        <ReadOnlyValue>{clips.length} clips selected</ReadOnlyValue>
        {audible.length > 0 && (
          <VolumeControl
            key={selectedClipIds.join(',')}
            gain={uniformGain ?? 1}
            mixed={uniformGain === null}
            muted={allMuted}
            onCommit={(gain) => dispatch({ type: 'update-clips', clipIds: audibleIds, patch: { gain } })}
            onToggleMute={() => {
              if (allMuted) {
                const restored = audibleIds.map((id) => preMuteGains.current.get(id) ?? 1);
                const gain = restored.every((g) => g === restored[0]) ? restored[0] : 1;
                dispatch({ type: 'update-clips', clipIds: audibleIds, patch: { gain } });
              } else {
                rememberAndMute(audible);
                dispatch({ type: 'update-clips', clipIds: audibleIds, patch: { gain: 0 } });
              }
            }}
          />
        )}
      </div>
    );
  }

  const found = selectedClipIds.length === 1 ? findClip(timeline, selectedClipIds[0]) : null;
  if (!found) return null;
  const { clip, track } = found;
  const asset = clip.assetId ? assets.find((a) => a.id === clip.assetId) : undefined;
  const name = clip.label ?? asset?.path.split(/[\\/]/).pop() ?? clip.kind;
  const speed = clip.speed ?? 1;
  const muted = (clip.gain ?? 1) === 0;

  const patchClip = (patch: ClipPatch) => dispatch({ type: 'update-clip', clipId: clip.id, patch });

  return (
    <div className="flex flex-col gap-2" key={clip.id}>
      <Field label="Name">
        <ReadOnlyValue>{name}</ReadOnlyValue>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Track">
          <ReadOnlyValue>{track.name}</ReadOnlyValue>
        </Field>
        <Field label="Start">
          <ReadOnlyValue>{fmtSeconds(clip.timelineStart)}</ReadOnlyValue>
        </Field>
        <Field label="Length">
          <ReadOnlyValue>{fmtSeconds(clip.duration)}</ReadOnlyValue>
        </Field>
      </div>

      {hasAudio(clip.kind) && (
        <VolumeControl
          key={`vol-${clip.id}`}
          gain={clip.gain ?? 1}
          mixed={false}
          muted={muted}
          onCommit={(gain) => patchClip({ gain })}
          onToggleMute={() => {
            if (muted) {
              patchClip({ gain: preMuteGains.current.get(clip.id) ?? 1 });
            } else {
              rememberAndMute([clip]);
              patchClip({ gain: 0 });
            }
          }}
        />
      )}

      {hasAudio(clip.kind) && (
        <Field label={`Speed · ${Number(speed.toFixed(2))}×`} asDiv>
          <div className="flex gap-1">
            {SPEED_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => dispatch({ type: 'clip-speed', clipId: clip.id, speed: preset })}
                className={`flex-1 h-[22px] rounded-[5px] text-[10px] transition-colors ${
                  Math.abs(speed - preset) < 0.001
                    ? 'bg-app-active text-text-primary'
                    : 'bg-app-base text-text-muted hover:bg-app-hover hover:text-text-secondary'
                }`}
                style={{ border: '0.5px solid var(--color-border)' }}
              >
                {preset}×
              </button>
            ))}
          </div>
          <NumberField
            value={speed}
            min={0.1}
            max={10}
            suffix="×"
            onCommit={(value) => dispatch({ type: 'clip-speed', clipId: clip.id, speed: value })}
          />
          <p className="text-[9px] text-text-ghost leading-snug">
            Shortens/lengthens the clip in place — later clips don't move.
          </p>
        </Field>
      )}

      {hasPicture(clip.kind) && (
        <>
          <SliderField
            key={`op-${clip.id}`}
            label="Opacity"
            value={Math.round((clip.transform?.opacity ?? 1) * 100)}
            min={0}
            max={100}
            unit="%"
            onCommit={(v) => patchClip({ transform: { opacity: v / 100 } })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Position X (px)">
              <NumberField
                value={clip.transform?.x ?? 0}
                min={-10000}
                max={10000}
                onCommit={(x) => patchClip({ transform: { x } })}
              />
            </Field>
            <Field label="Position Y (px)">
              <NumberField
                value={clip.transform?.y ?? 0}
                min={-10000}
                max={10000}
                onCommit={(y) => patchClip({ transform: { y } })}
              />
            </Field>
            <Field label="Scale (%)">
              <NumberField
                value={Math.round((clip.transform?.scale ?? 1) * 100)}
                min={1}
                max={1000}
                onCommit={(v) => patchClip({ transform: { scale: v / 100 } })}
              />
            </Field>
            <Field label="Rotation (°)">
              <NumberField
                value={clip.transform?.rotation ?? 0}
                min={-360}
                max={360}
                onCommit={(rotation) => patchClip({ transform: { rotation } })}
              />
            </Field>
          </div>
        </>
      )}

      <Field label="Label">
        <TextInput
          key={`label-${clip.id}`}
          defaultValue={clip.label ?? ''}
          placeholder={asset?.path.split(/[\\/]/).pop() ?? clip.kind}
          onBlur={(e) => patchClip({ label: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </Field>
    </div>
  );
}
