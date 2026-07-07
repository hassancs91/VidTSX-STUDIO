import { useRef, useCallback, useState, type RefObject } from 'react';
import type { PlayerRef } from '@remotion/player';
import { STUDIO_TRACKS, type SelectedClip, type SelectableTrackType } from '../types';
import { useTimelineSync } from '../hooks/useTimelineSync';
import { TimeRuler } from './TimeRuler';
import { TrackRow } from './TrackRow';

export interface TimelineSlot {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  // Visual indicator hint — currently used by caption clips to paint a small
  // override dot. Optional so video/TSX clips don't have to set it.
  hasOverride?: boolean;
  // TSX-only: marks pending placeholder slots so the renderer can show a
  // dashed border + reduced opacity. Set by the parent when mapping
  // pending TSX slots into the timeline.
  isPending?: boolean;
  // Video-only: clip's audio is muted — the renderer paints a small mute badge
  // so muted clips are recognizable at a glance.
  muted?: boolean;
  // Video-only: an entrance/exit transition is set — the renderer paints a small
  // wedge at the matching edge so transitions are visible at a glance.
  transitionIn?: boolean;
  transitionOut?: boolean;
  // Audio-carrying clips (video / SFX / music): source URL + the source-time
  // window the clip shows. When present, TrackRow draws the audio waveform in
  // the clip body. Decoding/caching happens lazily in ClipWaveform.
  waveform?: { url: string; inPointSeconds: number; durationSeconds: number };
  // Animation arrows on this clip (clip-relative seconds). TrackRow draws them as
  // draggable bands when the clip is the primary selection. Undefined = none.
  animations?: TimelineAnimation[];
}

// Lightweight animation-arrow descriptor for the timeline. Times are
// clip-relative seconds (relative to the clip's own start).
export interface TimelineAnimation {
  id: string;
  startSeconds: number;
  durationSeconds: number;
  label: string;
}

export interface TimelineHiddenChip {
  id: string;
  atCutTime: number;
  sourceDuration: number;
  cutReason?: string;
}

// Pending cuts proposed by auto-cut but not yet applied. Rendered as
// translucent red overlay rects on the video track during the review phase.
export interface TimelinePendingCut {
  from: number;
  to: number;
  type: string;
  reason?: string;
}

interface StudioTimelineProps {
  playerRef: RefObject<PlayerRef | null>;
  durationInSeconds: number;
  durationInFrames: number;
  fps: number;
  // Captions go through the same clip path as TSX/video — already remapped
  // to cut-time by the parent; ids encode source segment + part index so the
  // parent can route drag/trim/delete back to the source-time store.
  captionClips?: TimelineSlot[];
  tsxSlots?: TimelineSlot[];
  videoClips?: TimelineSlot[];
  imageClips?: TimelineSlot[];
  textClips?: TimelineSlot[];
  sfxClips?: TimelineSlot[];
  musicClips?: TimelineSlot[];
  hiddenTracks?: Set<string>;
  // Primary selection (drives editor panels + which clip gets the strong ring).
  selectedClip?: SelectedClip | null;
  // Full multi-selection. The primary is the last entry; every entry is shown
  // highlighted and is acted on by bulk delete / move / mute.
  selectedClips?: SelectedClip[];
  // `additive` (ctrl/cmd held) toggles the clip in the selection instead of
  // replacing it.
  onSelectClip?: (selection: SelectedClip | null, additive?: boolean) => void;
  // Animation arrows: the focused arrow id (drives its highlight), a selector,
  // and a patch applier. These act on the PRIMARY-selected clip; TrackRow draws
  // the bands on that clip and resolves move/trim into start/duration patches.
  selectedAnimationId?: string | null;
  onSelectAnimation?: (animId: string | null) => void;
  onUpdateAnimation?: (
    animId: string,
    patch: { startSeconds?: number; durationSeconds?: number }
  ) => void;
  onDeleteSelectedClip?: () => void;
  // Group move: snapshot positions on start, shift the whole selection by a
  // delta (seconds) on each drag step, clear on end.
  onMoveSelectionStart?: () => void;
  onMoveSelectionBy?: (deltaSeconds: number) => void;
  onMoveSelectionEnd?: () => void;
  // Copy/paste clip attributes. Copy captures the primary clip's look; paste
  // applies it to the whole selection. `can*` flags drive the toolbar enabled
  // state. `onClipContextMenu` opens the right-click menu for a clip.
  onCopyAttributes?: () => void;
  onPasteAttributes?: () => void;
  canCopyAttributes?: boolean;
  canPasteAttributes?: boolean;
  onClipContextMenu?: (selection: SelectedClip, x: number, y: number) => void;
  // Whether the selected clip is currently muted (video clips only). Drives the
  // toolbar mute toggle's icon/label. Undefined when no muteable clip is selected.
  selectedClipMuted?: boolean;
  onToggleMuteSelectedClip?: () => void;
  // Playback gain (0..1) of the selected clip, for clips that carry audio
  // (video / SFX / music). Undefined when the selection has no volume control.
  // Drives the toolbar volume slider.
  selectedClipVolume?: number;
  onSetSelectedClipVolume?: (volume: number) => void;
  // Per-project timeline view toggles. When set, the matching adornment is
  // hidden on every clip across all tracks. State is owned by the parent
  // (persisted per project); the toolbar just flips it.
  hideFileNames?: boolean;
  hideWaveform?: boolean;
  onToggleHideFileNames?: () => void;
  onToggleHideWaveform?: () => void;
  // Vertical minimize/maximize of the whole timeline panel. When `collapsed`,
  // only this transport bar shows (the tracks area is hidden). The toggles and
  // current state are owned by the parent (which controls the panel height).
  collapsed?: boolean;
  maximized?: boolean;
  onToggleMinimize?: () => void;
  onToggleMaximize?: () => void;
  // Current timeline panel height (px). Track rows divide the leftover space
  // (panel minus transport bar + ruler) so they grow vertically with the panel.
  panelHeight?: number;
  activeTrackId?: string | null;
  activeTrackLabel?: string | null;
  onActivateTrack?: (trackId: string | null) => void;
  onCutAllTracks?: () => void;
  onCutActiveTrack?: () => void;
  onToggleTrackVisibility?: (trackId: string) => void;
  onMoveTsxSlot?: (slotId: string, newStartTime: number) => void;
  onTrimTsxSlot?: (slotId: string, edge: 'start' | 'end', newTime: number) => void;
  onMoveVideoClip?: (clipId: string, newStartTime: number) => void;
  onTrimVideoClip?: (clipId: string, edge: 'start' | 'end', newTime: number) => void;
  onMoveImageClip?: (clipId: string, newStartTime: number) => void;
  onTrimImageClip?: (clipId: string, edge: 'start' | 'end', newTime: number) => void;
  onMoveTextClip?: (clipId: string, newStartTime: number) => void;
  onTrimTextClip?: (clipId: string, edge: 'start' | 'end', newTime: number) => void;
  // SFX + Music share one handler set (one underlying audio store). The switch
  // handler reassigns a clip to the other audio row on drop.
  onMoveAudioClip?: (clipId: string, newStartTime: number) => void;
  onTrimAudioClip?: (clipId: string, edge: 'start' | 'end', newTime: number) => void;
  onSwitchAudioClipTrack?: (clipId: string, toTrack: 'sfx' | 'music') => void;
  // Fired when any clip drag/trim begins/ends — lets the parent freeze the
  // timeline scale for the duration of the gesture.
  onClipInteractStart?: () => void;
  onClipInteractEnd?: () => void;
  // Caption drag/trim handlers — receive the remapped (timeline) id; parent
  // resolves to the underlying source segment via the id format.
  onMoveCaptionClip?: (clipId: string, newStartTime: number) => void;
  onTrimCaptionClip?: (clipId: string, edge: 'start' | 'end', newTime: number) => void;
  // Hidden video chips, positioned in cut-time. Render on the video track only.
  videoHiddenChips?: TimelineHiddenChip[];
  onRestoreVideoClip?: (clipId: string) => void;
  onDeleteVideoClip?: (clipId: string) => void;
  // Pending cuts proposed by auto-cut but not yet applied. Source-time ranges
  // rendered as translucent red rectangles over the video clip body.
  videoPendingCuts?: TimelinePendingCut[];
}

function ScissorsIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="10.5" r="2" />
      <circle cx="11" cy="10.5" r="2" />
      <path d="M4.4 9.1L12 1.5" />
      <path d="M9.6 9.1L2 1.5" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5V8.5H4L7 11V3L4 5.5H2Z" />
      {muted ? (
        <path d="M9.5 5L12.5 8M12.5 5L9.5 8" />
      ) : (
        <>
          <path d="M9.5 5.5C10 6 10 8 9.5 8.5" />
          <path d="M11 4.5C12 5.5 12 8.5 11 9.5" />
        </>
      )}
    </svg>
  );
}

// "Aa" label glyph for the hide-file-names toggle.
function LabelIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 11L4 3L6.5 11" />
      <path d="M2.3 8.3H5.7" />
      <path d="M12.5 6.5C12.5 5.7 11.9 5 11 5C10 5 9.3 5.7 9.3 6.7C9.3 8 10.3 8.2 11 8.3C12 8.4 12.5 8.9 12.5 9.6C12.5 10.4 11.9 11 11 11C10.1 11 9.5 10.4 9.5 9.6" />
    </svg>
  );
}

// Three-bar waveform glyph for the hide-waveform toggle.
function WaveIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5V8.5" />
      <path d="M5 3V11" />
      <path d="M8 4.5V9.5" />
      <path d="M11 2.5V11.5" />
    </svg>
  );
}

function formatTimecode(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const frames = Math.floor(frame % fps);
  return `${mins}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
}

export function StudioTimeline({
  playerRef,
  durationInSeconds,
  durationInFrames,
  fps,
  captionClips,
  tsxSlots,
  videoClips,
  imageClips,
  textClips,
  sfxClips,
  musicClips,
  hiddenTracks,
  selectedClip,
  selectedClips,
  selectedAnimationId,
  onSelectAnimation,
  onUpdateAnimation,
  onSelectClip,
  onDeleteSelectedClip,
  onMoveSelectionStart,
  onMoveSelectionBy,
  onMoveSelectionEnd,
  onCopyAttributes,
  onPasteAttributes,
  canCopyAttributes,
  canPasteAttributes,
  onClipContextMenu,
  selectedClipMuted,
  onToggleMuteSelectedClip,
  selectedClipVolume,
  onSetSelectedClipVolume,
  hideFileNames,
  hideWaveform,
  onToggleHideFileNames,
  onToggleHideWaveform,
  collapsed,
  maximized,
  onToggleMinimize,
  onToggleMaximize,
  panelHeight,
  activeTrackId,
  activeTrackLabel,
  onActivateTrack,
  onCutAllTracks,
  onCutActiveTrack,
  onToggleTrackVisibility,
  onMoveTsxSlot,
  onTrimTsxSlot,
  onMoveVideoClip,
  onTrimVideoClip,
  onMoveImageClip,
  onTrimImageClip,
  onMoveTextClip,
  onTrimTextClip,
  onMoveAudioClip,
  onTrimAudioClip,
  onSwitchAudioClipTrack,
  onClipInteractStart,
  onClipInteractEnd,
  onMoveCaptionClip,
  onTrimCaptionClip,
  videoHiddenChips,
  onRestoreVideoClip,
  onDeleteVideoClip,
  videoPendingCuts,
}: StudioTimelineProps) {
  const { currentFrame, isPlaying, seekToFrame, togglePlayPause } = useTimelineSync(
    playerRef,
    durationInFrames,
    fps
  );
  const tracksRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const isDraggingRef = useRef(false);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 10;
  const ZOOM_STEP = 1.5;

  // Fixed pixels-per-second scale (professional timeline). The content width is
  // proportional to the timeline DURATION, not the viewport — so growing the
  // timeline (e.g. dragging the last clip right) extends it to the right and
  // scrolls, instead of rescaling every clip to fit the viewport. Zoom scales
  // the px/sec; the viewport scrolls horizontally.
  const PX_PER_SECOND = 70;
  const scaledContentWidth = durationInSeconds * PX_PER_SECOND * zoom;

  // Convert click position to frame (accounts for zoom + horizontal scroll)
  const positionToFrame = useCallback(
    (clientX: number) => {
      const el = tracksRef.current;
      if (!el || scaledContentWidth <= 0) return 0;

      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left - 80 + el.scrollLeft;
      const fraction = Math.max(0, Math.min(1, x / scaledContentWidth));
      return Math.round(fraction * durationInFrames);
    },
    [scaledContentWidth, durationInFrames]
  );

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // Click-to-seek and drag scrub. Also deselects any selected clip
  // (clip mouseDown stops propagation, so this fires only for empty space).
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      onSelectClip?.(null);
      seekToFrame(positionToFrame(e.clientX));

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (isDraggingRef.current) {
          seekToFrame(positionToFrame(moveEvent.clientX));
        }
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [positionToFrame, seekToFrame, onSelectClip]
  );

  const playheadX = durationInFrames > 0
    ? (currentFrame / durationInFrames) * scaledContentWidth + 80
    : 80;

  const selectionCount = selectedClips?.length ?? 0;

  // Track rows share the panel's leftover vertical space (panel height minus the
  // 33px transport bar and 24px ruler), so they grow as the timeline is resized
  // or maximized. Clamped to a compact minimum — below that the area scrolls.
  const MIN_TRACK_HEIGHT = 28;
  const trackHeight = panelHeight
    ? Math.max(MIN_TRACK_HEIGHT, Math.floor((panelHeight - 33 - 24) / STUDIO_TRACKS.length))
    : MIN_TRACK_HEIGHT;

  return (
    <div
      className="flex flex-col select-none"
      style={{
        borderTop: '0.5px solid var(--color-border)',
        backgroundColor: 'var(--color-app-base)',
      }}
    >
      {/* Transport bar */}
      <div
        className="flex items-center gap-[12px] px-[12px] h-[32px] shrink-0"
        style={{
          backgroundColor: 'var(--color-app-surface)',
          borderBottom: '0.5px solid var(--color-border)',
        }}
      >
        <button
          onClick={togglePlayPause}
          className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] text-text-muted hover:bg-app-hover transition-colors"
        >
          {isPlaying ? (
            <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1" />
              <rect x="8" y="1" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 1.5V12.5L12 7L3 1.5Z" />
            </svg>
          )}
        </button>
        <span className="text-text-muted text-[11px] font-mono">
          {formatTimecode(currentFrame, fps)}
        </span>
        <span className="text-text-dim text-[10px]">/</span>
        <span className="text-text-dim text-[10px] font-mono">
          {formatTimecode(durationInFrames, fps)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Cut tools — split at playhead. "Cut all" splits every clip-bearing
            track. "Cut <track>" splits only the active track. */}
        {onCutAllTracks && (
          <button
            onClick={onCutAllTracks}
            className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] text-text-muted hover:text-accent-light hover:bg-app-hover transition-colors"
            title="Cut all tracks at playhead"
          >
            <ScissorsIcon />
            Cut all
          </button>
        )}
        {onCutActiveTrack && (
          <button
            onClick={onCutActiveTrack}
            disabled={!activeTrackId}
            className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] text-text-muted hover:text-accent-light hover:bg-app-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-muted disabled:hover:bg-transparent"
            title={activeTrackId ? `Cut ${activeTrackLabel ?? 'active'} track at playhead` : 'Activate a track (click its label) to cut just that track'}
          >
            <ScissorsIcon />
            {activeTrackId ? `Cut ${activeTrackLabel ?? 'track'}` : 'Cut track'}
          </button>
        )}

        {/* Mute/unmute selected video clip(s). Keeps the video visible but drops
            its audio in both preview and the final render. Shown whenever the
            selection holds at least one video clip. */}
        {selectedClipMuted !== undefined && onToggleMuteSelectedClip && (
          <button
            onClick={onToggleMuteSelectedClip}
            className={`flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] transition-colors hover:bg-app-hover ${
              selectedClipMuted
                ? 'text-status-error hover:text-status-error'
                : 'text-text-muted hover:text-accent-light'
            }`}
            title={selectedClipMuted ? 'Unmute clip audio' : 'Mute clip audio'}
          >
            <SpeakerIcon muted={!!selectedClipMuted} />
            {selectedClipMuted ? 'Muted' : 'Mute'}
          </button>
        )}

        {/* Volume slider for the selected clip (video / SFX / music). Shown
            whenever the selection carries audio. For a muted video clip the
            slider is dimmed since mute overrides gain. */}
        {selectedClipVolume !== undefined && onSetSelectedClipVolume && (
          <div
            className="flex items-center gap-[5px] px-[8px] h-[22px] rounded-[4px]"
            style={{ backgroundColor: 'var(--color-app-active)', opacity: selectedClipMuted ? 0.45 : 1 }}
            title="Clip volume"
          >
            <SpeakerIcon muted={false} />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(selectedClipVolume * 100)}
              onChange={(e) => onSetSelectedClipVolume(Number(e.target.value) / 100)}
              className="w-[72px] h-[3px] cursor-pointer accent-[var(--color-accent)]"
            />
            <span className="text-text-muted text-[10px] font-mono w-[28px] text-right">
              {Math.round(selectedClipVolume * 100)}%
            </span>
          </div>
        )}

        {/* Delete selected clip(s) */}
        {selectedClip && onDeleteSelectedClip && (
          <button
            onClick={onDeleteSelectedClip}
            className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] text-text-muted hover:text-status-error hover:bg-app-hover transition-colors"
            title={selectionCount > 1 ? `Delete ${selectionCount} selected clips (Delete)` : 'Delete selected clip (Delete)'}
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 3.5H9.5" />
              <path d="M4 3.5V2.5C4 2 4.5 1.5 5 1.5H7C7.5 1.5 8 2 8 2.5V3.5" />
              <path d="M3.5 3.5L4 10C4 10.5 4.5 11 5 11H7C7.5 11 8 10.5 8 10L8.5 3.5" />
            </svg>
            {selectionCount > 1 ? `Delete (${selectionCount})` : 'Delete'}
          </button>
        )}

        {/* Copy / paste clip attributes (transform, effects, transitions,
            volume, text style). Copy grabs the primary clip's look; paste
            applies it to the whole selection. */}
        {(onCopyAttributes || onPasteAttributes) && (
          <div className="flex items-center gap-[2px] ml-[8px]">
            {onCopyAttributes && (
              <button
                onClick={() => onCopyAttributes()}
                disabled={!canCopyAttributes}
                className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] text-text-muted hover:text-accent-light hover:bg-app-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-muted disabled:hover:bg-transparent"
                title="Copy attributes — transform, effects, transitions, volume, style (Ctrl+Alt+C)"
              >
                <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.2" />
                  <path d="M5.5 3V2.2C5.5 1.5 6 1 6.7 1H11.3C12 1 12.5 1.5 12.5 2.2V6.8C12.5 7.5 12 8 11.3 8H10.5" />
                </svg>
                Copy attr
              </button>
            )}
            {onPasteAttributes && (
              <button
                onClick={() => onPasteAttributes()}
                disabled={!canPasteAttributes}
                className="flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] text-text-muted hover:text-accent-light hover:bg-app-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-muted disabled:hover:bg-transparent"
                title="Paste attributes onto the selection (Ctrl+Alt+V)"
              >
                <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 2.5H3C2.4 2.5 2 2.9 2 3.5V11.5C2 12.1 2.4 12.5 3 12.5H8C8.6 12.5 9 12.1 9 11.5V3.5C9 2.9 8.6 2.5 8 2.5H6.5" />
                  <rect x="4.5" y="1.5" width="2" height="2" rx="0.5" />
                  <path d="M7 9.5L8.2 10.7L11 7.5" />
                </svg>
                Paste attr
              </button>
            )}
          </div>
        )}

        {/* Timeline view toggles — hide clip names / hide waveforms across all
            tracks. Highlighted (filled) when the adornment is shown; dimmed +
            struck when hidden. Persisted per project by the parent. */}
        {(onToggleHideFileNames || onToggleHideWaveform) && (
          <div className="flex items-center gap-[2px] ml-[8px]">
            {onToggleHideFileNames && (
              <button
                onClick={onToggleHideFileNames}
                className={`flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] transition-colors hover:bg-app-hover ${
                  hideFileNames
                    ? 'text-text-dim hover:text-text-muted'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title={hideFileNames ? 'Show clip names' : 'Hide clip names'}
              >
                <LabelIcon />
                <span className={hideFileNames ? 'line-through' : ''}>Names</span>
              </button>
            )}
            {onToggleHideWaveform && (
              <button
                onClick={onToggleHideWaveform}
                className={`flex items-center gap-[4px] px-[8px] h-[22px] rounded-[4px] text-[10px] transition-colors hover:bg-app-hover ${
                  hideWaveform
                    ? 'text-text-dim hover:text-text-muted'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title={hideWaveform ? 'Show waveforms' : 'Hide waveforms'}
              >
                <WaveIcon />
                <span className={hideWaveform ? 'line-through' : ''}>Wave</span>
              </button>
            )}
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-[2px] ml-[8px]">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM + 0.001}
            className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom out"
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M2.5 6H9.5" />
            </svg>
          </button>
          <button
            onClick={zoomReset}
            className="px-[6px] h-[22px] rounded-[4px] text-[10px] font-mono text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors min-w-[38px]"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM - 0.001}
            className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Zoom in"
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M6 2.5V9.5" />
              <path d="M2.5 6H9.5" />
            </svg>
          </button>
        </div>

        {/* Vertical minimize / maximize of the timeline panel */}
        {(onToggleMinimize || onToggleMaximize) && (
          <div className="flex items-center gap-[2px] ml-[6px]">
            {onToggleMaximize && (
              <button
                onClick={onToggleMaximize}
                className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
                title={maximized ? 'Restore timeline height' : 'Maximize timeline'}
              >
                {maximized ? (
                  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4.5H4.5V2M10 4.5H7.5V2M2 7.5H4.5V10M10 7.5H7.5V10" />
                  </svg>
                ) : (
                  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 2H2V4.5M7.5 2H10V4.5M4.5 10H2V7.5M7.5 10H10V7.5" />
                  </svg>
                )}
              </button>
            )}
            {onToggleMinimize && (
              <button
                onClick={onToggleMinimize}
                className="flex items-center justify-center w-[22px] h-[22px] rounded-[4px] text-text-muted hover:text-text-primary hover:bg-app-hover transition-colors"
                title={collapsed ? 'Expand timeline' : 'Minimize timeline'}
              >
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  {collapsed ? <path d="M3 7.5L6 4.5L9 7.5" /> : <path d="M3 4.5L6 7.5L9 4.5" />}
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Time ruler + tracks area (scrollable when zoomed). Hidden when the
          timeline is minimized — only the transport bar above stays visible. */}
      {!collapsed && (
      <div
        ref={tracksRef}
        className="relative overflow-x-auto overflow-y-hidden"
        onMouseDown={handleMouseDown}
      >
        <div style={{ width: 80 + scaledContentWidth }}>
          {/* Time ruler (offset by label column) */}
          <div className="flex">
            <div className="shrink-0" style={{ width: 80 }} />
            <TimeRuler durationInSeconds={durationInSeconds} width={scaledContentWidth} />
          </div>

          {/* Track rows */}
          {STUDIO_TRACKS.map((track, index) => {
            const clips =
              track.type === 'tsx' ? tsxSlots :
              track.type === 'video' ? videoClips :
              track.type === 'captions' ? captionClips :
              track.type === 'image' ? imageClips :
              track.type === 'text' ? textClips :
              track.type === 'sfx' ? sfxClips :
              track.type === 'music' ? musicClips :
              undefined;
            const onMoveClip =
              track.type === 'tsx' ? onMoveTsxSlot :
              track.type === 'video' ? onMoveVideoClip :
              track.type === 'captions' ? onMoveCaptionClip :
              track.type === 'image' ? onMoveImageClip :
              track.type === 'text' ? onMoveTextClip :
              track.type === 'sfx' || track.type === 'music' ? onMoveAudioClip :
              undefined;
            const onTrimClip =
              track.type === 'tsx' ? onTrimTsxSlot :
              track.type === 'video' ? onTrimVideoClip :
              track.type === 'captions' ? onTrimCaptionClip :
              track.type === 'image' ? onTrimImageClip :
              track.type === 'text' ? onTrimTextClip :
              track.type === 'sfx' || track.type === 'music' ? onTrimAudioClip :
              undefined;
            const onSwitchTrack =
              track.type === 'sfx' || track.type === 'music' ? onSwitchAudioClipTrack : undefined;
            const isSelectableTrack =
              track.type === 'video' || track.type === 'tsx' || track.type === 'captions' ||
              track.type === 'image' || track.type === 'text' || track.type === 'sfx' || track.type === 'music';
            const selectedClipId =
              isSelectableTrack && selectedClip?.trackType === track.type
                ? selectedClip.id
                : null;
            // Ids selected on THIS track (for highlighting every selected clip).
            const selectedClipIds =
              isSelectableTrack && selectedClips && selectedClips.length > 0
                ? new Set(
                    selectedClips.filter((s) => s.trackType === track.type).map((s) => s.id)
                  )
                : undefined;
            const onSelectClipForTrack = isSelectableTrack && onSelectClip
              ? (id: string | null, additive?: boolean) =>
                  onSelectClip(id ? { trackType: track.type as SelectableTrackType, id } : null, additive)
              : undefined;
            const onClipContextMenuForTrack = isSelectableTrack && onClipContextMenu
              ? (id: string, x: number, y: number) =>
                  onClipContextMenu({ trackType: track.type as SelectableTrackType, id }, x, y)
              : undefined;
            const isActive = activeTrackId === track.id;
            const onActivate = onActivateTrack
              ? () => onActivateTrack(isActive ? null : track.id)
              : undefined;
            return (
              <TrackRow
                key={track.id}
                track={track}
                isEven={index % 2 === 0}
                clips={clips}
                durationInSeconds={durationInSeconds}
                height={trackHeight}
                isHidden={hiddenTracks?.has(track.id) ?? false}
                isActive={isActive}
                hideFileNames={hideFileNames}
                hideWaveform={hideWaveform}
                selectedClipId={selectedClipId}
                selectedClipIds={selectedClipIds}
                isMultiSelect={(selectedClips?.length ?? 0) > 1}
                selectedAnimationId={selectedAnimationId}
                onSelectAnimation={isSelectableTrack ? onSelectAnimation : undefined}
                onUpdateAnimation={isSelectableTrack ? onUpdateAnimation : undefined}
                onToggleVisibility={onToggleTrackVisibility ? () => onToggleTrackVisibility(track.id) : undefined}
                onActivate={onActivate}
                onSelectClip={onSelectClipForTrack}
                onClipContextMenu={onClipContextMenuForTrack}
                onMoveClip={onMoveClip}
                onTrimClip={onTrimClip}
                onSwitchTrack={onSwitchTrack}
                onMoveSelectionStart={onMoveSelectionStart}
                onMoveSelectionBy={onMoveSelectionBy}
                onMoveSelectionEnd={onMoveSelectionEnd}
                onInteractStart={onClipInteractStart}
                onInteractEnd={onClipInteractEnd}
                hiddenChips={track.type === 'video' ? videoHiddenChips : undefined}
                onRestoreHidden={track.type === 'video' ? onRestoreVideoClip : undefined}
                onDeleteHidden={track.type === 'video' ? onDeleteVideoClip : undefined}
                pendingCuts={track.type === 'video' ? videoPendingCuts : undefined}
              />
            );
          })}
        </div>

        {/* Playhead */}
        {scaledContentWidth > 0 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: playheadX,
              width: 1,
              backgroundColor: 'var(--color-accent)',
              zIndex: 10,
            }}
          >
            {/* Playhead triangle */}
            <div
              className="absolute"
              style={{
                top: -1,
                left: -5,
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '6px solid var(--color-accent)',
              }}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
