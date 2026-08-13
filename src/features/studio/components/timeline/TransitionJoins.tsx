import type { StudioClip, StudioTrack } from '../../types';
import { clipEndTime } from '../../services/timeline-ops';
import { contiguousNext } from '../../services/transition-ops';
import { secondsToPx } from '../../services/timeline-view';

interface Props {
  track: StudioTrack;
  pxPerSecond: number;
  visibleFrom: number;
  visibleTo: number;
  /** Opens the transition picker for the boundary after this LEADING clip. */
  onJoinClick: (event: React.MouseEvent, leadingClip: StudioClip) => void;
}

/**
 * One small square per eligible join (contiguous clip pair on an unlocked
 * track) — the Slice E transition drop-zone. Filled accent when a transition
 * is set, ghost outline otherwise; click opens the picker menu.
 */
export function TransitionJoins({
  track,
  pxPerSecond,
  visibleFrom,
  visibleTo,
  onJoinClick,
}: Props) {
  if (track.locked) return null;
  const joins = track.clips.filter((clip) => {
    const cut = clipEndTime(clip);
    if (cut < visibleFrom || cut > visibleTo) return false;
    return contiguousNext(track.clips, clip) !== null;
  });

  return (
    <>
      {joins.map((clip) => {
        const transition = clip.transitionOut;
        return (
          <button
            key={clip.id}
            data-join-for={clip.id}
            title={
              transition
                ? `${transition.kind === 'crossfade' ? 'Crossfade' : 'Dip to black'} · ${transition.duration} s`
                : 'Add transition'
            }
            className="absolute z-20 w-[12px] h-[12px] rounded-[3px] transition-colors"
            style={{
              left: secondsToPx(clipEndTime(clip), pxPerSecond),
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: transition ? 'var(--color-accent-light)' : 'rgba(0,0,0,0.55)',
              border: transition
                ? '1px solid var(--color-accent-light)'
                : '1px solid var(--color-border-hover)',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onJoinClick(e, clip);
            }}
          />
        );
      })}
    </>
  );
}
