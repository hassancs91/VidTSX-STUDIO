import { useMemo, type ComponentType } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { Palette, Pause, Play, SkipBack } from 'lucide-react';
import { TimelineComposition, type SerializedTimeline } from '@shared/studio';
import { referencedFilterKinds } from '@shared/studio/filter-pack';
import { referencedTransitionKinds } from '@shared/studio/transition-pack';
import type { CaptionRuntimeProps } from '@shared/types/studio';
import { useShotModuleSnapshot } from '../hooks/useShotModuleSnapshot';
import type { ShotModuleLoader } from '../services/shot-module-loader';
import type { ShotComponent } from '../hooks/useShotModuleLoader';
import { useFilterDefinitions } from '../hooks/useFilters';
import { useTransitionComponents } from '../hooks/useTransitions';

interface Props {
  timeline: SerializedTimeline;
  /** Live TSX shot components (S4) — subscribed here, so module arrivals
   *  re-render the preview only. See useShotModuleLoader. */
  shotLoader: ShotModuleLoader<ShotComponent>;
  /** The live-imported caption template (D13), when a layer is enabled. */
  captionComponent?: ComponentType<CaptionRuntimeProps>;
  playerRef: (ref: PlayerRef | null) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekStart: () => void;
  /** Videos still waiting on a 720p proxy — preview runs on originals until then. */
  proxyProgress: { total: number; ready: number };
  /** Monitoring speed for the Player — the document and export never see it. */
  playbackRate: number;
  /** True while an audition (or "Preview result") pins the speed to 1×. */
  ratePinned: boolean;
  onCycleRate: (direction: 1 | -1) => void;
  /** Canvas-manipulation overlay (absolute inset-0) — rendered over the
   *  Player inside the aspect box, so its rect IS the composition's rect. */
  overlay?: React.ReactNode;
  /** Changes when the installed transitions change — the preview then retries
   *  kinds that didn't load, so a reinstalled pack comes back without a reopen. */
  transitionRetryKey?: unknown;
  /** The same for pack filters (docs/studio/FILTER_PACKS_DESIGN.md). */
  filterRetryKey?: unknown;
  /** "Filters in preview" off: the Player paints every clip plain; the
   *  document and the export are untouched. */
  filtersInPreview?: boolean;
  /** Present = show the toggle beside the transport (flag `studio-filters`). */
  onToggleFiltersInPreview?: () => void;
}

/**
 * The editor preview: one @remotion/player over the same data-driven
 * composition the export renders, pointed at proxies. Transport lives here;
 * the playhead itself is owned by usePlayback so playback doesn't re-render
 * the editor.
 */
export function PreviewPanel({
  timeline,
  shotLoader,
  captionComponent,
  playerRef,
  isPlaying,
  onTogglePlay,
  onSeekStart,
  proxyProgress,
  playbackRate,
  ratePinned,
  onCycleRate,
  overlay,
  transitionRetryKey,
  filterRetryKey,
  filtersInPreview = true,
  onToggleFiltersInPreview,
}: Props) {
  const { components } = useShotModuleSnapshot(shotLoader);
  // Pack transitions the timeline uses — loaded here, like shot modules, so an
  // arrival re-renders the preview only. Unloaded kinds render as crossfades.
  const transitionKinds = useMemo(() => referencedTransitionKinds(timeline), [timeline]);
  const transitionComponents = useTransitionComponents(transitionKinds, transitionRetryKey);
  // Pack filters the same way; an unloaded kind shows the plain picture.
  const filterKinds = useMemo(() => referencedFilterKinds(timeline), [timeline]);
  const loadedFilters = useFilterDefinitions(filterKinds, filterRetryKey);
  const filterDefinitions = filtersInPreview ? loadedFilters : undefined;
  const inputProps = useMemo(
    () => ({ timeline, components, captionComponent, transitionComponents, filterDefinitions }),
    [timeline, components, captionComponent, transitionComponents, filterDefinitions],
  );
  const isEmpty = timeline.tracks.every((t) => t.clips.length === 0);
  const proxiesPending = proxyProgress.total - proxyProgress.ready;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-app-player">
      {/* The panel clips the canvas overlay (overflow-hidden HERE), while the
          aspect box below does NOT — a manipulation box dragged past the frame
          edge keeps its handles reachable over the letterbox area instead of
          being cut off at the picture. */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
        <div
          className="relative flex items-center justify-center"
          style={{
            aspectRatio: `${timeline.width} / ${timeline.height}`,
            maxWidth: '100%',
            maxHeight: '100%',
            width: timeline.width >= timeline.height ? '100%' : 'auto',
            height: timeline.width >= timeline.height ? 'auto' : '100%',
          }}
        >
          <div
            className="absolute inset-0 bg-black rounded-[4px] overflow-hidden flex items-center justify-center"
            style={{ border: '0.5px solid var(--color-border)' }}
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
                playbackRate={playbackRate}
                // NLE convention (Hasan, 2026-08-13): after playing past the
                // end, park at the end instead of snapping back to 0.
                moveToBeginningWhenEnded={false}
              />
            )}
          </div>
          {!isEmpty && overlay}
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
        <button
          onClick={(event) => onCycleRate(event.shiftKey ? -1 : 1)}
          disabled={ratePinned}
          title={
            ratePinned
              ? 'Speed pinned to 1× while auditioning'
              : 'Preview speed — monitoring only, the export is unaffected (Shift+click for slower)'
          }
          aria-label="Cycle preview playback speed"
          className="h-[22px] px-1.5 rounded-[5px] text-[10px] font-mono tabular-nums text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          {playbackRate}×
        </button>
        {onToggleFiltersInPreview && (
          <button
            onClick={onToggleFiltersInPreview}
            aria-pressed={filtersInPreview}
            title={
              filtersInPreview
                ? 'Filters in preview: on — click to preview every clip plain (the export is unaffected)'
                : 'Filters in preview: off — click to paint filters in the preview again'
            }
            aria-label="Toggle filters in preview"
            data-filters-preview={filtersInPreview ? 'on' : 'off'}
            className={`flex items-center justify-center w-[26px] h-[22px] rounded-[5px] transition-colors ${
              filtersInPreview ? 'text-text-secondary bg-app-active' : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
            }`}
          >
            <Palette size={13} strokeWidth={1.5} />
          </button>
        )}
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
