import { ProgressBar } from '@shared/components';
import type { ModelDownloadStatus } from '../hooks/useImageLibrary';

function formatSpeed(bps: number): string {
  if (bps <= 0) return '';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

interface DownloadCellProps {
  status: ModelDownloadStatus;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

/**
 * Compact download-progress cell shared by the catalog and installed-model
 * lists — shows the current file label (multi-file Flux sets), percent, speed,
 * and pause/resume/cancel.
 */
export function DownloadCell({ status, onPause, onResume, onCancel }: DownloadCellProps) {
  return (
    <div className="w-[120px]">
      <div className="text-[9px] text-text-dim text-right mb-0.5 truncate">
        {status.label ? `${status.label} · ` : ''}
        {status.status === 'paused' ? 'Paused' : status.status === 'queued' ? 'Queued' : `${status.progress}%`}
      </div>
      <ProgressBar value={status.progress} color={status.status === 'paused' ? 'amber' : 'purple'} />
      <div className="flex items-center justify-end gap-1.5 mt-0.5">
        {status.speedBps > 0 && status.status === 'downloading' && (
          <span className="text-[8px] text-text-dim">{formatSpeed(status.speedBps)}</span>
        )}
        {status.status === 'downloading' && (
          <button onClick={onPause} className="text-[8px] text-text-dim hover:text-text-secondary">Pause</button>
        )}
        {status.status === 'paused' && (
          <button onClick={onResume} className="text-[8px] text-text-dim hover:text-accent-light">Resume</button>
        )}
        <button onClick={onCancel} className="text-[8px] text-text-dim hover:text-accent-red">Cancel</button>
      </div>
    </div>
  );
}
