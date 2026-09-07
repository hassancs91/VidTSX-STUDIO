import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePanelResizeOptions {
  min: number;
  max: number;
  /** Starting width; defaults to `min`. */
  initial?: number;
}

/**
 * Drag-to-resize for a fixed-width side panel: returns the current width and
 * the mousedown handler for the divider. The drag is tracked on `window`, so
 * the pointer may leave the 4px handle without dropping it.
 */
export function usePanelResize({ min, max, initial }: UsePanelResizeOptions) {
  const [width, setWidth] = useState(initial ?? min);
  const isDraggingRef = useRef(false);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setWidth((prev) => Math.max(min, Math.min(max, prev + e.movementX)));
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [min, max]);

  return { width, onResizeStart };
}
