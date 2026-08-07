import { useMemo } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { Pause, Play, SkipBack } from 'lucide-react';
import { TimelineComposition, type SerializedTimeline } from '@shared/studio';

interface Props {
  timeline: SerializedTimeline;
  playerRef: (ref: PlayerRef | null) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekStart: () => void;
  /** Videos still waiting on a 720p proxy — preview runs on originals until then. */
  proxyProgress: { total: number; ready: number };
}

/**
 * The editor preview: one @remotion/player over the same data-driven
 * composition the export renders, pointed at proxies. Transport lives here;
 * the playhead itself is owned by usePlayback so playback doesn't re-render
 * the editor.
 */
export function PreviewPanel({
  timeline,
  playerRef,
  isPlaying,
  onTogglePlay,
  onSeekStart,
  proxyProgress,
}: Props) {
  const inputProps = useMemo(() => ({ timeline }), [timeline]);
  const isEmpty = timeline.tracks.every((t) => t.clips.length === 0);
  const proxiesPending = proxyProgress.total - proxyProgress.ready;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-app-player">
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <div
          className="relative bg-black rounded-[4px] overflow-hidden flex items-center justify-center"
          style={{
            aspectRatio: `${timeline.width} / ${timeline.height}`,
            maxWidth: '100%',
            maxHeight: '100%',
            width: timeline.width >= timeline.height ? '100%' : 'auto',
            height: timeline.width >= timeline.height ? 'auto' : '100%',
            border: '0.5px solid var(--color-border)',
          }}
        >
          {isEmpty ? (
            <span className="text-[11px] text-text-ghost select-none px-4 text-center">
              {timeline.width}×{timeline.height} — add media to the timeline to preview it
            </span>
          ) : (
            <Player
              ref={playerRef}
              component={TimelineComposition}
              inputProps={inputProps}
              durationInFrames={timeline.durationInFrames}
              fps={timeline.fps}
              compositionWidth={timeline.width}
              compositionHeight={timeline.height}
              style={{ width: '100%', height: '100%' }}
              controls={false}
            />
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 h-[30px] px-2 shrink-0 bg-app-deep"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        <TransportButton label="Back to start (Home)" onClick={onSeekStart}>
          <SkipBack size={13} strokeWidth={1.5} />
        </TransportButton>
        <TransportButton label={isPlaying ? 'Pause (Space)' : 'Play (Space)'} onClick={onTogglePlay}>
          {isPlaying ? <Pause size={13} strokeWidth={1.5} /> : <Play size={13} strokeWidth={1.5} />}
        </TransportButton>
        <div className="flex-1" />
        {proxiesPending > 0 && (
          <span className="text-[10px] text-text-ghost">
            Building {proxiesPending} preview prox{proxiesPending === 1 ? 'y' : 'ies'}…
          </span>
        )}
      </div>
    </div>
  );
}

function TransportButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center justify-center w-[26px] h-[22px] rounded-[5px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors"
    >
      {children}
    </button>
  );
}
