import { useCallback, useMemo, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';

type PlayheadListener = (seconds: number) => void;

/**
 * Owns transport state for the editor: the Remotion Player handle, the
 * playhead, and play/pause.
 *
 * The playhead deliberately does NOT live in React state. During playback the
 * Player emits a frame event every frame, and re-rendering the editor (Player
 * included) at that rate is exactly what makes Player-based timelines feel
 * sluggish. Subscribers get the value through a callback and move their own DOM
 * — the rAF-style discipline called for in docs/studio/PLAN.md §5.
 *
 * The Player handle is not React state either: it arrives through a ref
 * callback during the commit, and a setState there re-rendered the whole
 * editor synchronously on every project open (video-10 feedback item 2).
 * Listeners attach in the ref callback; play/pause/seek read the ref.
 */
export function usePlayback(fps: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const secondsRef = useRef(0);
  const listenersRef = useRef(new Set<PlayheadListener>());
  const playerHandle = useRef<PlayerRef | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  const publish = useCallback((seconds: number) => {
    secondsRef.current = seconds;
    for (const listener of listenersRef.current) {
      try {
        listener(seconds);
      } catch {
        // A broken subscriber must not stall playback.
      }
    }
  }, []);

  // A new identity (fps changed) makes React detach with null and re-attach.
  const playerRef = useCallback(
    (player: PlayerRef | null) => {
      detachRef.current?.();
      detachRef.current = null;
      playerHandle.current = player;
      if (!player) return;
      const onFrame = (e: { detail: { frame: number } }) => publish(e.detail.frame / fps);
      const onPlay = () => setIsPlaying(true);
      const onPause = () => setIsPlaying(false);
      player.addEventListener('frameupdate', onFrame);
      player.addEventListener('play', onPlay);
      player.addEventListener('pause', onPause);
      player.addEventListener('ended', onPause);
      detachRef.current = () => {
        player.removeEventListener('frameupdate', onFrame);
        player.removeEventListener('play', onPlay);
        player.removeEventListener('pause', onPause);
        player.removeEventListener('ended', onPause);
      };
    },
    [fps, publish],
  );

  const subscribe = useCallback((listener: PlayheadListener) => {
    listenersRef.current.add(listener);
    listener(secondsRef.current);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const seek = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, seconds);
      publish(clamped);
      playerHandle.current?.seekTo(Math.round(clamped * fps));
    },
    [fps, publish],
  );

  const togglePlay = useCallback(() => playerHandle.current?.toggle(), []);
  const play = useCallback(() => playerHandle.current?.play(), []);
  const pause = useCallback(() => playerHandle.current?.pause(), []);

  return useMemo(
    () => ({
      playerRef,
      isPlaying,
      /** Current playhead position in seconds — read at event time, not render time. */
      secondsRef,
      subscribe,
      seek,
      togglePlay,
      play,
      pause,
    }),
    [playerRef, isPlaying, subscribe, seek, togglePlay, play, pause],
  );
}

export type UsePlaybackResult = ReturnType<typeof usePlayback>;
