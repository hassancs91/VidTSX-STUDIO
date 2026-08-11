// Drag-select on empty lane space: press, drag a rectangle, every clip it
// touches joins the selection (Ctrl/Shift keeps the existing selection).
// A plain click that never moves clears the selection — the behaviour the
// empty-lane click always had.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioTimeline } from '../types';
import { clipsInRect } from '../services/timeline-group-ops';

const DRAG_THRESHOLD_PX = 4;

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Options {
  timeline: StudioTimeline;
  pxPerSecond: number;
  trackHeight: number;
  lanesRef: React.RefObject<HTMLDivElement | null>;
  selectedClipIds: string[];
  selectMany: (clipIds: string[], additive: boolean) => void;
  clearSelection: () => void;
}

interface MarqueeState {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Selection to keep underneath the rectangle (Ctrl/Shift marquee). */
  base: string[];
  passedThreshold: boolean;
}

export function useMarqueeSelect({
  timeline,
  pxPerSecond,
  trackHeight,
  lanesRef,
  selectedClipIds,
  selectMany,
  clearSelection,
}: Options) {
  const stateRef = useRef<MarqueeState | null>(null);
  const [rect, setRect] = useState<MarqueeRect | null>(null);
  const latestRef = useRef({ timeline, pxPerSecond, selectedClipIds });
  latestRef.current = { timeline, pxPerSecond, selectedClipIds };

  const toLaneCoords = useCallback(
    (clientX: number, clientY: number) => {
      const lanes = lanesRef.current;
      if (!lanes) return null;
      const r = lanes.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    },
    [lanesRef],
  );

  const onLanePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const point = toLaneCoords(event.clientX, event.clientY);
      if (!point) return;
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      stateRef.current = {
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        base: additive ? [...latestRef.current.selectedClipIds] : [],
        passedThreshold: false,
      };
    },
    [toLaneCoords],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const point = toLaneCoords(event.clientX, event.clientY);
      if (!point) return;
      state.x2 = point.x;
      state.y2 = point.y;
      if (
        !state.passedThreshold &&
        Math.abs(state.x2 - state.x1) < DRAG_THRESHOLD_PX &&
        Math.abs(state.y2 - state.y1) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      state.passedThreshold = true;
      setRect({
        left: Math.min(state.x1, state.x2),
        top: Math.min(state.y1, state.y2),
        width: Math.abs(state.x2 - state.x1),
        height: Math.abs(state.y2 - state.y1),
      });
      const { timeline: current, pxPerSecond: pps } = latestRef.current;
      const hit = clipsInRect(current, pps, trackHeight, state);
      selectMany([...state.base, ...hit], false);
    };

    const onUp = () => {
      const state = stateRef.current;
      stateRef.current = null;
      setRect(null);
      if (!state) return;
      // A motionless press on empty lane space = the classic deselect click
      // (unless it was an additive press, which should not nuke the set).
      if (!state.passedThreshold && state.base.length === 0) clearSelection();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [toLaneCoords, trackHeight, selectMany, clearSelection]);

  return { marqueeRect: rect, onLanePointerDown };
}
