import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { WebviewTag, IpcMessageEvent } from 'electron';
import { backdropCss, type TemplateBackdrop } from '@shared/templates/backdrops';
import type { CompositionConfig } from '../hooks/useComponentLoader';
import { createRendererLogger } from '../../../renderer/utils/logger';

const log = createRendererLogger('IsolatedPreview');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IsolatedPreviewProps {
  moduleUrl: string;
  config: CompositionConfig;
  /** Live prop overrides forwarded to the Remotion Player's inputProps. */
  inputProps?: Record<string, unknown>;
  /** Stand-in footage painted BEHIND the Player (page CSS, never the
   *  composition) so a transparent overlay can be judged. */
  backdrop?: TemplateBackdrop;
  className?: string;
}

type PreviewStatus = 'init' | 'loading' | 'loaded' | 'error';
type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
type PreviewQuality = 'low' | 'medium' | 'high';

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(frame: number, fps: number): string {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frameNum = Math.floor(frame % fps);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(frameNum).padStart(2, '0')}`;
}

// ─── Icons (matching PlayerControls design) ───────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function IsolatedPreview({ moduleUrl, config, inputProps, backdrop = 'none', className = '' }: IsolatedPreviewProps) {
  // State
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [preloadPath, setPreloadPath] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('init');
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unresponsive, setUnresponsive] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const [loop, setLoop] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackSpeed>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(loadQualityPreference);
  const [isDev, setIsDev] = useState(false);
  const [canvasInfo, setCanvasInfo] = useState<{
    dpr: number;
    scale: number;
    count: number;
    canvases: { width: number; height: number }[];
    threePatch?: string;
    canvasPatch?: string;
    viewportCalls?: number;
    viewportLastArgs?: { req: number[]; applied: number[] } | null;
    spxrCalls?: number;
    spxrLastRequested?: number | null;
    spxrLastApplied?: number | null;
    htmlBuildId?: string;
  } | null>(null);

  // Refs
  const webviewRef = useRef<WebviewTag | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const qualityRef = useRef<PreviewQuality>(previewQuality);
  qualityRef.current = previewQuality;
  const lastPongRef = useRef<number>(Date.now());
  const webviewReadyRef = useRef(false);
  const pendingLoadRef = useRef<{ moduleUrl: string; config: CompositionConfig } | null>(null);
  const inputPropsRef = useRef(inputProps);
  inputPropsRef.current = inputProps;
  const backdropValue = useMemo(
    () => backdropCss(backdrop, { width: config.width, height: config.height }),
    [backdrop, config.width, config.height],
  );
  const backdropRef = useRef(backdropValue);
  backdropRef.current = backdropValue;

  const { durationInFrames, fps } = config;
  const progress = durationInFrames > 0 ? currentFrame / durationInFrames : 0;

  // ── Get module server URL + preload path on mount ───────────────────────
  useEffect(() => {
    window.api.moduleServerUrl().then((res) => {
      if (res.url) setServerUrl(res.url);
      if (res.previewPreloadPath) setPreloadPath(res.previewPreloadPath);
    });
  }, []);

  // ── Detect dev mode — gates the preview-quality diagnostic badge ────────
  useEffect(() => {
    let cancelled = false;
    window.api.appGetIsDev().then((res) => {
      if (!cancelled) setIsDev(res.isDev);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Send command to webview ─────────────────────────────────────────────
  const sendToWebview = useCallback((msg: Record<string, unknown>) => {
    try {
      webviewRef.current?.send('preview-command', msg);
    } catch {
      // webview may not be ready yet
    }
  }, []);

  // ── Handle IPC message from webview ─────────────────────────────────────
  const handleIpcMessage = useCallback((msg: Record<string, unknown>) => {
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'ready':
        log.debug('Preview webview ready');
        webviewReadyRef.current = true;
        lastPongRef.current = Date.now();
        sendToWebview({ type: 'setBackdrop', css: backdropRef.current });
        if (pendingLoadRef.current) {
          const pending = pendingLoadRef.current;
          pendingLoadRef.current = null;
          setStatus('loading');
          setError(null);
          sendToWebview({
            type: 'load',
            moduleUrl: pending.moduleUrl,
            config: pending.config,
            quality: PREVIEW_QUALITY_SCALE[qualityRef.current],
            inputProps: inputPropsRef.current,
          });
        }
        break;

      case 'loaded':
        log.debug('Component loaded in webview');
        setStatus('loaded');
        setError(null);
        setUnresponsive(false);
        break;

      case 'error':
        log.error('Preview error', msg.error);
        setStatus('error');
        setError((msg.error as string) ?? 'Unknown preview error');
        break;

      case 'frameChange':
        setCurrentFrame(msg.frame as number);
        break;

      case 'canvasInfo':
        setCanvasInfo(msg.info as {
          dpr: number;
          scale: number;
          count: number;
          canvases: { width: number; height: number }[];
        });
        break;

      case 'playing':
        setIsPlaying(true);
        break;

      case 'paused':
        setIsPlaying(false);
        break;

      case 'pong':
        lastPongRef.current = Date.now();
        setUnresponsive(false);
        break;
    }
  }, [sendToWebview]);

  // ── Create webview imperatively (React doesn't handle custom elements well) ──
  const webviewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = webviewContainerRef.current;
    if (!container || !serverUrl || !preloadPath) return;

    // Clear previous webview
    container.innerHTML = '';

    // Create webview element imperatively
    const webview = document.createElement('webview') as unknown as WebviewTag;
    webview.setAttribute('src', `${serverUrl}/preview`);
    webview.setAttribute('preload', preloadPath);
    webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, webSecurity=no');
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.border = 'none';

    webviewRef.current = webview;

    const onIpcMessage = (event: IpcMessageEvent) => {
      if (event.channel === 'preview-message') {
        handleIpcMessage(event.args[0] as Record<string, unknown>);
      }
    };

    const onCrashed = () => {
      console.error('[IsolatedPreview] Webview crashed');
      setStatus('error');
      setError('Preview process crashed');
    };

    const onDidFailLoad = (e: unknown) => {
      const evt = e as { errorCode: number; errorDescription: string; validatedURL: string };
      setStatus('error');
      setError(`Failed to load preview: ${evt.errorDescription}`);
    };

    webview.addEventListener('ipc-message', onIpcMessage);
    webview.addEventListener('crashed', onCrashed);
    webview.addEventListener('did-fail-load', onDidFailLoad as EventListener);

    container.appendChild(webview);

    return () => {
      webview.removeEventListener('ipc-message', onIpcMessage);
      webview.removeEventListener('crashed', onCrashed);
      webview.removeEventListener('did-fail-load', onDidFailLoad as EventListener);
      webviewRef.current = null;
      container.innerHTML = '';
    };
  }, [webviewKey, serverUrl, preloadPath, handleIpcMessage]);

  // ── Send load command when moduleUrl/config changes ─────────────────────
  useEffect(() => {
    if (!serverUrl || !moduleUrl) return;

    const quality = PREVIEW_QUALITY_SCALE[previewQuality];
    if (webviewReadyRef.current) {
      setStatus('loading');
      setError(null);
      setCurrentFrame(0);
      sendToWebview({ type: 'load', moduleUrl, config, quality, inputProps: inputPropsRef.current });
    } else {
      pendingLoadRef.current = { moduleUrl, config };
      setStatus('loading');
      setError(null);
    }
    // NOTE: previewQuality intentionally omitted — quality changes at runtime are
    // delivered via a separate setPreviewQuality command (below) so we don't
    // re-import the module every time the user tweaks the slider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, moduleUrl, config, sendToWebview]);

  // ── Forward live inputProps changes to webview ──────────────────────────
  // Loads carry the current value themselves (inputPropsRef), so this only
  // needs to push changes made while a composition is already showing.
  useEffect(() => {
    if (webviewReadyRef.current && status === 'loaded') {
      sendToWebview({ type: 'setInputProps', value: inputProps ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputProps, sendToWebview]);

  // ── Forward backdrop changes (a fresh webview gets it on 'ready') ───────
  useEffect(() => {
    if (webviewReadyRef.current) sendToWebview({ type: 'setBackdrop', css: backdropValue });
  }, [backdropValue, sendToWebview]);

  // ── Persist + forward quality changes to webview ────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(QUALITY_STORAGE_KEY, previewQuality);
    } catch {
      // ignore
    }
    if (webviewReadyRef.current) {
      sendToWebview({ type: 'setPreviewQuality', value: PREVIEW_QUALITY_SCALE[previewQuality] });
    }
  }, [previewQuality, sendToWebview]);

  // ── Heartbeat: ping every 2s, check pong every 1s ──────────────────────
  useEffect(() => {
    if (!serverUrl) return;

    const pingInterval = setInterval(() => {
      sendToWebview({ type: 'ping' });
    }, 2000);

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastPongRef.current;
      if (elapsed > 5000 && status === 'loaded') {
        setUnresponsive(true);
      }
    }, 1000);

    return () => {
      clearInterval(pingInterval);
      clearInterval(checkInterval);
    };
  }, [serverUrl, status, sendToWebview]);

  // ── Close menus on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!showSpeedMenu && !showQualityMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showSpeedMenu && speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
      if (showQualityMenu && qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSpeedMenu, showQualityMenu]);

  // ── Reload webview ──────────────────────────────────────────────────────
  const reloadWebview = useCallback(() => {
    webviewReadyRef.current = false;
    pendingLoadRef.current = { moduleUrl, config };
    setWebviewKey((k) => k + 1);
    setUnresponsive(false);
    setStatus('loading');
    setError(null);
    setCurrentFrame(0);
    lastPongRef.current = Date.now();
    log.debug('Reloading preview webview');
  }, [moduleUrl, config]);

  // ── Player controls ─────────────────────────────────────────────────────
  const togglePlayPause = () => sendToWebview({ type: 'toggle' });

  const skipToStart = () => {
    sendToWebview({ type: 'seek', frame: 0 });
    setCurrentFrame(0);
  };

  const skipToEnd = () => {
    const lastFrame = durationInFrames - 1;
    sendToWebview({ type: 'seek', frame: lastFrame });
    setCurrentFrame(lastFrame);
  };

  const frameBack = () => {
    const newFrame = Math.max(0, currentFrame - 1);
    sendToWebview({ type: 'seek', frame: newFrame });
    setCurrentFrame(newFrame);
  };

  const frameForward = () => {
    const newFrame = Math.min(durationInFrames - 1, currentFrame + 1);
    sendToWebview({ type: 'seek', frame: newFrame });
    setCurrentFrame(newFrame);
  };

  const toggleLoop = () => {
    const newLoop = !loop;
    setLoop(newLoop);
    sendToWebview({ type: 'setLoop', value: newLoop });
  };

  const changeSpeed = (speed: PlaybackSpeed) => {
    setPlaybackRate(speed);
    sendToWebview({ type: 'setPlaybackRate', value: speed });
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  };

  // ── Seek bar interaction ────────────────────────────────────────────────
  const seekToPosition = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const fraction = x / rect.width;
      const frame = Math.round(fraction * durationInFrames);
      sendToWebview({ type: 'seek', frame });
      setCurrentFrame(frame);
    },
    [durationInFrames, sendToWebview],
  );

  const handleTrackClick = (e: React.MouseEvent) => seekToPosition(e.clientX);
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    seekToPosition(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => seekToPosition(e.clientX);
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, seekToPosition]);

  // ── Button styles ───────────────────────────────────────────────────────
  const btnClass =
    'w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-app-hover hover:text-text-primary transition-colors';
  const btnActiveClass =
    'w-7 h-7 rounded flex items-center justify-center bg-app-hover text-accent transition-colors';

  // ── Render ──────────────────────────────────────────────────────────────
  if (!serverUrl || !preloadPath) {
    return (
      <div className={`flex flex-col bg-app-player rounded-lg overflow-hidden ${className}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" role="status" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex flex-col bg-app-player rounded-lg overflow-hidden ${className}`}>
      {/* Preview area */}
      <div className="flex-1 relative min-h-0">
        {/* Container for imperatively-created webview (separate OS process) */}
        <div ref={webviewContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Loading overlay */}
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 bg-app-player flex items-center justify-center">
            <div className="text-center">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" role="status" />
              <p className="text-text-dim text-[10px]">Loading preview...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div className="absolute inset-0 z-10 bg-app-player flex items-center justify-center p-4">
            <div className="text-center max-w-full">
              <div className="text-accent-red text-[11px] font-medium mb-1">Preview Error</div>
              <div className="text-text-dim text-[10px] font-mono whitespace-pre-wrap overflow-auto max-h-20">
                {error}
              </div>
              <button
                onClick={reloadWebview}
                className="mt-2 px-3 py-1 text-[10px] bg-app-hover text-text-secondary rounded hover:text-text-primary transition-colors"
              >
                Reload
              </button>
            </div>
          </div>
        )}

        {/* Unresponsive overlay */}
        {unresponsive && (
          <div className="absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center">
            <p className="text-text-secondary text-[12px] mb-3">Preview unresponsive</p>
            <p className="text-text-dim text-[10px] mb-3 max-w-[240px] text-center">
              The composition may be running heavy computation. You can wait or reload.
            </p>
            <button
              onClick={reloadWebview}
              className="px-4 py-1.5 text-[11px] bg-accent text-white rounded hover:bg-accent/80 transition-colors"
            >
              Reload Preview
            </button>
          </div>
        )}
      </div>

      {/* Player Controls */}
      <div
        className="flex flex-col bg-app-surface shrink-0"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        {/* Scrub Bar Row */}
        <div className="px-3 pt-2 pb-1 flex items-center">
          <div
            ref={trackRef}
            className="flex-1 h-1.5 bg-app-hover rounded-full relative cursor-pointer group"
            onClick={handleTrackClick}
            onMouseDown={handleMouseDown}
          >
            <div
              className="absolute top-0 left-0 h-full bg-accent rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                left: `calc(${progress * 100}% - 6px)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 1 : undefined,
              }}
            />
          </div>
        </div>

        {/* Controls Row */}
        <div className="h-11 flex items-center gap-2 px-3">
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

        {/* Spacer */}
        <div className="flex-1" />

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

          {/* Canvas diagnostic — dev-only; gated by isDev fetched from main */}
          {isDev && (
          <div
            className="px-2 py-0.5 rounded text-text-primary"
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono, monospace)',
              backgroundColor: 'rgba(124, 110, 246, 0.15)',
              border: '0.5px solid var(--color-accent, #7c6ef6)',
            }}
            title={
              canvasInfo
                ? [
                    'HTML build id: ' + (canvasInfo.htmlBuildId ?? '(missing — stale webview!)'),
                    'Canvas/viewport patch: ' + (canvasInfo.canvasPatch ?? 'unknown'),
                    'gl.viewport calls: ' + (canvasInfo.viewportCalls ?? 0),
                    'last viewport req: ' + (canvasInfo.viewportLastArgs
                      ? canvasInfo.viewportLastArgs.req.join(',')
                      : '-'),
                    'last viewport applied: ' + (canvasInfo.viewportLastArgs
                      ? canvasInfo.viewportLastArgs.applied.join(',')
                      : '-'),
                    'Three patch: ' + (canvasInfo.threePatch ?? 'unknown'),
                    'setPixelRatio calls: ' + (canvasInfo.spxrCalls ?? 0),
                    'canvases: ' + (canvasInfo.canvases
                      .map((c, i) => `#${i + 1} ${c.width}\u00d7${c.height}`)
                      .join(', ') || 'none'),
                  ].join('\n')
                : 'waiting for preview snapshot...'
            }
          >
            {canvasInfo
              ? canvasInfo.count > 0
                ? `dpr ${canvasInfo.dpr.toFixed(2)} \u00b7 ${canvasInfo.canvases[0].width}\u00d7${canvasInfo.canvases[0].height} \u00b7 three:${(canvasInfo.threePatch || '?').slice(0, 4)} \u00b7 spxr:${canvasInfo.spxrCalls ?? 0}`
                : `dpr ${canvasInfo.dpr.toFixed(2)} \u00b7 no canvas \u00b7 three:${(canvasInfo.threePatch || '?').slice(0, 4)}`
              : 'diagnostic pending\u2026'}
          </div>
          )}

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
                className="absolute bottom-full right-0 mb-1 bg-app-surface border border-app-border rounded shadow-lg py-1 min-w-[160px]"
                style={{ fontSize: 11 }}
              >
                <div className="px-3 py-1 text-text-dim" style={{ fontSize: 10 }}>
                  Preview quality
                </div>
                {PREVIEW_QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setPreviewQuality(opt.value);
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

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className={btnClass} title="Fullscreen">
            <FullscreenIcon />
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
