import { useCallback, useEffect, useRef } from 'react';

interface Props {
  /** 'col' separates side-by-side panes (drag left/right); 'row' separates
   *  stacked panes (drag up/down). */
  orientation: 'col' | 'row';
  /** Pointer delta per move, in px. Positive = right/down. */
  onDelta: (delta: number) => void;
  /** Drag released — the owner persists the final size. */
  onEnd: () => void;
  label: string;
}

/**
 * Drag handle between two editor panes. A thin strip with a slightly wider
 * hit area (the visible border stays the theme's hairline). The drag runs on
 * WINDOW-level listeners while active — the same pattern as the Creator's
 * ResizableDivider — because the cursor leaves a 5 px strip on the first
 * movement and element-level move events would stop arriving.
 */
export function PaneDivider({ orientation, onDelta, onEnd, label }: Props) {
  const draggingRef = useRef(false);
  const lastRef = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      lastRef.current = orientation === 'col' ? e.clientX : e.clientY;
      document.body.style.cursor = orientation === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [orientation],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const pos = orientation === 'col' ? e.clientX : e.clientY;
      const delta = pos - lastRef.current;
      lastRef.current = pos;
      if (delta !== 0) onDelta(delta);
    };
    const stop = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onEnd();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    // A drag canceled by focus loss (alt-tab) must still persist.
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('blur', stop);
    };
  }, [orientation, onDelta, onEnd]);

  return (
    <div
      role="separator"
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      className={`shrink-0 z-10 transition-colors hover:bg-accent/40 active:bg-accent/60 ${
        orientation === 'col' ? 'w-[5px] -mx-[2px] cursor-col-resize' : 'h-[5px] -my-[2px] cursor-row-resize'
      }`}
      style={{ touchAction: 'none' }}
    />
  );
}
