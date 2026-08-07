import { Eye, EyeOff, Lock, Volume2, VolumeX } from 'lucide-react';
import type { StudioClip, StudioTimeline, StudioTrack } from '../../types';
import { clipEndTime } from '../../services/timeline-ops';
import { TRACK_HEIGHT } from '../../services/timeline-view';
import { TimelineClip, type ClipDragKind, type ClipWaveformData } from './TimelineClip';

interface Props {
  timeline: StudioTimeline;
  pxPerSecond: number;
  selectedClipId: string | null;
  /** Seconds range worth drawing — clips outside it are skipped entirely. */
  visibleFrom: number;
  visibleTo: number;
  labelFor: (clip: StudioClip) => string;
  getThumbnail: (assetId: string) => string | null;
  getWaveform: (assetId: string) => ClipWaveformData | null;
  onClipPointerDown: (event: React.PointerEvent, clip: StudioClip, kind: ClipDragKind) => void;
  onDeselect: () => void;
}

/** The track lanes and their clips. */
export function TimelineLanes({
  timeline,
  pxPerSecond,
  selectedClipId,
  visibleFrom,
  visibleTo,
  labelFor,
  getThumbnail,
  getWaveform,
  onClipPointerDown,
  onDeselect,
}: Props) {
  return (
    <>
      {timeline.tracks.map((track) => (
        <div
          key={track.id}
          className="relative"
          style={{
            height: TRACK_HEIGHT,
            borderBottom: '0.5px solid var(--color-border)',
            backgroundColor: track.kind === 'audio' ? 'rgba(0,0,0,0.18)' : 'transparent',
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onDeselect();
          }}
        >
          {track.clips
            .filter((c) => clipEndTime(c) >= visibleFrom && c.timelineStart <= visibleTo)
            .map((clip) => (
              <TimelineClip
                key={clip.id}
                clip={clip}
                label={labelFor(clip)}
                pxPerSecond={pxPerSecond}
                heightPx={TRACK_HEIGHT}
                selected={clip.id === selectedClipId}
                thumbnail={clip.assetId ? getThumbnail(clip.assetId) : null}
                waveform={clip.assetId ? getWaveform(clip.assetId) : null}
                onPointerDown={onClipPointerDown}
              />
            ))}
        </div>
      ))}
    </>
  );
}

/** Fixed left column: one header per lane, aligned with the lanes above. */
export function TrackHeader({ track }: { track: StudioTrack }) {
  const MutedIcon = track.muted ? VolumeX : Volume2;
  const HiddenIcon = track.hidden ? EyeOff : Eye;
  return (
    <div
      className="flex items-center gap-1 px-2"
      style={{ height: TRACK_HEIGHT, borderBottom: '0.5px solid var(--color-border)' }}
    >
      <span className="text-[10px] font-medium text-text-muted flex-1 truncate">{track.name}</span>
      {track.locked && <Lock size={10} strokeWidth={1.5} className="text-text-ghost" />}
      {track.kind === 'audio' ? (
        <MutedIcon size={11} strokeWidth={1.5} className="text-text-ghost" />
      ) : (
        <HiddenIcon size={11} strokeWidth={1.5} className="text-text-ghost" />
      )}
    </div>
  );
}
