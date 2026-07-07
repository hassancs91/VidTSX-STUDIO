import { useState, useEffect, useRef, useCallback } from "react";
import type { PlayerRef } from "@remotion/player";
import type { TimelineProps } from "../types";

function formatTime(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frameNum = Math.floor(frame % fps);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(frameNum).padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="currentColor"
      className="ml-0.5"
    >
      <path d="M2.5 1.5L10 6L2.5 10.5V1.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="currentColor">
      <rect x="2" y="1.5" width="3" height="9" rx="0.5" />
      <rect x="7" y="1.5" width="3" height="9" rx="0.5" />
    </svg>
  );
}

export function Timeline({ playerRef, durationInFrames, fps }: TimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  const progress = durationInFrames > 0 ? currentFrame / durationInFrames : 0;

  const syncState = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    const frame = player.getCurrentFrame();
    setCurrentFrame(frame);
    setIsPlaying(player.isPlaying());

    animationRef.current = requestAnimationFrame(syncState);
  }, [playerRef]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(syncState);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [syncState]);

  const togglePlayPause = () => {
    const player = playerRef.current;
    if (!player) return;

    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  };

  const seekToPosition = (clientX: number) => {
    const track = trackRef.current;
    const player = playerRef.current;
    if (!track || !player) return;

    const rect = track.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const fraction = x / rect.width;
    const frame = Math.round(fraction * durationInFrames);
    player.seekTo(frame);
    setCurrentFrame(frame);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    seekToPosition(e.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    seekToPosition(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      seekToPosition(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, durationInFrames]);

  return (
    <div
      className="h-12 flex items-center gap-3 px-3 bg-app-surface shrink-0"
      style={{ borderTop: "0.5px solid var(--color-border)" }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={togglePlayPause}
        className="w-7 h-7 rounded-full bg-app-hover flex items-center justify-center text-text-secondary hover:bg-app-active hover:text-text-primary transition-colors"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Current Time */}
      <span
        className="text-text-muted w-[60px] text-right"
        style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}
      >
        {formatTime(currentFrame, fps)}
      </span>

      {/* Scrub Bar */}
      <div
        ref={trackRef}
        className="flex-1 h-1 bg-app-hover rounded-full relative cursor-pointer"
        onClick={handleTrackClick}
        onMouseDown={handleMouseDown}
      >
        {/* Filled portion */}
        <div
          className="absolute top-0 left-0 h-full bg-accent rounded-full"
          style={{ width: `${progress * 100}%` }}
        />
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent-light shadow-md cursor-grab"
          style={{
            left: `calc(${progress * 100}% - 5px)`,
            cursor: isDragging ? "grabbing" : "grab",
          }}
        />
      </div>

      {/* Duration */}
      <span
        className="text-text-dim w-[60px]"
        style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}
      >
        {formatTime(durationInFrames, fps)}
      </span>
    </div>
  );
}
