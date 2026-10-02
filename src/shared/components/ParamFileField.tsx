import { useEffect, useRef, useState } from 'react';

interface ParamFileFieldProps {
  kind: 'image' | 'audio';
  /** '' = none: the composition draws its own stand-in, or stays silent. */
  path: string;
  /** A url the renderer can load for `path` (null while there is none). */
  url: string | null;
  label: string;
  onPick?: () => void;
  onClear: () => void;
  disabled?: boolean;
}

const boxStyle = { border: '0.5px solid var(--color-border-input)' } as const;

function fileNameOf(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/** The square on the left: the picture itself, or a play/stop button for a sound. */
function AudioPreview({ url, label, disabled }: { url: string | null; label: string; disabled?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // A new file (or none) stops whatever was playing; so does leaving the form.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
    };
  }, [url]);

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!url) return;
    const audio = audioRef.current ?? new Audio(url);
    audioRef.current = audio;
    audio.currentTime = 0;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    setPlaying(true);
    audio.play().catch(() => setPlaying(false));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || !url}
      title={url ? (playing ? 'Stop' : 'Play') : 'Silent'}
      aria-label={`${playing ? 'Stop' : 'Play'} ${label}`}
      data-param-audio-play={playing ? 'playing' : 'stopped'}
      className="w-[34px] h-[34px] shrink-0 rounded-[6px] bg-app-base flex items-center justify-center text-text-dim hover:text-accent-light disabled:hover:text-text-dim cursor-pointer disabled:cursor-default"
      style={boxStyle}
    >
      {!url ? (
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round">
          <path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5z" />
          <path d="M11 6l3 4M14 6l-3 4" strokeLinecap="round" />
        </svg>
      ) : playing ? (
        <svg width={12} height={12} viewBox="0 0 12 12" fill="currentColor">
          <rect x="2" y="2" width="8" height="8" rx="1" />
        </svg>
      ) : (
        <svg width={12} height={12} viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 1.8v8.4a.5.5 0 0 0 .76.43l6.8-4.2a.5.5 0 0 0 0-.86l-6.8-4.2A.5.5 0 0 0 3 1.8z" />
        </svg>
      )}
    </button>
  );
}

/**
 * The `image` and `audio` controls: a preview square, the file name, and
 * Choose / Replace / Remove. The picker is a callback — the field never
 * touches IPC itself.
 */
export function ParamFileField({ kind, path, url, label, onPick, onClear, disabled }: ParamFileFieldProps) {
  return (
    <div className="flex items-center gap-1.5">
      {kind === 'audio' ? (
        <AudioPreview url={path ? url : null} label={label} disabled={disabled} />
      ) : (
        <div className="w-[34px] h-[34px] shrink-0 rounded-[6px] overflow-hidden bg-app-base flex items-center justify-center" style={boxStyle}>
          {path && url ? (
            <img src={url} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} className="text-text-dim">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
              <circle cx="5.5" cy="6" r="1.2" />
              <path d="M2 12l3.5-3.5 2.5 2.5 2.5-3 3.5 4" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[10px] text-text-secondary truncate" title={path || undefined}>
          {path ? fileNameOf(path) : kind === 'audio' ? 'None (silent)' : 'None'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onPick}
            disabled={disabled || !onPick}
            className="text-[10px] text-accent-light hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            {path ? 'Replace…' : 'Choose…'}
          </button>
          {path && (
            <button
              onClick={onClear}
              disabled={disabled}
              className="text-[10px] text-text-dim hover:text-text-primary cursor-pointer disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
