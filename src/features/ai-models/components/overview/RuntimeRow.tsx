import { useState } from 'react';
import { Button, ProgressBar, StatusBadge } from '@shared/components';
import type { SystemRuntimeIpc } from '@shared/ipc/types';
import type { RuntimeInstallProgress } from '../../hooks/useSystemRuntimes';
import { formatBytes } from '../../services/format-bytes';

/** Runtime · Status · On disk · actions — shared by the rows and the header captions. */
export const RUNTIME_GRID_COLS = 'grid-cols-[minmax(200px,1.4fr)_minmax(140px,1fr)_88px_minmax(150px,auto)]';

interface RuntimeRowProps {
  runtime: SystemRuntimeIpc;
  /** In-flight install progress from the hook (null when idle). */
  progress?: RuntimeInstallProgress;
  onInstall: () => void;
  onRemove: () => void;
}

/**
 * One single-binary runtime on the Overview's Runtimes table: name and what
 * it powers, its state with the pinned release, bytes on disk, Install (with
 * the download size) or Remove with an inline confirm; the download bar
 * takes the actions' place while an install runs.
 */
export function RuntimeRow({ runtime, progress, onInstall, onRemove }: RuntimeRowProps) {
  const [confirming, setConfirming] = useState(false);
  const installing = progress !== undefined || runtime.installing;

  return (
    <div className="px-3 py-2" style={{ borderBottom: '0.5px solid var(--color-border)' }} data-runtime-row={runtime.id}>
      <div className={`grid ${RUNTIME_GRID_COLS} items-center gap-x-3`}>
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-text-secondary">{runtime.name}</div>
          <div className="truncate text-[11px] text-text-dim">{runtime.powers}</div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {installing ? (
            <StatusBadge tone="accent">Installing</StatusBadge>
          ) : runtime.installed ? (
            <StatusBadge tone="success">Installed</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Not installed</StatusBadge>
          )}
          <span className="truncate font-mono text-[10px] text-text-dim" title={`The release this app installs: ${runtime.release}`}>
            {runtime.release}
          </span>
        </div>

        <div className="font-mono text-[11px] text-text-secondary">
          {runtime.installed && runtime.sizeOnDiskBytes > 0 ? formatBytes(runtime.sizeOnDiskBytes) : '—'}
        </div>

        <div className="flex items-center justify-end gap-2">
          {installing ? (
            <div className="w-[150px]">
              <ProgressBar value={Math.max(progress?.percent ?? 0, 0)} />
              <div className="mt-1 text-right text-[10px] text-text-dim">{progress?.label ?? 'Installing…'}</div>
            </div>
          ) : runtime.installed && !runtime.removable ? (
            <span className="text-[10px] text-text-dim" title={runtime.dir}>
              bundled build
            </span>
          ) : runtime.installed ? (
            confirming ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    onRemove();
                  }}
                  className="h-[22px] rounded px-1.5 text-[9px] font-medium text-accent-red hover:bg-accent-red/10"
                  title="Deletes the runtime files; models stay"
                >
                  Confirm remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-[22px] rounded px-1.5 text-[9px] text-text-dim hover:text-text-secondary"
                >
                  Keep
                </button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirming(true)} title={`Deletes ${runtime.dir}`}>
                Remove
              </Button>
            )
          ) : (
            <Button variant="primary" size="sm" onClick={onInstall}>
              {runtime.downloadLabel ? `Install · ${runtime.downloadLabel}` : 'Install'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
