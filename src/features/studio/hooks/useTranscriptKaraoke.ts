import { useEffect, useRef, type RefObject } from 'react';
import { tokenIndexAt, type TranscriptToken } from '../services/transcript-doc';
import type { UsePlaybackResult } from './usePlayback';

/** A word stays lit this long past its end, so the highlight doesn't flicker between words. */
const LINGER_SECONDS = 0.15;
/**
 * The playhead lives on the frame grid: a seek to a word's start rounds to the
 * nearest frame, which can sit up to half a frame BEFORE the word — and would
 * light the previous one. Half a frame at 24 fps is 21 ms; looking that far
 * ahead is invisible during playback and makes a clicked word the lit word.
 */
const LEAD_SECONDS = 0.025;

/**
 * Lights the word under the playhead. The playhead is not React state (see
 * usePlayback), and neither is this: the active word is one DOM attribute,
 * moved on the playback tick — re-rendering thousands of words per frame is
 * exactly what the transport avoids.
 *
 * While playing, the lit word is kept in view — unless the reader is holding a
 * selection, which a scroll would pull out from under them.
 */
export function useTranscriptKaraoke(
  rootRef: RefObject<HTMLElement | null>,
  tokens: readonly TranscriptToken[],
  playback: UsePlaybackResult,
  hasSelection: boolean,
): void {
  const activeRef = useRef<HTMLElement | null>(null);
  const hasSelectionRef = useRef(hasSelection);
  hasSelectionRef.current = hasSelection;
  const isPlayingRef = useRef(playback.isPlaying);
  isPlayingRef.current = playback.isPlaying;

  useEffect(() => {
    const clear = () => {
      activeRef.current?.removeAttribute('data-active');
      activeRef.current = null;
    };
    const unsubscribe = playback.subscribe((seconds) => {
      const root = rootRef.current;
      if (!root || root.offsetParent === null) return;
      const index = tokenIndexAt(tokens, seconds + LEAD_SECONDS);
      const token = index >= 0 ? tokens[index] : null;
      if (!token || seconds > token.end + LINGER_SECONDS) {
        clear();
        return;
      }
      if (activeRef.current?.dataset.i === String(index)) return;
      clear();
      const el = root.querySelector<HTMLElement>(`[data-i="${index}"]`);
      if (!el) return;
      el.setAttribute('data-active', 'true');
      activeRef.current = el;
      if (!isPlayingRef.current || hasSelectionRef.current) return;
      const view = root.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      if (box.top < view.top + 24 || box.bottom > view.bottom - 24) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
    return () => {
      unsubscribe();
      clear();
    };
    // A new token list means new DOM nodes — the subscription re-reads them.
  }, [rootRef, tokens, playback]);
}
