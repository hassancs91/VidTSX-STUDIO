import { useEffect, useRef } from 'react';

interface Props {
  subscribe: (listener: (seconds: number) => void) => () => void;
  pxPerSecond: number;
  heightPx: number;
}

/** The playhead line. Position is written straight to the DOM from the
 *  playback feed — during playback this component never re-renders. */
export function TimelinePlayhead({ subscribe, pxPerSecond, heightPx }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pxPerSecondRef = useRef(pxPerSecond);
  pxPerSecondRef.current = pxPerSecond;

  useEffect(() => {
    let raf = 0;
    let latest = 0;
    let queued = false;
    const paint = () => {
      queued = false;
      if (ref.current) {
        ref.current.style.transform = `translateX(${latest * pxPerSecondRef.current}px)`;
      }
    };
    const unsubscribe = subscribe((seconds) => {
      latest = seconds;
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(paint);
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, [subscribe]);

  // Zoom changes the px/second scale, so repaint at the new scale immediately.
  useEffect(() => {
    const unsubscribe = subscribe((seconds) => {
      if (ref.current) ref.current.style.transform = `translateX(${seconds * pxPerSecond}px)`;
    });
    unsubscribe();
  }, [pxPerSecond, subscribe]);

  return (
    <div
      ref={ref}
      className="absolute top-0 left-0 z-30 pointer-events-none"
      style={{ height: heightPx, willChange: 'transform' }}
    >
      <div className="w-px h-full bg-accent-red" />
      <div
        className="absolute -top-[1px] -left-[4px] w-[9px] h-[7px] bg-accent-red"
        style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
      />
    </div>
  );
}
