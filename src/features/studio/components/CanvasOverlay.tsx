// Canvas manipulation overlay (lean slice, 2026-08-14): rendered over the
// Player, it turns the selected clip's transform into a draggable bounding
// box — drag to move, corner handles for uniform scale — and click-selects
// clips by the serializer's paint order. All coordinate math lives in
// services/canvas-transform.ts; this file only measures rects and forwards
// pointer events. An editor affordance only: it never exists in an export.
//
// Undo discipline: a drag live-previews through `onLiveTransform` (an
// ephemeral serialized override upstream — no reducer dispatch per pixel) and
// commits exactly once on pointer-up via `onCommit`.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudioClipTransform, StudioTimeline } from '@shared/types/studio';
import { timeToFrame, type SerializedTimeline } from '@shared/studio';
import { findClip } from '../services/timeline-ops';
import {
  VISUAL_KINDS,
  clipBox,
  fitScale,
  hitTestClip,
  moveGesture,
  playerPointToComp,
  scaleGesture,
  type ScaleCorner,
} from '../services/canvas-transform';

/** Pointer travel (player px) below which a press is a click, not a drag. */
const DRAG_THRESHOLD_PX = 3;

const CORNERS: { corner: ScaleCorner; cursor: string; left: boolean; top: boolean }[] = [
  { corner: 'nw', cursor: 'nwse-resize', left: true, top: true },
  { corner: 'ne', cursor: 'nesw-resize', left: false, top: true },
  { corner: 'sw', cursor: 'nesw-resize', left: true, top: false },
  { corner: 'se', cursor: 'nwse-resize', left: false, top: false },
];

interface DragState {
  clipId: string;
  mode: 'move' | ScaleCorner;
  startTransform: StudioClipTransform | undefined;
  /** Pointer origin in client px, and the player rect measured at press. */
  originClient: { x: number; y: number };
  rect: DOMRect;
  moved: boolean;
  /** Last gesture result — what pointer-up commits. */
  last: StudioClipTransform | null;
}

interface Props {
  /** What the Player is showing — hit-test source and composition size. */
  serialized: SerializedTimeline;
  /** The document — span, transform, and lock state come from here. */
  timeline: StudioTimeline;
  selectedClipId: string | null;
  onSelect: (clipId: string | null) => void;
  /** usePlayback.subscribe — the playhead is not React state. */
  subscribePlayhead: (listener: (seconds: number) => void) => () => void;
  onLiveTransform: (
    override: { clipId: string; transform: StudioClipTransform } | null,
  ) => void;
  /** ONE call per completed gesture — one `update-clip` dispatch upstream. */
  onCommit: (clipId: string, transform: StudioClipTransform) => void;
}

export function CanvasOverlay({
  serialized,
  timeline,
  selectedClipId,
  onSelect,
  subscribePlayhead,
  onLiveTransform,
  onCommit,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rectSize, setRectSize] = useState<{ width: number; height: number } | null>(null);
  const comp = useMemo(
    () => ({ width: serialized.width, height: serialized.height }),
    [serialized.width, serialized.height],
  );

  // The overlay is absolute inset-0 over the Player box, so its own rect IS
  // the player rect — panes and window resizes flow in through the observer.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setRectSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The selection this overlay can manipulate: exactly one clip, a visual
  // kind, on an unlocked visible track. Anything else renders no box (the
  // click-to-select layer stays active either way).
  const selected = useMemo(() => {
    const found = selectedClipId ? findClip(timeline, selectedClipId) : null;
    if (!found || !VISUAL_KINDS.has(found.clip.kind)) return null;
    if (found.track.locked || found.track.hidden) return null;
    return found;
  }, [timeline, selectedClipId]);

  // Box visibility follows the playhead without per-frame React renders: the
  // subscriber recomputes a boolean and setState bails out while it's stable.
  const secondsRef = useRef(0);
  const [inSpan, setInSpan] = useState(false);
  const span = selected
    ? {
        start: selected.clip.timelineStart,
        end: selected.clip.timelineStart + selected.clip.duration,
      }
    : null;
  useEffect(() => {
    if (!span) {
      setInSpan(false);
      return;
    }
    const { start, end } = span;
    return subscribePlayhead((seconds) => {
      secondsRef.current = seconds;
      setInSpan(seconds >= start && seconds < end);
    });
  }, [subscribePlayhead, span?.start, span?.end, span !== null]);
  // Track the playhead for click hit-tests even while nothing is selected.
  useEffect(
    () =>
      subscribePlayhead((seconds) => {
        secondsRef.current = seconds;
      }),
    [subscribePlayhead],
  );

  // ----- Drag (window-listener pattern — pointer capture dies too easily) --
  const dragRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false);
  const [liveTransform, setLiveTransform] = useState<StudioClipTransform | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);

  // Live callbacks in refs so the window listeners never go stale.
  const callbacksRef = useRef({ onLiveTransform, onCommit });
  callbacksRef.current = { onLiveTransform, onCommit };

  useEffect(() => {
    const applyPending = () => {
      rafRef.current = null;
      const drag = dragRef.current;
      const point = pendingPointRef.current;
      if (!drag || !point) return;
      const fit = fitScale({ width: drag.rect.width, height: drag.rect.height }, comp);
      if (fit === 0) return;
      let next: StudioClipTransform;
      if (drag.mode === 'move') {
        const delta = {
          x: (point.x - drag.originClient.x) / fit,
          y: (point.y - drag.originClient.y) / fit,
        };
        next = { ...drag.startTransform, ...moveGesture(drag.startTransform, delta) };
      } else {
        const pointer = playerPointToComp(
          { x: point.x - drag.rect.left, y: point.y - drag.rect.top },
          { width: drag.rect.width, height: drag.rect.height },
          comp,
        );
        next = {
          ...drag.startTransform,
          ...scaleGesture(comp, drag.startTransform, drag.mode, pointer),
        };
      }
      drag.last = next;
      setLiveTransform(next);
      callbacksRef.current.onLiveTransform({ clipId: drag.clipId, transform: next });
    };

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (
        !drag.moved &&
        Math.hypot(event.clientX - drag.originClient.x, event.clientY - drag.originClient.y) <
          DRAG_THRESHOLD_PX
      ) {
        return;
      }
      drag.moved = true;
      pendingPointRef.current = { x: event.clientX, y: event.clientY };
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(applyPending);
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        applyPendingCommitSafe(drag);
      }
      if (drag.moved && drag.last) {
        justDraggedRef.current = true;
        window.setTimeout(() => {
          justDraggedRef.current = false;
        }, 0);
        callbacksRef.current.onCommit(drag.clipId, drag.last);
      }
      setLiveTransform(null);
      callbacksRef.current.onLiveTransform(null);
      pendingPointRef.current = null;
    };

    // A rAF still pending at release must land in the commit, not be dropped.
    const applyPendingCommitSafe = (drag: DragState) => {
      dragRef.current = drag;
      applyPending();
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [comp]);

  const startDrag = (event: React.PointerEvent, mode: DragState['mode']) => {
    if (event.button !== 0 || !selected || !rootRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      clipId: selected.clip.id,
      mode,
      startTransform: selected.clip.transform,
      originClient: { x: event.clientX, y: event.clientY },
      rect: rootRef.current.getBoundingClientRect(),
      moved: false,
      last: null,
    };
  };

  const handleRootClick = (event: React.MouseEvent) => {
    if (justDraggedRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const point = playerPointToComp(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { width: rect.width, height: rect.height },
      comp,
    );
    const frame = timeToFrame(secondsRef.current, serialized.fps);
    onSelect(hitTestClip(serialized, frame, point));
  };

  const fit = rectSize ? fitScale(rectSize, comp) : 0;
  const box =
    selected && inSpan && fit > 0
      ? clipBox(comp, liveTransform ?? selected.clip.transform)
      : null;

  return (
    <div
      ref={rootRef}
      data-canvas-overlay
      className="absolute inset-0"
      onClick={handleRootClick}
    >
      {box && (
        <div
          data-canvas-box
          className="absolute cursor-move"
          style={{
            left: box.left * fit,
            top: box.top * fit,
            width: box.width * fit,
            height: box.height * fit,
            border: '1px solid var(--color-accent)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
          }}
          onPointerDown={(e) => startDrag(e, 'move')}
          // No click swallowing: a non-drag click inside the box falls through
          // to the root hit-test, so a clip painted ABOVE the selected one is
          // still click-selectable (drags are guarded by justDraggedRef).
        >
          {CORNERS.map(({ corner, cursor, left, top }) => (
            <div
              key={corner}
              data-canvas-handle={corner}
              className="absolute w-[9px] h-[9px] rounded-[2px] bg-app-base"
              style={{
                cursor,
                border: '1.5px solid var(--color-accent)',
                left: left ? 0 : '100%',
                top: top ? 0 : '100%',
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={(e) => startDrag(e, corner)}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
