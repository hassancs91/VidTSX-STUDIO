import type { StudioClip, StudioTrack } from '../../types';
import { clipEndTime } from '../../services/timeline-ops';
import { contiguousNext } from '../../services/transition-ops';
import { JOIN_WARNING_TEXT, type JoinStatus } from '../../services/join-status';
import { secondsToPx } from '../../services/timeline-view';

interface Props {
  track: StudioTrack;
  pxPerSecond: number;
  visibleFrom: number;
  visibleTo: number;
  /** The Transitions tab's target (leading clip id) — drawn with a ring. */
  targetJoinId: string | null;
  /** Per leading clip: name, real length, warning (`joinStatuses`). */
  statuses: ReadonlyMap<string, JoinStatus>;
  /** Click or right-click on the boundary after this LEADING clip. */
  onJoinClick: (event: React.MouseEvent, leadingClip: StudioClip) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function tooltip(status: JoinStatus | undefined, clip: StudioClip): string {
  const transition = clip.transitionOut;
  if (!transition) return 'Add transition';
  if (!status) return `${transition.kind} · ${transition.duration} s`;
  const lines = [`${status.name} · ${round2(status.seconds)} s`];
  if (status.warning) lines.push(JOIN_WARNING_TEXT[status.warning]);
  else if (status.short) lines.push(`Plays ${round2(status.playsSeconds)} s: the clips run out of footage past the cut.`);
  return lines.join('\n');
}

/**
 * One small square per eligible join (contiguous clip pair on an unlocked
 * track) — the Slice E transition drop-zone. Ghost outline when empty,
 * filled accent when a transition is set, amber when it can't play as set: a
 * filled amber square for a missing pack (plays as a crossfade), an amber
 * outline for not enough media (plays as a hard cut).
 */
export function TransitionJoins({
  track,
  pxPerSecond,
  visibleFrom,
  visibleTo,
  targetJoinId,
  statuses,
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
        const status = transition ? statuses.get(clip.id) : undefined;
        const warning = status?.warning;
        const selected = clip.id === targetJoinId;
        const fill = warning === 'not-installed'
          ? 'var(--color-accent-amber)'
          : transition && !warning
            ? 'var(--color-accent-light)'
            : 'rgba(0,0,0,0.55)';
        const edge = warning
          ? 'var(--color-accent-amber)'
          : transition
            ? 'var(--color-accent-light)'
            : 'var(--color-border-hover)';
        return (
          <button
            key={clip.id}
            data-join-for={clip.id}
            {...(selected ? { 'data-join-selected': '' } : {})}
            {...(warning ? { 'data-join-warning': warning } : {})}
            title={tooltip(status, clip)}
            aria-pressed={selected}
            className="absolute z-20 w-[12px] h-[12px] rounded-[3px] transition-colors"
            style={{
              left: secondsToPx(clipEndTime(clip), pxPerSecond),
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: fill,
              border: `1px solid ${edge}`,
              boxShadow: selected ? '0 0 0 2px var(--color-app-deep), 0 0 0 3px var(--color-accent-light)' : undefined,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onJoinClick(e, clip);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onJoinClick(e, clip);
            }}
          />
        );
      })}
    </>
  );
}
