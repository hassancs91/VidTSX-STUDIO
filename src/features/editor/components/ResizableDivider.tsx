import { useCallback, useEffect, useRef } from 'react';
import type { ResizableDividerProps } from '../types';

export function ResizableDivider({
  onResize,
  onResizeEnd,
}: ResizableDividerProps) {
  const isDraggingRef = useRef(false);
  const lastYRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    lastYRef.current = e.clientY;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaY = e.clientY - lastYRef.current;
      lastYRef.current = e.clientY;
      onResize(deltaY);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onResizeEnd();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize, onResizeEnd]);

  return (
    <div
      className="h-[6px] flex items-center justify-center cursor-row-resize shrink-0 group"
      onMouseDown={handleMouseDown}
    >
      <div className="w-8 h-1 rounded-full bg-app-hover group-hover:bg-border-hover transition-colors" />
    </div>
  );
}
