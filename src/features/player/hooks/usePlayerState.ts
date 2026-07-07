import { useState, useEffect, useCallback, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import type { PlayerState } from "../types";

export function usePlayerState(
  playerRef: RefObject<PlayerRef | null>
): PlayerState {
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentFrame: 0,
  });

  const syncState = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    setState({
      isPlaying: player.isPlaying(),
      currentFrame: player.getCurrentFrame(),
    });
  }, [playerRef]);

  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      syncState();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [syncState]);

  return state;
}
