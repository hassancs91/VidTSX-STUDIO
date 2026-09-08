// `video` — a plain player with a scrub bar (agents plan §1.3 wave 1).
//
// Deliberately not the Remotion player: a video artifact is a finished file in
// the asset library, so the browser's own decoder is both correct and cheaper
// than standing up a preview webview for it.

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { ArtifactViewerProps } from './types';
import { ViewerFrame } from './ViewerFrame';

function timecode(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00';
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export function VideoViewer({ artifact, resolved, loading, error }: ArtifactViewerProps) {
  const url = resolved?.assetUrls?.[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(
    artifact.kind === 'video' ? artifact.payload.durationSeconds : 0,
  );

  // A new artifact in the same viewer must not keep the old one's play state.
  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [url]);

  const toggle = (): void => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  return (
    <ViewerFrame
      {...(loading !== undefined ? { loading } : {})}
      {...(error !== undefined ? { error } : {})}
      ready={Boolean(url)}
      emptyLabel="This video file is no longer on disk."
    >
      <div className="flex flex-col h-full w-full bg-app-player">
        <div className="flex-1 min-h-0 flex items-center justify-center p-3">
          <video
            ref={videoRef}
            src={url}
            className="max-h-full max-w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onClick={toggle}
          />
        </div>
        <div
          className="flex items-center gap-2.5 px-3 h-[40px] shrink-0 bg-app-surface"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <button
            onClick={toggle}
            title={playing ? 'Pause' : 'Play'}
            className="flex items-center justify-center w-[26px] h-[26px] rounded-full bg-accent text-white shrink-0"
          >
            {playing ? <Pause size={12} /> : <Play size={12} className="ml-[1px]" />}
          </button>
          <span className="text-[11px] font-mono text-text-muted tabular-nums">{timecode(time)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={time}
            onChange={(e) => {
              const next = Number(e.target.value);
              setTime(next);
              if (videoRef.current) videoRef.current.currentTime = next;
            }}
            className="flex-1 accent-[var(--color-accent)] h-[4px]"
          />
          <span className="text-[11px] font-mono text-text-dim tabular-nums">
            {timecode(duration)}
          </span>
        </div>
      </div>
    </ViewerFrame>
  );
}
