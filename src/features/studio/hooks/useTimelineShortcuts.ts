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
  /** The toolbar's "auto ripple" mode: Delete closes the gap when true. */
  rippleDelete: boolean;
  /** Ripple mode 'all': a master-lane delete pulls every unlocked track along. */
  rippleAllTracks: boolean;
  /** Delete with an in/out range set removes that span instead of the selection;
   *  returns true when it did (the range wins over a lingering selection). */
  onDeleteRange: () => boolean;
  onSplit: () => void;
  onCopy: () => void;
  /** Ctrl+V — pastes at the playhead (the handler reads it at call time). */
  onPaste: () => void;
  onDuplicate: () => void;
  /** Shift+Z. */
  onZoomToFit: () => void;
  /** M — drops a marker at the playhead. */
  onAddMarker: () => void;
  /** I / O set the export range point at the playhead; Shift+I / Shift+O clear it. */
  onSetRangePoint: (edge: 'in' | 'out', clear: boolean) => void;
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
  rippleDelete,
  rippleAllTracks,
  onDeleteRange,
  onSplit,
  onCopy,
  onPaste,
  onDuplicate,
  onZoomToFit,
  onAddMarker,
  onSetRangePoint,
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
        } else if (key === 'a') {
          event.preventDefault();
          tl.selectMany(
            tl.timeline.tracks.flatMap((t) => t.clips.map((c) => c.id)),
            false,
          );
        } else if (key === 'c') {
          // Only claim Ctrl+C when clips are selected — text copy stays free.
          if (tl.selectedClipIds.length > 0) {
            event.preventDefault();
            onCopy();
          }
        } else if (key === 'v') {
          event.preventDefault();
          onPaste();
        } else if (key === 'd') {
          if (tl.selectedClipIds.length > 0) {
            event.preventDefault();
            onDuplicate();
          }
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
        case 'Z':
          if (!event.shiftKey) break;
          event.preventDefault();
          onZoomToFit();
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          onAddMarker();
          break;
        case 'i':
        case 'I':
          event.preventDefault();
          onSetRangePoint('in', event.shiftKey);
          break;
        case 'o':
        case 'O':
          event.preventDefault();
          onSetRangePoint('out', event.shiftKey);
          break;
        case 'Delete':
          if (onDeleteRange()) {
            event.preventDefault();
            break;
          }
          if (tl.selectedClipIds.length === 0) break;
          event.preventDefault();
          tl.removeSelected(rippleDelete, rippleAllTracks);
          break;
        case 'Backspace':
          if (tl.selectedClipIds.length === 0) break;
          event.preventDefault();
          tl.removeSelected(false);
          break;
        case 'Escape':
          if (tl.selectedClipIds.length === 0) break;
          event.preventDefault();
          tl.select(null);
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
  }, [
    containerRef,
    tl,
    playback,
    fps,
    durationSeconds,
    rippleDelete,
    rippleAllTracks,
    onDeleteRange,
    onSplit,
    onCopy,
    onPaste,
    onDuplicate,
    onZoomToFit,
    onAddMarker,
    onSetRangePoint,
  ]);
}
