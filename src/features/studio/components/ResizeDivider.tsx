import { useCallback, useEffect, useRef } from 'react';

interface ResizeDividerProps {
  onResize: (delta: number) => void;
  orientation?: 'vertical' | 'horizontal';
}

export function ResizeDivider({ onResize, orientation = 'vertical' }: ResizeDividerProps) {
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef(0);
  const isHorizontal = orientation === 'horizontal';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    lastPosRef.current = isHorizontal ? e.clientY : e.clientX;
    document.body.style.cursor = isHorizontal ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isHorizontal]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const current = isHorizontal ? e.clientY : e.clientX;
      const delta = current - lastPosRef.current;
      lastPosRef.current = current;
      onResize(delta);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize, isHorizontal]);

  if (isHorizontal) {
    return (
      <div
        className="h-[6px] flex items-center justify-center cursor-row-resize shrink-0 group"
        onMouseDown={handleMouseDown}
      >
        <div className="w-8 h-1 rounded-full bg-app-hover group-hover:bg-border-hover transition-colors" />
      </div>
    );
  }

  return (
    <div
      className="w-[6px] flex items-center justify-center cursor-col-resize shrink-0 group"
      onMouseDown={handleMouseDown}
    >
      <div className="h-8 w-1 rounded-full bg-app-hover group-hover:bg-border-hover transition-colors" />
    </div>
  );
}
