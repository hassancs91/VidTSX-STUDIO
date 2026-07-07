import { X } from 'lucide-react';
import { useUpdaterContext } from '@renderer/contexts/UpdaterContext';

export function UpdateBanner() {
  const {
    phase,
    newVersion,
    progress,
    download,
    install,
    dismiss,
  } = useUpdaterContext();

  if (phase === 'idle' || phase === 'checking') return null;

  const accentColor =
    phase === 'error' ? 'var(--color-accent-red)' : 'var(--color-accent)';

  return (
    <div
      className="flex items-center gap-3 bg-app-surface rounded-[8px] px-4 py-3"
      style={{
        border: '0.5px solid var(--color-border)',
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {phase !== 'error' && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ backgroundColor: accentColor }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </span>
      )}

      {phase === 'available' && (
        <>
          <span className="text-[11px] text-text-secondary flex-1">
            <span className="font-medium text-text-primary">Update available:</span>{' '}
            VidTSX Studio v{newVersion} is ready to download
          </span>
          <button
            onClick={() => void download()}
            className="bg-accent text-white rounded-[6px] px-[10px] py-[4px] text-[11px] hover:opacity-90 cursor-pointer shrink-0"
          >
            Download
          </button>
        </>
      )}

      {phase === 'downloading' && (
        <>
          <span className="text-[11px] text-text-secondary flex-1">
            <span className="font-medium text-text-primary">Downloading update…</span>{' '}
            {Math.round(progress)}%
          </span>
          <div className="w-[120px] h-[4px] bg-app-hover rounded-[2px] overflow-hidden shrink-0">
            <div
              className="h-full rounded-[2px] transition-[width] duration-200"
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        </>
      )}

      {phase === 'ready' && (
        <>
          <span className="text-[11px] text-text-secondary flex-1">
            <span className="font-medium text-text-primary">Update downloaded:</span>{' '}
            Restart to install v{newVersion}
          </span>
          <button
            onClick={() => void install()}
            className="bg-accent text-white rounded-[6px] px-[10px] py-[4px] text-[11px] hover:opacity-90 cursor-pointer shrink-0"
          >
            Restart Now
          </button>
        </>
      )}

      {phase === 'error' && (
        <span className="text-[11px] text-text-muted flex-1">
          Couldn't check for updates. We'll try again later.
        </span>
      )}

      {phase !== 'downloading' && (
        <button
          onClick={dismiss}
          className="text-text-dim hover:text-text-muted cursor-pointer p-1 shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
