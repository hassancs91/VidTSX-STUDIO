import { useCallback, useEffect, useState, type RefObject } from 'react';
import { selectionTokenRange, type TokenRange } from '../services/transcript-selection';

/**
 * The transcript words currently selected with the browser's own selection.
 * `selectionchange` fires per mouse-move while dragging, so the read is
 * coalesced to one per frame and the state only changes when the range does.
 */
export function useTranscriptSelection(rootRef: RefObject<HTMLElement | null>): {
  range: TokenRange | null;
  clear: () => void;
} {
  const [range, setRange] = useState<TokenRange | null>(null);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const root = rootRef.current;
      // A hidden panel (another left-pane tab, another screen) owns no selection.
      const next = root && root.offsetParent !== null ? selectionTokenRange(window.getSelection(), root) : null;
      setRange((prev) => (prev?.from === next?.from && prev?.to === next?.to ? prev : next));
    };
    const onChange = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };
    document.addEventListener('selectionchange', onChange);
    return () => {
      document.removeEventListener('selectionchange', onChange);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [rootRef]);

  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setRange(null);
  }, []);

  return { range, clear };
}
