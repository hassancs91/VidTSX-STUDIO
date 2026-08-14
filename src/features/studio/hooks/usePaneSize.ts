import { useCallback, useRef, useState } from 'react';

/**
 * One user-resizable pane dimension: clamped, remembered across sessions via
 * localStorage (pure UI ergonomics — deliberately NOT in the settings KV or
 * the project document; it's per-machine window state, like scroll position).
 */
export function usePaneSize(
  key: string,
  defaultPx: number,
  minPx: number,
  maxPx: number,
): { size: number; resizeBy: (delta: number) => void; persist: () => void } {
  const storageKey = `studio.pane.${key}`;
  const [size, setSize] = useState<number>(() => {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw === null ? NaN : Number(raw);
    if (!Number.isFinite(parsed)) return defaultPx;
    return Math.min(maxPx, Math.max(minPx, Math.round(parsed)));
  });
  const sizeRef = useRef(size);

  const resizeBy = useCallback(
    (delta: number) => {
      setSize((current) => {
        const next = Math.min(maxPx, Math.max(minPx, current + delta));
        sizeRef.current = next;
        return next;
      });
    },
    [minPx, maxPx],
  );

  const persist = useCallback(() => {
    window.localStorage.setItem(storageKey, String(sizeRef.current));
  }, [storageKey]);

  return { size, resizeBy, persist };
}
