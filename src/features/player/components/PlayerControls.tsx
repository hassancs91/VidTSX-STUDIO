import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerRef } from '@remotion/player';
import html2canvas from 'html2canvas';
import { createRendererLogger } from '../../../renderer/utils/logger';

const log = createRendererLogger('PlayerControls');

export interface PlayerControlsProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number;
  fps: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  playerAreaRef?: React.RefObject<HTMLDivElement | null>;
  // Controlled props for loop and speed
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  playbackRate: PlaybackSpeed;
  onPlaybackRateChange: (rate: PlaybackSpeed) => void;
  previewQuality: PreviewQuality;
  onPreviewQualityChange: (quality: PreviewQuality) => void;
}

// Playback speed options
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type PlaybackSpeed = (typeof SPEED_OPTIONS)[number];

// Preview quality — scales the Player's internal resolution to reduce GPU load on heavy
// compositions. Final renders always use native dimensions regardless of this setting.
type PreviewQuality = 'low' | 'medium' | 'high';
const PREVIEW_QUALITY_SCALE: Record<PreviewQuality, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1,
};
const PREVIEW_QUALITY_OPTIONS: { value: PreviewQuality; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function formatTime(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frameNum = Math.floor(frame % fps);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(frameNum).padStart(2, '0')}`;
}

// Icons
function SkipStartIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="3" width="2" height="8" rx="0.5" />
      <path d="M12 3L6 7L12 11V3Z" />
    </svg>
  );
}

function FrameBackIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
      <path d="M10 3L4 7L10 11V3Z" />
      <rect x="2" y="4" width="1.5" height="6" rx="0.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2L12 7L3 12V2Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
      <rect x="2.5" y="2" width="3.5" height="10" rx="0.5" />
      <rect x="8" y="2" width="3.5" height="10" rx="0.5" />
    </svg>
  );
}

function FrameForwardIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
      <path d="M4 3L10 7L4 11V3Z" />
      <rect x="10.5" y="4" width="1.5" height="6" rx="0.5" />
    </svg>
  );
}

function SkipEndIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 3L8 7L2 11V3Z" />
      <rect x="10" y="3" width="2" height="8" rx="0.5" />
    </svg>
  );
}

function LoopIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? 'text-accent' : ''}
    >
      <path d="M11 3H5C3.34 3 2 4.34 2 6v1" />
      <path d="M3 11H9C10.66 11 12 9.66 12 8v-1" />
      <polyline points="9,1 11,3 9,5" />
      <polyline points="5,9 3,11 5,13" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 5V2h3" />
      <path d="M12 5V2H9" />
      <path d="M2 9v3h3" />
      <path d="M12 9v3H9" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor">
      <path d="M3 4L5 6L7 4" />
    </svg>
  );
}

function ScreenshotIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="10" height="8" rx="1" />
      <circle cx="7" cy="7" r="2" />
      <path d="M4 3V2" />
    </svg>
  );
}

export function PlayerControls({
  playerRef,
  durationInFrames,
  fps,
  containerRef,
  playerAreaRef,
  loop,
  onLoopChange,
  playbackRate,
  onPlaybackRateChange,
  previewQuality,
  onPreviewQualityChange,
}: PlayerControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showScreenshotMenu, setShowScreenshotMenu] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const screenshotMenuRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  const progress = durationInFrames > 0 ? currentFrame / durationInFrames : 0;

  // Sync state with player
  const syncState = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    const frame = player.getCurrentFrame();
    setCurrentFrame(frame);
    setIsPlaying(player.isPlaying());

    // Loop is now handled by Remotion Player's native loop prop

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

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
      if (screenshotMenuRef.current && !screenshotMenuRef.current.contains(e.target as Node)) {
        setShowScreenshotMenu(false);
      }
    };
    if (showSpeedMenu || showQualityMenu || showScreenshotMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeedMenu, showQualityMenu, showScreenshotMenu]);

  // Screenshot capture function
  const captureFrame = async (): Promise<string | null> => {
    const target = playerAreaRef?.current;
    if (!target) return null;

    setIsCapturing(true);
    try {
      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: 2, // High DPI capture
        logging: false,
        useCORS: true,
      });

      return canvas.toDataURL('image/png');
    } catch (err) {
      log.error('Screenshot capture failed', err);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopyToClipboard = async () => {
    setShowScreenshotMenu(false);
    const dataUrl = await captureFrame();
    if (!dataUrl) return;

    try {
      const response = await window.api.screenshotCopy({ dataUrl });
      if (!response.success) {
        log.error('Copy to clipboard failed', response.error);
      }
    } catch (err) {
      log.error('Copy to clipboard error', err);
    }
  };

  const handleSaveToFile = async () => {
    setShowScreenshotMenu(false);
    const dataUrl = await captureFrame();
    if (!dataUrl) return;

    try {
      const response = await window.api.screenshotSave({
        dataUrl,
        fileName: `screenshot-${Date.now()}.png`,
      });
      if (!response.success) {
        log.error('Save to file failed', response.error);
      }
    } catch (err) {
      log.error('Save to file error', err);
    }
  };

  // Playback controls
  const togglePlayPause = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  };

  const skipToStart = () => {
    playerRef.current?.seekTo(0);
    setCurrentFrame(0);
  };

  const skipToEnd = () => {
    playerRef.current?.seekTo(durationInFrames - 1);
    setCurrentFrame(durationInFrames - 1);
  };

  const frameBack = () => {
    const player = playerRef.current;
    if (!player) return;
    const newFrame = Math.max(0, player.getCurrentFrame() - 1);
    player.seekTo(newFrame);
    setCurrentFrame(newFrame);
  };

  const frameForward = () => {
    const player = playerRef.current;
    if (!player) return;
    const newFrame = Math.min(durationInFrames - 1, player.getCurrentFrame() + 1);
    player.seekTo(newFrame);
    setCurrentFrame(newFrame);
  };

  const toggleLoop = () => {
    onLoopChange(!loop);
  };

  const changeSpeed = (newSpeed: PlaybackSpeed) => {
    onPlaybackRateChange(newSpeed);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = async () => {
    const container = containerRef?.current;
    if (!container) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  };

  // Seek bar interaction
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

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, durationInFrames]);

  // Button style helper
  const btnClass =
    'w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-app-hover hover:text-text-primary transition-colors';
  const btnActiveClass =
    'w-7 h-7 rounded flex items-center justify-center bg-app-hover text-accent transition-colors';

  return (
    <div
      className="h-12 flex items-center gap-2 px-3 bg-app-surface shrink-0"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      {/* Transport Controls */}
      <div className="flex items-center gap-0.5">
        <button onClick={skipToStart} className={btnClass} title="Skip to start">
          <SkipStartIcon />
        </button>
        <button onClick={frameBack} className={btnClass} title="Previous frame">
          <FrameBackIcon />
        </button>
        <button
          onClick={togglePlayPause}
          className="w-8 h-8 rounded-full bg-app-hover flex items-center justify-center text-text-primary hover:bg-app-active transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button onClick={frameForward} className={btnClass} title="Next frame">
          <FrameForwardIcon />
        </button>
        <button onClick={skipToEnd} className={btnClass} title="Skip to end">
          <SkipEndIcon />
        </button>
      </div>

      {/* Time Display */}
      <div
        className="flex items-center gap-1 text-text-muted"
        style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}
      >
        <span className="w-[60px] text-right">{formatTime(currentFrame, fps)}</span>
        <span className="text-text-dim">/</span>
        <span className="w-[60px] text-text-dim">{formatTime(durationInFrames, fps)}</span>
      </div>

      {/* Scrub Bar */}
      <div
        ref={trackRef}
        className="flex-1 h-1.5 bg-app-hover rounded-full relative cursor-pointer group"
        onClick={handleTrackClick}
        onMouseDown={handleMouseDown}
      >
        {/* Buffer/loaded indicator could go here */}
        {/* Filled portion */}
        <div
          className="absolute top-0 left-0 h-full bg-accent rounded-full transition-all"
          style={{ width: `${progress * 100}%` }}
        />
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            left: `calc(${progress * 100}% - 6px)`,
            cursor: isDragging ? 'grabbing' : 'grab',
            opacity: isDragging ? 1 : undefined,
          }}
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1">
        {/* Loop */}
        <button
          onClick={toggleLoop}
          className={loop ? btnActiveClass : btnClass}
          title={loop ? 'Disable loop' : 'Enable loop'}
        >
          <LoopIcon active={loop} />
        </button>

        {/* Speed */}
        <div className="relative" ref={speedMenuRef}>
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className={`${btnClass} px-1.5 gap-0.5`}
            style={{ width: 'auto', fontSize: 11 }}
            title="Playback speed"
          >
            <span>{playbackRate}x</span>
            <ChevronIcon />
          </button>
          {showSpeedMenu && (
            <div
              className="absolute bottom-full right-0 mb-1 bg-app-surface border border-app-border rounded shadow-lg py-1 min-w-[60px]"
              style={{ fontSize: 11 }}
            >
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`w-full px-3 py-1 text-left hover:bg-app-hover ${
                    s === playbackRate ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview Quality */}
        <div className="relative" ref={qualityMenuRef}>
          <button
            onClick={() => setShowQualityMenu(!showQualityMenu)}
            className={`${btnClass} px-1.5 gap-0.5`}
            style={{ width: 'auto', fontSize: 11 }}
            title="Preview quality (does not affect final render)"
          >
            <span>{PREVIEW_QUALITY_OPTIONS.find((o) => o.value === previewQuality)?.label ?? 'Low'}</span>
            <ChevronIcon />
          </button>
          {showQualityMenu && (
            <div
              className="absolute bottom-full right-0 mb-1 bg-app-surface border border-app-border rounded shadow-lg py-1 min-w-[140px]"
              style={{ fontSize: 11 }}
            >
              <div className="px-3 py-1 text-text-dim" style={{ fontSize: 10 }}>
                Preview quality
              </div>
              {PREVIEW_QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onPreviewQualityChange(opt.value);
                    setShowQualityMenu(false);
                  }}
                  className={`w-full px-3 py-1 text-left hover:bg-app-hover ${
                    opt.value === previewQuality ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {opt.label} &mdash; {Math.round(PREVIEW_QUALITY_SCALE[opt.value] * 100)}%
                </button>
              ))}
              <div
                className="px-3 py-1 text-text-dim"
                style={{ fontSize: 10, borderTop: '0.5px solid var(--color-border)', marginTop: 4, paddingTop: 6 }}
              >
                Final render uses full quality.
              </div>
            </div>
          )}
        </div>

        {/* Screenshot */}
        <div className="relative" ref={screenshotMenuRef}>
          <button
            onClick={() => setShowScreenshotMenu(!showScreenshotMenu)}
            className={btnClass}
            title="Screenshot"
            disabled={isCapturing}
          >
            <ScreenshotIcon />
          </button>
          {showScreenshotMenu && (
            <div
              className="absolute bottom-full right-0 mb-1 bg-app-surface border border-app-border rounded shadow-lg py-1 min-w-[140px]"
              style={{ fontSize: 11 }}
            >
              <button
                onClick={handleCopyToClipboard}
                className="w-full px-3 py-1.5 text-left text-text-secondary hover:bg-app-hover"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={handleSaveToFile}
                className="w-full px-3 py-1.5 text-left text-text-secondary hover:bg-app-hover"
              >
                Save to File...
              </button>
            </div>
          )}
        </div>

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} className={btnClass} title="Fullscreen">
          <FullscreenIcon />
        </button>
      </div>
    </div>
  );
}

// Export speed for parent component to use with Player
export { SPEED_OPTIONS, PREVIEW_QUALITY_SCALE };
export type { PlaybackSpeed, PreviewQuality };
