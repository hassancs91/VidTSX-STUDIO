import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { timelineDuration } from '@shared/studio';
import type { StudioClip, StudioProject, StudioTrack } from '../types';
import type { UseTimelineResult } from '../hooks/useTimeline';
import type { UsePlaybackResult } from '../hooks/usePlayback';
import type { PreviewTimeMap } from '../services/preview-mapping';
import { useClipDrag } from '../hooks/useClipDrag';
import { useClipboard } from '../hooks/useClipboard';
import { useMarqueeSelect } from '../hooks/useMarqueeSelect';
import { useAssetTranscripts } from '../hooks/useAssetTranscripts';
import { usePlayheadFollow } from '../hooks/usePlayheadFollow';
import { useTimelineShortcuts } from '../hooks/useTimelineShortcuts';
import { clipAt, clipEndTime, findClip, makeClipId } from '../services/timeline-ops';
import { makeMarkerId } from '../services/marker-ops';
import { trackMenuItems } from '../services/track-menu';
import {
  DEFAULT_ZOOM_INDEX,
  RULER_HEIGHT,
  TRACK_HEADER_WIDTH,
  TRACK_HEIGHT,
  ZOOM_LEVELS,
  secondsToPx,
} from '../services/timeline-view';
import { ClipContextMenu } from './timeline/ClipContextMenu';
import { FloatingMenu, type FloatingMenuItem } from './timeline/FloatingMenu';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineToolbar } from './timeline/TimelineToolbar';
import { TimelinePlayhead } from './timeline/TimelinePlayhead';
import { TimelineLanes } from './timeline/TimelineLanes';
import { TrackHeader } from './timeline/TrackHeader';
import { AddTrackButton } from './timeline/AddTrackButton';
import { CutRegionLayer } from './timeline/CutRegionLayer';
import type { ClipWaveformData } from './timeline/TimelineClip';

interface Props {
  project: StudioProject;
  tl: UseTimelineResult;
  playback: UsePlaybackResult;
  /** Present while the Player previews the cut result — translates its clock
   *  into display (original-timeline) coordinates and back. */
  timeMap?: PreviewTimeMap | null;
  getThumbnail: (assetId: string) => string | null;
  getWaveform: (assetId: string) => ClipWaveformData | null;
  /** Export range points (Slice D2) — owned by EditorShell, shown on the ruler. */
  rangeIn: number | null;
  rangeOut: number | null;
  onRangeChange: (edge: 'in' | 'out', seconds: number | null) => void;
  /** Assets whose source file is missing (Slice F) — clips get a warning tint. */
  missingAssetIds: ReadonlySet<string>;
  /** Panel height in px — user-resizable via the divider above (EditorShell). */
  heightPx: number;
}

/** Extra runway past the last clip so there's always somewhere to drag to. */
const TAIL_SECONDS = 10;

export function TimelinePanel({
  project,
  tl,
  playback: rawPlayback,
  timeMap,
  getThumbnail,
  getWaveform,
  rangeIn,
  rangeOut,
  onRangeChange,
  missingAssetIds,
  heightPx,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);

  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [snapEnabled, setSnapEnabled] = useState(true);
  // "Auto ripple": whether deleting closes the gap. Governs the Delete key and
  // the toolbar delete button (single or multi-selection alike); Backspace is
  // the explicit leave-the-gap delete regardless of the mode.
  const [rippleEnabled, setRippleEnabled] = useState(true);
  const [viewport, setViewport] = useState({ left: 0, top: 0, width: 1200 });
  const pxPerSecond = ZOOM_LEVELS[zoomIndex];

  // Preview-result shim: everything in this panel (playhead, clock, ruler
  // seeks, split-at-playhead, zoom anchor) works in DISPLAY coordinates —
  // the original timeline — while the Player itself runs on the cut result.
  const displaySecondsRef = useRef(0);
  useEffect(() => {
    if (!timeMap) return;
    return rawPlayback.subscribe((s) => {
      displaySecondsRef.current = timeMap.toOriginal(s);
    });
  }, [rawPlayback, timeMap]);
  const playback = useMemo<UsePlaybackResult>(() => {
    if (!timeMap) return rawPlayback;
    return {
      ...rawPlayback,
      secondsRef: displaySecondsRef,
      subscribe: (listener) => rawPlayback.subscribe((s) => listener(timeMap.toOriginal(s))),
      seek: (s) => rawPlayback.seek(timeMap.toResult(s)),
    };
  }, [rawPlayback, timeMap]);

  const assetById = useMemo(
    () => new Map(project.assets.map((a) => [a.id, a])),
    [project.assets],
  );

  const sourceDurationOf = useCallback(
    (clip: StudioClip) => {
      if (!clip.assetId) return undefined;
      const asset = assetById.get(clip.assetId);
      return asset && asset.kind !== 'image' ? asset.probe.duration : undefined;
    },
    [assetById],
  );

  // Review mode: transcript words for the assets the open proposal cuts —
  // they drive word-boundary snapping while dragging a cut's edges.
  const reviewAssets = useMemo(() => {
    if (!tl.activeProposal) return [];
    const ids = new Set(tl.activeProposal.items.map((i) => i.assetId).filter(Boolean));
    return project.assets.filter((a) => ids.has(a.id));
  }, [tl.activeProposal, project.assets]);
  const wordsByAsset = useAssetTranscripts(project.id, reviewAssets);
  const assetDurationOf = useCallback(
    (assetId: string) => assetById.get(assetId)?.probe.duration,
    [assetById],
  );

  const getPlayheadSeconds = useCallback(
    () => playback.secondsRef.current,
    [playback.secondsRef],
  );

  const { previewTimeline, snapGuideSeconds, onClipPointerDown } = useClipDrag({
    timeline: tl.timeline,
    pxPerSecond,
    snapEnabled,
    selectedClipIds: tl.selectedClipIds,
    getPlayheadSeconds,
    sourceDurationOf,
    lanesRef,
    trackHeight: TRACK_HEIGHT,
    dispatch: tl.dispatch,
    onSelect: tl.select,
    onToggleSelect: tl.toggleSelect,
  });

  // Right-click menu on a clip. Detach audio is the only entry so far — the
  // renderer-built FloatingMenu closes over document state and stays CDP-able.
  const [clipMenu, setClipMenu] = useState<{ x: number; y: number; clip: StudioClip } | null>(
    null,
  );
  const onClipContextMenu = useCallback(
    (event: React.MouseEvent, clip: StudioClip) => {
      event.preventDefault();
      tl.select(clip.id);
      if (clip.kind !== 'video') return;
      setClipMenu({ x: event.clientX, y: event.clientY, clip });
    },
    [tl],
  );
  const detachAudioFromMenu = useCallback(
    (clip: StudioClip) => {
      const newClipId = makeClipId();
      tl.dispatch({ type: 'detach-audio', clipId: clip.id, newClipId });
      // Selection self-prunes if the op rejected, so this is safe either way.
      tl.select(newClipId);
    },
    [tl],
  );

  // Transition picker (Slice E): the join square at a contiguous boundary
  // opens a preset menu acting on the LEADING clip's transitionOut.
  const [joinMenu, setJoinMenu] = useState<{ x: number; y: number; clip: StudioClip } | null>(
    null,
  );
  const onJoinClick = useCallback((event: React.MouseEvent, clip: StudioClip) => {
    setJoinMenu({ x: event.clientX, y: event.clientY, clip });
  }, []);
  const joinMenuItems: FloatingMenuItem[] = useMemo(
    () => [
      { id: 'crossfade-0.5', label: 'Crossfade · 0.5 s' },
      { id: 'crossfade-1', label: 'Crossfade · 1 s' },
      { id: 'dip-to-black-0.5', label: 'Dip to black · 0.5 s' },
      { id: 'dip-to-black-1', label: 'Dip to black · 1 s' },
      ...(joinMenu?.clip.transitionOut
        ? [{ id: 'remove', label: 'Remove transition', danger: true }]
        : []),
    ],
    [joinMenu],
  );
  const onJoinPick = useCallback(
    (id: string) => {
      if (!joinMenu) return;
      if (id === 'remove') {
        tl.dispatch({ type: 'transition-remove', clipId: joinMenu.clip.id });
        return;
      }
      const [kind, duration] =
        id === 'crossfade-0.5'
          ? (['crossfade', 0.5] as const)
          : id === 'crossfade-1'
            ? (['crossfade', 1] as const)
            : id === 'dip-to-black-0.5'
              ? (['dip-to-black', 0.5] as const)
              : (['dip-to-black', 1] as const);
      tl.dispatch({ type: 'transition-set', clipId: joinMenu.clip.id, kind, duration });
    },
    [joinMenu, tl],
  );

  const clearSelection = useCallback(() => tl.select(null), [tl]);
  const { marqueeRect, onLanePointerDown } = useMarqueeSelect({
    timeline: tl.timeline,
    pxPerSecond,
    trackHeight: TRACK_HEIGHT,
    lanesRef,
    selectedClipIds: tl.selectedClipIds,
    selectMany: tl.selectMany,
    clearSelection,
  });

  const timeline = previewTimeline ?? tl.timeline;
  const durationSeconds = timelineDuration(timeline);
  const contentSeconds = Math.max(
    durationSeconds + TAIL_SECONDS,
    viewport.width / pxPerSecond,
  );
  const widthPx = Math.ceil(secondsToPx(contentSeconds, pxPerSecond));
  const lanesHeight = timeline.tracks.length * TRACK_HEIGHT;

  // Only draw clips near the viewport — a long auto-cut timeline can hold
  // hundreds, and off-screen canvases are pure cost.
  const visibleFrom = viewport.left / pxPerSecond - contentSeconds * 0.1;
  const visibleTo = (viewport.left + viewport.width) / pxPerSecond + contentSeconds * 0.1;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let queued = false;
    const measure = () => {
      queued = false;
      setViewport({ left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth });
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const seconds = (clientX - rect.left + el.scrollLeft) / pxPerSecond;
      playback.seek(Math.max(0, seconds));
    },
    [playback, pxPerSecond],
  );

  const onScrubPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      seekFromPointer(event.clientX);
      const onMove = (e: PointerEvent) => seekFromPointer(e.clientX);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [seekFromPointer],
  );

  const splitAtPlayhead = useCallback(() => {
    const seconds = playback.secondsRef.current;
    const selected = tl.selectedClipId ? findClip(tl.timeline, tl.selectedClipId) : null;
    if (
      selected &&
      seconds > selected.clip.timelineStart &&
      seconds < clipEndTime(selected.clip)
    ) {
      tl.dispatch({ type: 'split', clipId: selected.clip.id, seconds });
      return;
    }
    for (const track of tl.timeline.tracks) {
      const clip = clipAt(track, seconds);
      if (clip) {
        tl.dispatch({ type: 'split', clipId: clip.id, seconds });
        return;
      }
    }
  }, [playback.secondsRef, tl]);

  // Zoom around the playhead: without this, zooming into a long edit throws
  // the part you were working on off-screen.
  const zoomBy = useCallback(
    (delta: number) => {
      setZoomIndex((current) => {
        const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, current + delta));
        const el = scrollRef.current;
        if (next !== current && el) {
          const anchor = playback.secondsRef.current;
          const screenX = secondsToPx(anchor, ZOOM_LEVELS[current]) - el.scrollLeft;
          requestAnimationFrame(() => {
            el.scrollLeft = Math.max(0, secondsToPx(anchor, ZOOM_LEVELS[next]) - screenX);
          });
        }
        return next;
      });
    },
    [playback.secondsRef],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    },
    [zoomBy],
  );

  /** Shift+Z / toolbar: the zoom step that shows the whole edit, anchored at 0. */
  const zoomToFit = useCallback(() => {
    const el = scrollRef.current;
    const duration = timelineDuration(tl.timeline);
    if (!el || duration <= 0) return;
    let index = 0;
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
      if (duration * ZOOM_LEVELS[i] <= el.clientWidth) {
        index = i;
        break;
      }
    }
    setZoomIndex(index);
    requestAnimationFrame(() => {
      el.scrollLeft = 0;
    });
  }, [tl.timeline]);

  usePlayheadFollow({
    scrollRef,
    playback,
    isPlaying: playback.isPlaying,
    pxPerSecond,
  });

  const clipboard = useClipboard(tl);
  const pasteAtPlayhead = useCallback(
    () => clipboard.paste(playback.secondsRef.current),
    [clipboard, playback.secondsRef],
  );

  // M — marker at the playhead (display coords, like every panel gesture).
  const addMarkerAtPlayhead = useCallback(() => {
    tl.dispatch({ type: 'marker-add', id: makeMarkerId(), time: playback.secondsRef.current });
  }, [tl, playback.secondsRef]);

  // I / O — export range point at the playhead; Shift clears the point.
  const setRangePoint = useCallback(
    (edge: 'in' | 'out', clear: boolean) => {
      onRangeChange(edge, clear ? null : playback.secondsRef.current);
    },
    [onRangeChange, playback.secondsRef],
  );

  useTimelineShortcuts({
    containerRef,
    tl,
    playback,
    fps: project.settings.fps,
    durationSeconds,
    rippleDelete: rippleEnabled,
    onSplit: splitAtPlayhead,
    onCopy: clipboard.copy,
    onPaste: pasteAtPlayhead,
    onDuplicate: clipboard.duplicate,
    onZoomToFit: zoomToFit,
    onAddMarker: addMarkerAtPlayhead,
    onSetRangePoint: setRangePoint,
  });

  const clipLabel = useCallback(
    (clip: StudioClip): string => {
      if (clip.label) return clip.label;
      const asset = clip.assetId ? assetById.get(clip.assetId) : undefined;
      if (asset) return asset.path.split(/[\\/]/).pop() ?? asset.path;
      return clip.kind;
    },
    [assetById],
  );

  // Track options from the LANE background too — the header cell is narrow
  // and its right-click affordance went unnoticed (Hasan, 2026-08-14).
  // Rename is forwarded to the header, where the inline editor lives.
  const [trackMenu, setTrackMenu] = useState<{ x: number; y: number; trackId: string } | null>(
    null,
  );
  const [renameTrackId, setRenameTrackId] = useState<string | null>(null);
  const onLaneContextMenu = useCallback(
    (event: React.MouseEvent, track: StudioTrack) => {
      event.preventDefault();
      tl.selectTrack(track.id);
      setTrackMenu({ x: event.clientX, y: event.clientY, trackId: track.id });
    },
    [tl],
  );
  const menuTrackIndex = trackMenu
    ? timeline.tracks.findIndex((t) => t.id === trackMenu.trackId)
    : -1;
  const menuTrack = menuTrackIndex >= 0 ? timeline.tracks[menuTrackIndex] : null;

  return (
    <div
      ref={containerRef}
      className="shrink-0 flex flex-col bg-app-deep select-none"
      style={{ height: heightPx, borderTop: '0.5px solid var(--color-border)' }}
    >
      <TimelineToolbar
        subscribe={playback.subscribe}
        durationSeconds={durationSeconds}
        fps={project.settings.fps}
        canUndo={tl.canUndo}
        canRedo={tl.canRedo}
        hasSelection={tl.selectedClipIds.length > 0}
        snapEnabled={snapEnabled}
        rippleEnabled={rippleEnabled}
        canZoomIn={zoomIndex < ZOOM_LEVELS.length - 1}
        canZoomOut={zoomIndex > 0}
        onUndo={tl.undo}
        onRedo={tl.redo}
        onSplit={splitAtPlayhead}
        onDelete={() => tl.removeSelected(rippleEnabled)}
        onToggleRipple={() => setRippleEnabled((v) => !v)}
        onToggleSnap={() => setSnapEnabled((v) => !v)}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onZoomToFit={zoomToFit}
      />

      <div className="flex flex-1 min-h-0">
        <div
          className="shrink-0 bg-app-surface overflow-hidden"
          style={{ width: TRACK_HEADER_WIDTH, borderRight: '0.5px solid var(--color-border)' }}
        >
          <div
            className="flex items-center px-1"
            style={{ height: RULER_HEIGHT, borderBottom: '0.5px solid var(--color-border)' }}
          >
            <AddTrackButton onAdd={(kind) => tl.dispatch({ type: 'track-add', kind })} />
          </div>
          {/* Follows the lanes' vertical scroll (the ruler is sticky, headers
              can't be — they live in a sibling column). */}
          <div style={{ transform: `translateY(${-viewport.top}px)` }}>
            {timeline.tracks.map((track, index) => (
              <TrackHeader
                key={track.id}
                track={track}
                index={index}
                trackCount={timeline.tracks.length}
                selected={track.id === tl.selectedTrackId}
                onSelect={tl.selectTrack}
                dispatch={tl.dispatch}
                renameRequested={renameTrackId === track.id}
                onRenameRequestHandled={() => setRenameTrackId(null)}
              />
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto relative" onWheel={onWheel}>
          <div className="relative" style={{ width: widthPx }}>
            <div onPointerDown={onScrubPointerDown} className="cursor-ew-resize">
              <TimelineRuler
                durationSeconds={contentSeconds}
                pxPerSecond={pxPerSecond}
                widthPx={widthPx}
                markers={timeline.markers ?? []}
                onMarkerSeek={playback.seek}
                onMarkerMove={(markerId, time) =>
                  tl.dispatch({ type: 'marker-move', markerId, time })
                }
                onMarkerRename={(markerId, label) =>
                  tl.dispatch({ type: 'marker-rename', markerId, label })
                }
                onMarkerRemove={(markerId) => tl.dispatch({ type: 'marker-remove', markerId })}
                rangeIn={rangeIn}
                rangeOut={rangeOut}
              />
            </div>

            <div ref={lanesRef} className="relative" style={{ height: lanesHeight }}>
              <TimelineLanes
                timeline={timeline}
                pxPerSecond={pxPerSecond}
                selectedClipIds={tl.selectedClipIds}
                visibleFrom={visibleFrom}
                visibleTo={visibleTo}
                labelFor={clipLabel}
                getThumbnail={getThumbnail}
                getWaveform={getWaveform}
                onClipPointerDown={onClipPointerDown}
                onClipContextMenu={onClipContextMenu}
                onLanePointerDown={onLanePointerDown}
                onLaneContextMenu={onLaneContextMenu}
                onJoinClick={onJoinClick}
                missingAssetIds={missingAssetIds}
              />
              {marqueeRect && (
                <div
                  className="absolute z-20 pointer-events-none rounded-[2px]"
                  style={{
                    left: marqueeRect.left,
                    top: marqueeRect.top,
                    width: marqueeRect.width,
                    height: marqueeRect.height,
                    border: '1px dashed var(--color-accent-light)',
                    background: 'rgba(127, 119, 221, 0.12)',
                  }}
                />
              )}
              {tl.activeProposal && (
                <CutRegionLayer
                  timeline={timeline}
                  proposal={tl.activeProposal}
                  pxPerSecond={pxPerSecond}
                  visibleFrom={visibleFrom}
                  visibleTo={visibleTo}
                  selectedCutId={tl.selectedCutId}
                  wordsByAsset={wordsByAsset}
                  sourceDurationOf={assetDurationOf}
                  onSelectCut={tl.selectCut}
                  onSeek={playback.seek}
                  dispatch={tl.dispatch}
                />
              )}
            </div>

            {snapGuideSeconds !== null && (
              <div
                className="absolute top-0 w-px bg-accent-light/70 pointer-events-none z-20"
                style={{
                  left: secondsToPx(snapGuideSeconds, pxPerSecond),
                  height: RULER_HEIGHT + lanesHeight,
                }}
              />
            )}

            <TimelinePlayhead
              subscribe={playback.subscribe}
              pxPerSecond={pxPerSecond}
              heightPx={RULER_HEIGHT + lanesHeight}
            />
          </div>

          {durationSeconds === 0 && (
            <div className="absolute inset-x-0 bottom-3 text-center text-[10px] text-text-ghost pointer-events-none">
              Add media from the pool (＋ on a card) to start the edit
            </div>
          )}
        </div>
      </div>

      {joinMenu && (
        <FloatingMenu
          x={joinMenu.x}
          y={joinMenu.y}
          items={joinMenuItems}
          onPick={onJoinPick}
          onClose={() => setJoinMenu(null)}
        />
      )}

      {trackMenu && menuTrack && (
        <FloatingMenu
          x={trackMenu.x}
          y={trackMenu.y}
          items={trackMenuItems(menuTrack, menuTrackIndex, timeline.tracks.length)}
          onPick={(id) => {
            if (id === 'rename') setRenameTrackId(menuTrack.id);
            else if (id === 'up')
              tl.dispatch({ type: 'track-move', trackId: menuTrack.id, direction: -1 });
            else if (id === 'down')
              tl.dispatch({ type: 'track-move', trackId: menuTrack.id, direction: 1 });
            else if (id === 'delete') tl.dispatch({ type: 'track-remove', trackId: menuTrack.id });
          }}
          onClose={() => setTrackMenu(null)}
        />
      )}

      {clipMenu && (
        <ClipContextMenu
          x={clipMenu.x}
          y={clipMenu.y}
          clip={clipMenu.clip}
          assetHasAudio={
            clipMenu.clip.assetId === undefined ||
            assetById.get(clipMenu.clip.assetId)?.probe.hasAudio !== false
          }
          onDetachAudio={detachAudioFromMenu}
          onClose={() => setClipMenu(null)}
        />
      )}
    </div>
  );
}
