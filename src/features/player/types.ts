import type { PlayerRef } from "@remotion/player";
import type { ComponentType, RefObject } from "react";
import type { CompositionMetadata } from "@shared/ipc/types";

// Base props shared by all player modes
interface BasePlayerProps {
  durationInFrames: number;
  fps?: number;
  compositionWidth?: number;
  compositionHeight?: number;
  inputProps?: Record<string, unknown>;
  showControls?: boolean;
  className?: string;
  playbackRate?: number;
}

// Direct component mode (for built-in test compositions)
export interface ComponentPlayerProps extends BasePlayerProps {
  component: ComponentType<unknown>;
  lazyComponent?: never;
}

// Lazy component mode (for dynamically loaded user compositions)
export interface LazyComponentPlayerProps extends BasePlayerProps {
  component?: never;
  lazyComponent: () => Promise<{ default: ComponentType<unknown> }>;
}

// Union type for VideoPlayer props
export type VideoPlayerProps = ComponentPlayerProps | LazyComponentPlayerProps;

// Legacy BundlePlayerProps (deprecated, kept for backwards compatibility)
export interface BundlePlayerProps {
  serveUrl: string;
  composition: CompositionMetadata;
  showTimeline?: boolean;
  className?: string;
}

export interface TimelineProps {
  playerRef: RefObject<PlayerRef | null>;
  durationInFrames: number;
  fps: number;
}

export interface PlayerState {
  isPlaying: boolean;
  currentFrame: number;
}
