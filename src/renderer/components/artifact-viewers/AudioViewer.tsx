// `audio` — a plain player for a generated sound effect or music track (W2b).
//
// The file is a finished MP3 in the asset library, so the browser's own
// decoder is the right player: the same transport row the video viewer has,
// over an <audio> element, with the kind and length as the only picture.

import { useEffect, useRef, useState } from 'react';
import { Music, Pause, Play, Volume2 } from 'lucide-react';
import type { ArtifactViewerProps } from './types';
import { ViewerFrame } from './ViewerFrame';

function timecode(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00';
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export function AudioViewer({ artifact, resolved, loading, error }: ArtifactViewerProps) {
  const url = resolved?.assetUrls?.[0];
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(
    artifact.kind === 'audio' ? artifact.payload.durationSeconds : 0,
  );
  const sound = artifact.kind === 'audio' ? artifact.payload.sound : 'sfx';

  // A new artifact in the same viewer must not keep the old one's play state.
  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [url]);

  const toggle = (): void => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const Icon = sound === 'music' ? Music : Volume2;

  return (
    <ViewerFrame
      {...(loading !== undefined ? { loading } : {})}
      {...(error !== undefined ? { error } : {})}
      ready={Boolean(url)}
      emptyLabel="This audio file is no longer on disk."
    >
      <div className="flex flex-col h-full w-full bg-app-player">
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 p-3" onClick={toggle}>
          <Icon size={36} strokeWidth={1.25} className="text-text-muted" />
          <div className="text-[12px] text-text-primary text-center max-w-[420px] leading-snug">{artifact.title}</div>
          <div className="text-[11px] text-text-dim">
            {sound === 'music' ? 'Music' : 'Sound effect'} · {timecode(duration)}
          </div>
          <audio
            ref={audioRef}
            src={url}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
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
              if (audioRef.current) audioRef.current.currentTime = next;
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
