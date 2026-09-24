import { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { TransitionComponent } from '../hooks/useTransitions';
import { CARD_FPS, TransitionCardComposition, cardLoopFrames, cardPosterFrame } from './transition-demo-scenes';

interface Props {
  kind: string;
  name: string;
  /** Tooltip body: what it does, then when to use it. */
  description?: string;
  usage?: string;
  /** What a click applies. */
  durationSeconds: number;
  /** `sceneCopies: 'multi'` — the preview may drop frames; the export is exact. */
  heavy: boolean;
  /** Undefined until its module has loaded (or when it failed to). */
  component: TransitionComponent | undefined;
  /** The target join already uses this kind. */
  active: boolean;
  /** Why a click does nothing right now (no join selected, a sound-only join). */
  blockedReason: string | null;
  compositionWidth: number;
  compositionHeight: number;
  /** First time the card scrolls into view — the panel loads its module then. */
  onVisible: (kind: string) => void;
  onPick: (kind: string, durationSeconds: number) => void;
}

/**
 * One gallery card: a small Player of the real component over the generated
 * demo scenes. It rests on a still (the transition at its midpoint) and loops
 * while hovered or focused. Measured: four always-looping cards cost ~1 core,
 * which a preview playing beside them can't spare. The Player exists only
 * while the card is on screen.
 */
export function TransitionCard({
  kind,
  name,
  description,
  usage,
  durationSeconds,
  heavy,
  component,
  active,
  blockedReason,
  compositionWidth,
  compositionHeight,
  onVisible,
  onPick,
}: Props) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const playerRef = useRef<PlayerRef | null>(null);
  const [inView, setInView] = useState(false);
  const poster = cardPosterFrame(durationSeconds);
  const play = () => playerRef.current?.play();
  const rest = () => {
    playerRef.current?.pause();
    playerRef.current?.seekTo(poster);
  };
  const notified = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      setInView(visible);
      if (visible && !notified.current) {
        notified.current = true;
        onVisible(kind);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [kind, onVisible]);

  const inputProps = useMemo(
    () => (component ? { Transition: component, seconds: durationSeconds } : null),
    [component, durationSeconds],
  );

  const tooltip = [
    description,
    usage,
    heavy ? 'Heavy: mounts the scene many times, so the preview may drop frames. The export is exact.' : null,
    blockedReason,
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <button
      ref={ref}
      onClick={() => {
        if (!blockedReason) onPick(kind, durationSeconds);
      }}
      onPointerEnter={play}
      onPointerLeave={rest}
      onFocus={play}
      onBlur={rest}
      title={tooltip || name}
      aria-disabled={blockedReason !== null}
      aria-pressed={active}
      data-transition-card={kind}
      className={`flex flex-col rounded-[6px] overflow-hidden text-left transition-colors ${
        active ? 'bg-app-active' : 'bg-app-surface hover:bg-app-hover'
      } ${blockedReason ? 'cursor-default' : ''}`}
      style={{
        border: active ? '0.5px solid var(--color-accent)' : '0.5px solid var(--color-border)',
      }}
    >
      <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
        {inView && inputProps ? (
          <Player
            ref={playerRef}
            component={TransitionCardComposition}
            inputProps={inputProps}
            durationInFrames={cardLoopFrames(durationSeconds)}
            fps={CARD_FPS}
            compositionWidth={compositionWidth}
            compositionHeight={compositionHeight}
            style={{ width: '100%', height: '100%' }}
            controls={false}
            initialFrame={poster}
            loop
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[9px] text-text-ghost">
            Preview…
          </div>
        )}
        {heavy && (
          <span
            className="absolute top-1 right-1 text-[9px] leading-none px-[5px] py-[2px] rounded-[4px]"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--color-accent-amber)' }}
            data-heavy-badge
          >
            heavy
          </span>
        )}
      </div>
      <div className="px-1.5 py-1 flex items-center gap-1 min-w-0">
        <span className={`text-[10px] truncate ${active ? 'text-text-primary' : 'text-text-secondary'}`}>
          {name}
        </span>
        <span className="ml-auto shrink-0 text-[9px] text-text-dim">{durationSeconds} s</span>
      </div>
    </button>
  );
}
