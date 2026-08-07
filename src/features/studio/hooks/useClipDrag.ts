import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioClip, StudioTimeline, StudioTrack } from '../types';
import { clipEndTime, moveClip, trimClip } from '../services/timeline-ops';
import { collectSnapTargets, snapSeconds } from '../services/snapping';
import type { TimelineAction } from './useTimeline';
import type { ClipDragKind } from '../components/timeline/TimelineClip';

interface DragState {
  clipId: string;
  kind: ClipDragKind;
  pointerX: number;
  origin: StudioClip;
  originTrackId: string;
  snapTargets: number[];
  sourceDuration: number | undefined;
}

interface Options {
  timeline: StudioTimeline;
  pxPerSecond: number;
  snapEnabled: boolean;
  getPlayheadSeconds: () => number;
  sourceDurationOf: (clip: StudioClip) => number | undefined;
  lanesRef: React.RefObject<HTMLDivElement | null>;
  trackHeight: number;
  dispatch: React.Dispatch<TimelineAction>;
  onSelect: (clipId: string) => void;
}

function acceptsClip(track: StudioTrack, clip: StudioClip): boolean {
  if (track.locked) return false;
  if (clip.kind === 'audio' || clip.kind === 'sfx') return track.kind === 'audio';
  return track.kind !== 'audio';
}

/**
 * Clip dragging (move + trim) with live preview.
 *
 * The preview is produced by running the very same op the drop will commit,
 * against a throwaway copy of the document — so what you see mid-drag is
 * exactly what lands, including neighbour clamping, and none of that clamping
 * logic gets duplicated in the view layer.
 */
export function useClipDrag({
  timeline,
  pxPerSecond,
  snapEnabled,
  getPlayheadSeconds,
  sourceDurationOf,
  lanesRef,
  trackHeight,
  dispatch,
  onSelect,
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<{ timeline: StudioTimeline; guide: number | null } | null>(
    null,
  );
  const latestRef = useRef({ timeline, pxPerSecond, snapEnabled });
  latestRef.current = { timeline, pxPerSecond, snapEnabled };

  const resolveTargetTrack = useCallback(
    (clientY: number, clip: StudioClip, fallbackId: string): string => {
      const lanes = lanesRef.current;
      if (!lanes) return fallbackId;
      const rect = lanes.getBoundingClientRect();
      const index = Math.floor((clientY - rect.top) / trackHeight);
      const track = latestRef.current.timeline.tracks[index];
      if (!track || !acceptsClip(track, clip)) return fallbackId;
      return track.id;
    },
    [lanesRef, trackHeight],
  );

  const computePreview = useCallback(
    (drag: DragState, clientX: number, clientY: number) => {
      const { timeline: current, pxPerSecond: pps, snapEnabled: snap } = latestRef.current;
      const deltaSeconds = (clientX - drag.pointerX) / pps;
      const origin = drag.origin;
      const originEnd = clipEndTime(origin);

      if (drag.kind === 'move') {
        const raw = Math.max(0, origin.timelineStart + deltaSeconds);
        const { seconds, snappedTo } = snap
          ? snapSeconds(raw, drag.snapTargets, pps, origin.duration)
          : { seconds: raw, snappedTo: null };
        const trackId = resolveTargetTrack(clientY, origin, drag.originTrackId);
        return {
          timeline: moveClip(current, drag.clipId, seconds, trackId),
          guide: snappedTo,
        };
      }

      const rawEdge =
        drag.kind === 'trim-start'
          ? origin.timelineStart + deltaSeconds
          : originEnd + deltaSeconds;
      const { seconds, snappedTo } = snap
        ? snapSeconds(rawEdge, drag.snapTargets, pps)
        : { seconds: rawEdge, snappedTo: null };
      return {
        timeline: trimClip(
          current,
          drag.clipId,
          drag.kind === 'trim-start' ? 'start' : 'end',
          seconds,
          drag.sourceDuration,
        ),
        guide: snappedTo,
      };
    },
    [resolveTargetTrack],
  );

  const onClipPointerDown = useCallback(
    (event: React.PointerEvent, clip: StudioClip, kind: ClipDragKind) => {
      if (event.button !== 0) return;
      event.preventDefault();
      onSelect(clip.id);

      const track = latestRef.current.timeline.tracks.find((t) =>
        t.clips.some((c) => c.id === clip.id),
      );
      if (!track || track.locked) return;

      dragRef.current = {
        clipId: clip.id,
        kind,
        pointerX: event.clientX,
        origin: clip,
        originTrackId: track.id,
        snapTargets: collectSnapTargets(
          latestRef.current.timeline,
          getPlayheadSeconds(),
          clip.id,
        ),
        sourceDuration: sourceDurationOf(clip),
      };
    },
    [getPlayheadSeconds, onSelect, sourceDurationOf],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPreview(computePreview(drag, event.clientX, event.clientY));
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      setPreview(null);

      // A click that never moved just selects — committing it would add an
      // undo step that changes nothing.
      if (Math.abs(event.clientX - drag.pointerX) < 2) return;

      const { pxPerSecond: pps, snapEnabled: snap } = latestRef.current;
      const deltaSeconds = (event.clientX - drag.pointerX) / pps;
      const origin = drag.origin;

      if (drag.kind === 'move') {
        const raw = Math.max(0, origin.timelineStart + deltaSeconds);
        const seconds = snap
          ? snapSeconds(raw, drag.snapTargets, pps, origin.duration).seconds
          : raw;
        dispatch({
          type: 'move',
          clipId: drag.clipId,
          seconds,
          toTrackId: resolveTargetTrack(event.clientY, origin, drag.originTrackId),
        });
        return;
      }

      const rawEdge =
        drag.kind === 'trim-start'
          ? origin.timelineStart + deltaSeconds
          : clipEndTime(origin) + deltaSeconds;
      const seconds = snap ? snapSeconds(rawEdge, drag.snapTargets, pps).seconds : rawEdge;
      dispatch({
        type: 'trim',
        clipId: drag.clipId,
        edge: drag.kind === 'trim-start' ? 'start' : 'end',
        seconds,
        ...(drag.sourceDuration !== undefined ? { sourceDuration: drag.sourceDuration } : {}),
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [computePreview, dispatch, resolveTargetTrack]);

  return {
    /** Timeline to render while a drag is in flight (null when idle). */
    previewTimeline: preview?.timeline ?? null,
    snapGuideSeconds: preview?.guide ?? null,
    onClipPointerDown,
  };
}
