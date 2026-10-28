import { useCallback, useMemo, useRef, useState, type AudioHTMLAttributes, type RefObject } from 'react';
import { createExclusivePlayback } from '../services/exclusive-playback';

/**
 * The Assets screen's sound playback (E3). ONE screen-owned `<audio>` plays the
 * tiles (the screen renders it with `sharedProps`), so switching tiles swaps its
 * `src`; the details panel's `<audio controls>` calls `claim` on play. Either way
 * the exclusive slot pauses the other player — one sound at a time by construction.
 */

export interface AudioPlayback {
  /** Spread onto the screen's single hidden `<audio>` element. */
  sharedProps: AudioHTMLAttributes<HTMLAudioElement> & {
    ref: RefObject<HTMLAudioElement | null>;
    'data-asset-audio': 'tile';
  };
  /** The absolute path the shared element is playing, if any. */
  playingPath: string | null;
  /** The last tile path that failed to play (missing file, server down). */
  failedPath: string | null;
  /** Play `path` from `url` on the shared element, or pause it when it is already playing. */
  toggle: (path: string, url: string | null) => Promise<void>;
  /** A details-panel player is starting — pause the shared one. */
  claim: (player: HTMLMediaElement) => void;
}

export function useAudioPlayback(): AudioPlayback {
  const ref = useRef<HTMLAudioElement | null>(null);
  const pathRef = useRef<string | null>(null);
  const exclusive = useMemo(() => createExclusivePlayback(), []);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);

  const toggle = useCallback(
    async (path: string, url: string | null) => {
      const el = ref.current;
      if (!el || !url) return;
      if (pathRef.current === path && !el.paused) {
        el.pause();
        return;
      }
      exclusive.claim(el);
      if (pathRef.current !== path) {
        pathRef.current = path;
        el.src = url;
      }
      setFailedPath(null);
      try {
        await el.play();
      } catch (err) {
        // AbortError = another tile's click replaced the src mid-load — not a failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (pathRef.current === path) setFailedPath(path);
      }
    },
    [exclusive]
  );

  const claim = useCallback((player: HTMLMediaElement) => exclusive.claim(player), [exclusive]);

  const stopped = useCallback(() => {
    setPlayingPath(null);
    if (ref.current) exclusive.release(ref.current);
  }, [exclusive]);

  const sharedProps: AudioPlayback['sharedProps'] = {
    ref,
    hidden: true,
    preload: 'none',
    'data-asset-audio': 'tile',
    // Re-claim on every start: a src swap can fire `pause` (→ release) before this `play`.
    onPlay: () => {
      if (ref.current) exclusive.claim(ref.current);
      setPlayingPath(pathRef.current);
    },
    onPause: stopped,
    onEnded: stopped,
    onError: () => {
      setFailedPath(pathRef.current);
      stopped();
    },
  };

  return { sharedProps, playingPath, failedPath, toggle, claim };
}
