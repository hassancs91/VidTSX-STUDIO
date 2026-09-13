import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioClip, StudioTimeline, StudioTrack } from '../types';
import { clipEndTime, moveClip, trimClip } from '../services/timeline-ops';
import { updateClip } from '../services/clip-update-ops';
import { moveClips } from '../services/timeline-group-ops';
import { trimClipRippleAll } from '../services/ripple-ops';
import { collectSnapTargets, snapSeconds } from '../services/snapping';
import type { TimelineAction } from './useTimeline';
import type { ClipDragKind } from '../components/timeline/TimelineClip';

interface DragState {
  clipId: string;
  kind: ClipDragKind;
  pointerX: number;
  pointerY: number;
  origin: StudioClip;
  originTrackId: string;
  snapTargets: number[];
  sourceDuration: number | undefined;
  /** Non-null → this drag moves the whole selection as a group. */
  groupIds: string[] | null;
  /** Clip was already in a multi-selection: a no-move click collapses to it. */
  pendingCollapse: boolean;
  /** Lane the preview last showed the clip on — the drop commits THIS, not a
   *  re-resolution from the pointerup coords, so boundary jitter between the
   *  last move and the release can't flip the outcome. */
  lastTargetTrackId: string | null;
}

interface Options {
  timeline: StudioTimeline;
  pxPerSecond: number;
  snapEnabled: boolean;
  /** Ripple mode 'all': trimming a master-lane edge moves every unlocked track with it. */
  rippleAllTracks: boolean;
  selectedClipIds: string[];
  getPlayheadSeconds: () => number;
  sourceDurationOf: (clip: StudioClip) => number | undefined;
  lanesRef: React.RefObject<HTMLDivElement | null>;
  trackHeight: number;
  dispatch: React.Dispatch<TimelineAction>;
  onSelect: (clipId: string) => void;
  onToggleSelect: (clipId: string) => void;
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
  rippleAllTracks,
  selectedClipIds,
  getPlayheadSeconds,
  sourceDurationOf,
  lanesRef,
  trackHeight,
  dispatch,
  onSelect,
  onToggleSelect,
}: Options) {
  const dragRef = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<{ timeline: StudioTimeline; guide: number | null } | null>(
    null,
  );
  const latestRef = useRef({ timeline, pxPerSecond, snapEnabled, rippleAllTracks, selectedClipIds });
  latestRef.current = { timeline, pxPerSecond, snapEnabled, rippleAllTracks, selectedClipIds };

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
      const {
        timeline: current,
        pxPerSecond: pps,
        snapEnabled: snap,
        rippleAllTracks: rippleAll,
      } = latestRef.current;
      const deltaSeconds = (clientX - drag.pointerX) / pps;
      const origin = drag.origin;
      const originEnd = clipEndTime(origin);

      if (drag.kind === 'move') {
        const raw = Math.max(0, origin.timelineStart + deltaSeconds);
        const { seconds, snappedTo } = snap
          ? snapSeconds(raw, drag.snapTargets, pps, origin.duration)
          : { seconds: raw, snappedTo: null };
        if (drag.groupIds) {
          // Group move: one shared delta, no track hopping — the group op
          // clamps everyone against unselected neighbours.
          return {
            timeline: moveClips(current, drag.groupIds, seconds - origin.timelineStart),
            guide: snappedTo,
          };
        }
        const trackId = resolveTargetTrack(clientY, origin, drag.originTrackId);
        drag.lastTargetTrackId = trackId;
        return {
          timeline: moveClip(current, drag.clipId, seconds, trackId),
          guide: snappedTo,
        };
      }

      if (drag.kind === 'fade-in' || drag.kind === 'fade-out') {
        // Fade handles drag a LENGTH, not an edge — no snapping. The op
        // clamps to the fade invariant, so the preview shows the real result.
        const patch =
          drag.kind === 'fade-in'
            ? { fadeInSec: (origin.fadeInSec ?? 0) + deltaSeconds }
            : { fadeOutSec: (origin.fadeOutSec ?? 0) - deltaSeconds };
        return { timeline: updateClip(current, drag.clipId, patch), guide: null };
      }

      const rawEdge =
        drag.kind === 'trim-start'
          ? origin.timelineStart + deltaSeconds
          : originEnd + deltaSeconds;
      const { seconds, snappedTo } = snap
        ? snapSeconds(rawEdge, drag.snapTargets, pps)
        : { seconds: rawEdge, snappedTo: null };
      return {
        timeline: (rippleAll ? trimClipRippleAll : trimClip)(
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

      // Ctrl/⌘/Shift-click edits the selection and never starts a drag.
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        onToggleSelect(clip.id);
        return;
      }

      const selection = latestRef.current.selectedClipIds;
      const inGroup = selection.length > 1 && selection.includes(clip.id);
      // Grabbing a clip of a multi-selection keeps the group (so it can be
      // dragged); everything else collapses the selection to this clip.
      // Trims are single-clip edits by nature.
      const groupIds = inGroup && kind === 'move' ? [...selection] : null;
      if (!groupIds) onSelect(clip.id);

      const track = latestRef.current.timeline.tracks.find((t) =>
        t.clips.some((c) => c.id === clip.id),
      );
      if (!track || track.locked) return;

      dragRef.current = {
        clipId: clip.id,
        kind,
        pointerX: event.clientX,
        pointerY: event.clientY,
        origin: clip,
        originTrackId: track.id,
        snapTargets: collectSnapTargets(
          latestRef.current.timeline,
          getPlayheadSeconds(),
          clip.id,
        ),
        sourceDuration: sourceDurationOf(clip),
        groupIds,
        pendingCollapse: groupIds !== null,
        lastTargetTrackId: null,
      };
    },
    [getPlayheadSeconds, onSelect, onToggleSelect, sourceDurationOf],
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
      // undo step that changes nothing. On a multi-selection this is the
      // moment the selection collapses to the clicked clip. Moves must check
      // BOTH axes: dragging a clip straight down to another lane is a real
      // move with near-zero horizontal delta. Trims only ever use X.
      const noMove =
        Math.abs(event.clientX - drag.pointerX) < 2 &&
        (drag.kind !== 'move' || Math.abs(event.clientY - drag.pointerY) < 2);
      if (noMove) {
        if (drag.pendingCollapse) onSelect(drag.clipId);
        return;
      }

      const { pxPerSecond: pps, snapEnabled: snap } = latestRef.current;
      const deltaSeconds = (event.clientX - drag.pointerX) / pps;
      const origin = drag.origin;

      if (drag.kind === 'move') {
        const raw = Math.max(0, origin.timelineStart + deltaSeconds);
        const seconds = snap
          ? snapSeconds(raw, drag.snapTargets, pps, origin.duration).seconds
          : raw;
        if (drag.groupIds) {
          dispatch({
            type: 'move-clips',
            clipIds: drag.groupIds,
            deltaSeconds: seconds - origin.timelineStart,
          });
          return;
        }
        const toTrackId =
          drag.lastTargetTrackId ??
          resolveTargetTrack(event.clientY, origin, drag.originTrackId);
        // A purely vertical wobble that resolved back to the same lane and
        // time is a no-op — don't burn an undo step on it.
        if (toTrackId === drag.originTrackId && seconds === origin.timelineStart) return;
        dispatch({ type: 'move', clipId: drag.clipId, seconds, toTrackId });
        return;
      }

      if (drag.kind === 'fade-in' || drag.kind === 'fade-out') {
        dispatch({
          type: 'update-clip',
          clipId: drag.clipId,
          patch:
            drag.kind === 'fade-in'
              ? { fadeInSec: (origin.fadeInSec ?? 0) + deltaSeconds }
              : { fadeOutSec: (origin.fadeOutSec ?? 0) - deltaSeconds },
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
        ...(latestRef.current.rippleAllTracks ? { rippleAllTracks: true } : {}),
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [computePreview, dispatch, resolveTargetTrack, onSelect]);

  return {
    /** Timeline to render while a drag is in flight (null when idle). */
    previewTimeline: preview?.timeline ?? null,
    snapGuideSeconds: preview?.guide ?? null,
    onClipPointerDown,
  };
}
