import { useEffect } from 'react';
import type { UseTimelineResult } from './useTimeline';
import type { UsePlaybackResult } from './usePlayback';

interface Options {
  /** The panel root — used to tell whether Studio is actually on screen. */
  containerRef: React.RefObject<HTMLElement | null>;
  tl: UseTimelineResult;
  playback: UsePlaybackResult;
  fps: number;
  durationSeconds: number;
  onSplit: () => void;
}

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Editor keyboard shortcuts.
 *
 * The visibility check is load-bearing: App.tsx keeps every visited screen
 * mounted and merely hides the inactive ones, so without it Studio would keep
 * swallowing Delete and Space while the user works on another screen.
 */
export function useTimelineShortcuts({
  containerRef,
  tl,
  playback,
  fps,
  durationSeconds,
  onSplit,
}: Options): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (containerRef.current?.offsetParent === null) return;
      if (isTextEntry(event.target)) return;

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) tl.redo();
          else tl.undo();
        } else if (key === 'y') {
          event.preventDefault();
          tl.redo();
        }
        return;
      }

      const step = event.shiftKey ? 1 : 1 / fps;
      switch (event.key) {
        case ' ':
          event.preventDefault();
          playback.togglePlay();
          break;
        case 's':
        case 'S':
          event.preventDefault();
          onSplit();
          break;
        case 'Delete':
          if (!tl.selectedClipId) break;
          event.preventDefault();
          tl.remove(tl.selectedClipId, true);
          break;
        case 'Backspace':
          if (!tl.selectedClipId) break;
          event.preventDefault();
          tl.remove(tl.selectedClipId, false);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          playback.seek(playback.secondsRef.current - step);
          break;
        case 'ArrowRight':
          event.preventDefault();
          playback.seek(playback.secondsRef.current + step);
          break;
        case 'Home':
          event.preventDefault();
          playback.seek(0);
          break;
        case 'End':
          event.preventDefault();
          playback.seek(durationSeconds);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [containerRef, tl, playback, fps, durationSeconds, onSplit]);
}
