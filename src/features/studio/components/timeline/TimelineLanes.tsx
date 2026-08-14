import type { StudioClip, StudioTimeline, StudioTrack } from '../../types';
import { clipEndTime } from '../../services/timeline-ops';
import { TRACK_HEIGHT } from '../../services/timeline-view';
import { TimelineClip, type ClipDragKind, type ClipWaveformData } from './TimelineClip';
import { TransitionJoins } from './TransitionJoins';

interface Props {
  timeline: StudioTimeline;
  pxPerSecond: number;
  selectedClipIds: string[];
  /** Seconds range worth drawing — clips outside it are skipped entirely. */
  visibleFrom: number;
  visibleTo: number;
  labelFor: (clip: StudioClip) => string;
  getThumbnail: (assetId: string) => string | null;
  getWaveform: (assetId: string) => ClipWaveformData | null;
  onClipPointerDown: (event: React.PointerEvent, clip: StudioClip, kind: ClipDragKind) => void;
  onClipContextMenu: (event: React.MouseEvent, clip: StudioClip) => void;
  /** Press on empty lane space — starts the marquee (click = deselect). */
  onLanePointerDown: (event: React.PointerEvent) => void;
  /** Right-click on empty lane space — opens the track options menu (the
   *  header cell is narrow; the lane is where the mouse actually is). */
  onLaneContextMenu: (event: React.MouseEvent, track: StudioTrack) => void;
  /** Join square at a contiguous boundary — opens the transition picker. */
  onJoinClick: (event: React.MouseEvent, leadingClip: StudioClip) => void;
  /** Assets whose source file is missing — their clips get a warning tint. */
  missingAssetIds: ReadonlySet<string>;
}

/** The track lanes and their clips. */
export function TimelineLanes({
  timeline,
  pxPerSecond,
  selectedClipIds,
  visibleFrom,
  visibleTo,
  labelFor,
  getThumbnail,
  getWaveform,
  onClipPointerDown,
  onClipContextMenu,
  onLanePointerDown,
  onLaneContextMenu,
  onJoinClick,
  missingAssetIds,
}: Props) {
  const selected = new Set(selectedClipIds);
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
            if (e.target === e.currentTarget) onLanePointerDown(e);
          }}
          onContextMenu={(e) => {
            if (e.target === e.currentTarget) onLaneContextMenu(e, track);
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
                selected={selected.has(clip.id)}
                thumbnail={clip.assetId ? getThumbnail(clip.assetId) : null}
                waveform={clip.assetId ? getWaveform(clip.assetId) : null}
                missing={clip.assetId !== undefined && missingAssetIds.has(clip.assetId)}
                onPointerDown={onClipPointerDown}
                onContextMenu={onClipContextMenu}
              />
            ))}
          <TransitionJoins
            track={track}
            pxPerSecond={pxPerSecond}
            visibleFrom={visibleFrom}
            visibleTo={visibleTo}
            onJoinClick={onJoinClick}
          />
        </div>
      ))}
    </>
  );
}
