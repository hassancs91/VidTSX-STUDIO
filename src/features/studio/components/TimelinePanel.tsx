import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { timelineDuration } from '@shared/studio';
import type { StudioClip, StudioProject } from '../types';
import type { UseTimelineResult } from '../hooks/useTimeline';
import type { UsePlaybackResult } from '../hooks/usePlayback';
import { useClipDrag } from '../hooks/useClipDrag';
import { useTimelineShortcuts } from '../hooks/useTimelineShortcuts';
import { clipAt, clipEndTime, findClip } from '../services/timeline-ops';
import {
  DEFAULT_ZOOM_INDEX,
  RULER_HEIGHT,
  TRACK_HEADER_WIDTH,
  TRACK_HEIGHT,
  ZOOM_LEVELS,
  secondsToPx,
} from '../services/timeline-view';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineToolbar } from './timeline/TimelineToolbar';
import { TimelinePlayhead } from './timeline/TimelinePlayhead';
import { TimelineLanes, TrackHeader } from './timeline/TimelineLanes';
import type { ClipWaveformData } from './timeline/TimelineClip';

interface Props {
  project: StudioProject;
  tl: UseTimelineResult;
  playback: UsePlaybackResult;
  getThumbnail: (assetId: string) => string | null;
  getWaveform: (assetId: string) => ClipWaveformData | null;
}

/** Extra runway past the last clip so there's always somewhere to drag to. */
const TAIL_SECONDS = 10;

export function TimelinePanel({ project, tl, playback, getThumbnail, getWaveform }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);

  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [viewport, setViewport] = useState({ left: 0, width: 1200 });
  const pxPerSecond = ZOOM_LEVELS[zoomIndex];

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

  const getPlayheadSeconds = useCallback(
    () => playback.secondsRef.current,
    [playback.secondsRef],
  );

  const { previewTimeline, snapGuideSeconds, onClipPointerDown } = useClipDrag({
    timeline: tl.timeline,
    pxPerSecond,
    snapEnabled,
    getPlayheadSeconds,
    sourceDurationOf,
    lanesRef,
    trackHeight: TRACK_HEIGHT,
    dispatch: tl.dispatch,
    onSelect: tl.select,
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
      setViewport({ left: el.scrollLeft, width: el.clientWidth });
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

  useTimelineShortcuts({
    containerRef,
    tl,
    playback,
    fps: project.settings.fps,
    durationSeconds,
    onSplit: splitAtPlayhead,
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

  return (
    <div
      ref={containerRef}
      className="h-[240px] shrink-0 flex flex-col bg-app-deep"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      <TimelineToolbar
        subscribe={playback.subscribe}
        durationSeconds={durationSeconds}
        fps={project.settings.fps}
        canUndo={tl.canUndo}
        canRedo={tl.canRedo}
        hasSelection={tl.selectedClipId !== null}
        snapEnabled={snapEnabled}
        canZoomIn={zoomIndex < ZOOM_LEVELS.length - 1}
        canZoomOut={zoomIndex > 0}
        onUndo={tl.undo}
        onRedo={tl.redo}
        onSplit={splitAtPlayhead}
        onRippleDelete={() => tl.selectedClipId && tl.remove(tl.selectedClipId, true)}
        onToggleSnap={() => setSnapEnabled((v) => !v)}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
      />

      <div className="flex flex-1 min-h-0">
        <div
          className="shrink-0 bg-app-surface overflow-hidden"
          style={{ width: TRACK_HEADER_WIDTH, borderRight: '0.5px solid var(--color-border)' }}
        >
          <div style={{ height: RULER_HEIGHT, borderBottom: '0.5px solid var(--color-border)' }} />
          {timeline.tracks.map((track) => (
            <TrackHeader key={track.id} track={track} />
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto relative" onWheel={onWheel}>
          <div className="relative" style={{ width: widthPx }}>
            <div onPointerDown={onScrubPointerDown} className="cursor-ew-resize">
              <TimelineRuler
                durationSeconds={contentSeconds}
                pxPerSecond={pxPerSecond}
                widthPx={widthPx}
              />
            </div>

            <div ref={lanesRef} style={{ height: lanesHeight }}>
              <TimelineLanes
                timeline={timeline}
                pxPerSecond={pxPerSecond}
                selectedClipId={tl.selectedClipId}
                visibleFrom={visibleFrom}
                visibleTo={visibleTo}
                labelFor={clipLabel}
                getThumbnail={getThumbnail}
                getWaveform={getWaveform}
                onClipPointerDown={onClipPointerDown}
                onDeselect={() => tl.select(null)}
              />
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
    </div>
  );
}
