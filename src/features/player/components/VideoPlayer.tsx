import { useEffect, useRef, useState, Component, type ComponentType, type ReactNode, type ErrorInfo } from 'react';
import { createRendererLogger } from '../../../renderer/utils/logger';

const log = createRendererLogger('VideoPlayer');
import { Player, type PlayerRef } from '@remotion/player';
import { PlayerControls, type PlaybackSpeed, type PreviewQuality, PREVIEW_QUALITY_SCALE } from './PlayerControls';
import type { VideoPlayerProps, BundlePlayerProps } from '../types';

const QUALITY_STORAGE_KEY = 'vidtsx.previewQuality';

function loadQualityPreference(): PreviewQuality {
  try {
    const stored = localStorage.getItem(QUALITY_STORAGE_KEY);
    if (stored === 'low' || stored === 'medium' || stored === 'high') return stored;
  } catch {
    // ignore
  }
  return 'low';
}

// Error Boundary to catch lazy load and render failures
interface ErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
  fallback: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PlayerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    log.error('PlayerErrorBoundary caught error', error, { componentStack: errorInfo.componentStack });
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

function ErrorDisplay({ message, location }: { message: string; location?: { line: number; column: number; file: string } }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center max-w-3xl">
        <div className="text-accent-red text-4xl font-bold mb-6">
          Render Error
        </div>
        <div className="text-white text-2xl leading-relaxed whitespace-pre-wrap font-mono">
          {message}
        </div>
        {location && (
          <div className="text-white text-lg mt-5 opacity-75 font-mono">
            at {location.file}:{location.line}:{location.column}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
        role="status"
      />
    </div>
  );
}

// Type guard for lazy component props
function hasLazyComponent(props: VideoPlayerProps): props is { lazyComponent: () => Promise<{ default: ComponentType<unknown> }> } & Omit<VideoPlayerProps, 'component'> {
  return 'lazyComponent' in props && typeof props.lazyComponent === 'function';
}

// Type guard for direct component props
function hasComponent(props: VideoPlayerProps): props is { component: ComponentType<unknown> } & Omit<VideoPlayerProps, 'lazyComponent'> {
  return 'component' in props && typeof props.component === 'function';
}

// Type guard for legacy bundle props
function isBundleProps(props: VideoPlayerProps | BundlePlayerProps): props is BundlePlayerProps {
  return 'serveUrl' in props && 'composition' in props;
}

export function VideoPlayer(props: VideoPlayerProps | BundlePlayerProps) {
  // Handle legacy bundle props
  if (isBundleProps(props)) {
    // For backwards compatibility, show the composition info
    // In the new flow, WorkspaceScreen should use useComponentLoader instead
    return (
      <div className={`flex flex-col bg-app-player rounded-lg overflow-hidden ${props.className ?? ''}`}>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-text-secondary text-[12px] mb-2">Bundle Preview Mode</div>
            <div className="text-text-dim text-[11px]">
              {props.composition.width}x{props.composition.height} | {props.composition.fps}fps | {props.composition.durationInFrames} frames
            </div>
            <div className="text-text-dim text-[10px] mt-2 opacity-70">
              Use useComponentLoader for native player support
            </div>
          </div>
        </div>
      </div>
    );
  }

  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackSpeed>(1);
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(loadQualityPreference);

  useEffect(() => {
    try {
      localStorage.setItem(QUALITY_STORAGE_KEY, previewQuality);
    } catch {
      // ignore
    }
  }, [previewQuality]);

  const {
    durationInFrames,
    fps = 30,
    compositionWidth = 1920,
    compositionHeight = 1080,
    inputProps,
    showControls = true,
    className = '',
  } = props;

  // Proxy-style preview: render the Player at a reduced internal resolution; CSS
  // upscales it to fill the viewport, cutting WebGL/Canvas pixel count so heavy
  // 3D compositions play smoothly. Final render ignores this and uses native dims.
  const qualityScale = PREVIEW_QUALITY_SCALE[previewQuality];
  const scaledWidth = Math.max(2, Math.round((compositionWidth * qualityScale) / 2) * 2);
  const scaledHeight = Math.max(2, Math.round((compositionHeight * qualityScale) / 2) * 2);

  const handleError = (err: Error) => {
    setError(err.message);
    setIsLoading(false);
  };

  // Determine component or lazyComponent
  const componentProp = hasComponent(props) ? props.component : undefined;
  const lazyComponentProp = hasLazyComponent(props) ? props.lazyComponent : undefined;

  if (!componentProp && !lazyComponentProp) {
    return (
      <div className={`flex flex-col bg-app-player rounded-lg overflow-hidden ${className}`}>
        <ErrorDisplay message="No component provided. Pass either 'component' or 'lazyComponent' prop." />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-app-player rounded-lg overflow-hidden ${className}`}
    >
      <div ref={playerAreaRef} className="flex-1 relative min-h-0">
        {error ? (
          <ErrorDisplay message={error} />
        ) : (
          <PlayerErrorBoundary
            onError={handleError}
            fallback={(err) => <ErrorDisplay message={err.message} />}
          >
            {isLoading && (
              <div className="absolute inset-0 z-10 bg-app-player">
                <LoadingSpinner />
              </div>
            )}
            <Player
              ref={playerRef}
              {...(componentProp ? { component: componentProp } : {})}
              {...(lazyComponentProp ? { lazyComponent: lazyComponentProp } : {})}
              durationInFrames={durationInFrames}
              fps={fps}
              compositionWidth={scaledWidth}
              compositionHeight={scaledHeight}
              inputProps={inputProps}
              loop={loop}
              playbackRate={playbackRate}
              style={{ width: '100%', height: '100%' }}
              controls={false}
              errorFallback={({ error: renderError }) => (
                <ErrorDisplay message={renderError.message} />
              )}
              renderLoading={() => <LoadingSpinner />}
              onError={handleError}
              onBuffer={() => setIsLoading(true)}
              onContinue={() => setIsLoading(false)}
            />
          </PlayerErrorBoundary>
        )}
      </div>
      {showControls && !error && (
        <PlayerControls
          playerRef={playerRef}
          durationInFrames={durationInFrames}
          fps={fps}
          containerRef={containerRef}
          playerAreaRef={playerAreaRef}
          loop={loop}
          onLoopChange={setLoop}
          playbackRate={playbackRate}
          onPlaybackRateChange={setPlaybackRate}
          previewQuality={previewQuality}
          onPreviewQualityChange={setPreviewQuality}
        />
      )}
    </div>
  );
}

// Re-export types for convenience
export type { VideoPlayerProps, BundlePlayerProps } from '../types';
