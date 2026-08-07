import { useCallback, useEffect, useRef, useState } from 'react';
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
 */
export function usePlayback(fps: number) {
  const [player, setPlayer] = useState<PlayerRef | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const secondsRef = useRef(0);
  const listenersRef = useRef(new Set<PlayheadListener>());

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

  useEffect(() => {
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => publish(e.detail.frame / fps);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  }, [player, fps, publish]);

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
      player?.seekTo(Math.round(clamped * fps));
    },
    [player, fps, publish],
  );

  const togglePlay = useCallback(() => {
    player?.toggle();
  }, [player]);

  return {
    playerRef: setPlayer,
    player,
    isPlaying,
    /** Current playhead position in seconds — read at event time, not render time. */
    secondsRef,
    subscribe,
    seek,
    togglePlay,
  };
}

export type UsePlaybackResult = ReturnType<typeof usePlayback>;
