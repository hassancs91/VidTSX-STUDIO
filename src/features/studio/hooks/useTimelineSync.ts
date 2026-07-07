import { useState, useEffect, useCallback, type RefObject } from 'react';
import type { PlayerRef } from '@remotion/player';

interface TimelineSyncState {
  currentFrame: number;
  isPlaying: boolean;
  seekToFrame: (frame: number) => void;
  seekToTime: (seconds: number) => void;
  togglePlayPause: () => void;
}

export function useTimelineSync(
  playerRef: RefObject<PlayerRef | null>,
  durationInFrames: number,
  fps: number
): TimelineSyncState {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Player → Timeline: read state via requestAnimationFrame loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      const player = playerRef.current;
      if (player) {
        setCurrentFrame(player.getCurrentFrame());
        setIsPlaying(player.isPlaying());
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [playerRef]);

  // Timeline → Player: seek
  const seekToFrame = useCallback(
    (frame: number) => {
      const clamped = Math.max(0, Math.min(frame, durationInFrames - 1));
      playerRef.current?.seekTo(clamped);
    },
    [playerRef, durationInFrames]
  );

  const seekToTime = useCallback(
    (seconds: number) => {
      seekToFrame(Math.round(seconds * fps));
    },
    [seekToFrame, fps]
  );

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  }, [playerRef]);

  return { currentFrame, isPlaying, seekToFrame, seekToTime, togglePlayPause };
}
