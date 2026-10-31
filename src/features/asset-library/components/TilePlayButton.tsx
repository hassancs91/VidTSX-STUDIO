interface TilePlayButtonProps {
  playing: boolean;
  failed: boolean;
  /** Null when the module server isn't running — the control is disabled with a title. */
  url: string | null;
  onToggle: () => void;
}

/**
 * The play / pause control on an audio tile (E3). It sits INSIDE the tile's
 * `<button>`, so it is a `role="button"` span (like the copy control) and stops
 * the click from selecting the tile.
 */
export function TilePlayButton({ playing, failed, url, onToggle }: TilePlayButtonProps) {
  const available = url !== null;
  const title = !available
    ? "Can't play — the preview server isn't running"
    : failed
      ? "Can't play this file"
      : playing
        ? 'Pause'
        : 'Play';
  const activate = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (available) onToggle();
  };

  return (
    <span
      role="button"
      tabIndex={available ? 0 : -1}
      aria-label={title}
      aria-disabled={!available}
      title={title}
      data-tile-play={playing ? 'playing' : failed ? 'failed' : 'idle'}
      onClick={activate}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') activate(e);
      }}
      className={`
        absolute bottom-1 left-1 w-7 h-7 rounded-full
        flex items-center justify-center transition-colors
        ${playing ? 'bg-accent text-white' : 'bg-app-surface'}
        ${!available ? 'text-text-dim cursor-default' : failed ? 'text-accent-red cursor-pointer' : ''}
        ${available && !failed && !playing ? 'text-text-secondary hover:text-text-primary cursor-pointer' : ''}
      `}
    >
      {playing ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <rect x="2.5" y="2" width="2.5" height="8" rx="0.5" />
          <rect x="7" y="2" width="2.5" height="8" rx="0.5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3.5 2.2v7.6a.4.4 0 0 0 .6.35l6.2-3.8a.4.4 0 0 0 0-.7L4.1 1.85a.4.4 0 0 0-.6.35z" />
        </svg>
      )}
    </span>
  );
}
