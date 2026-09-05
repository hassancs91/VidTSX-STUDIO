import { ErrorBanner, ProgressBar } from '@shared/components';
import { REMBG_STAGE_LABELS, type RemoveBackgroundError, type RemoveBackgroundJob } from '../hooks/useRemoveBackground';

interface RemoveBackgroundStatusProps {
  job: RemoveBackgroundJob | null;
  error: RemoveBackgroundError | null;
  onCancel: () => void;
  onDismissError: () => void;
}

/**
 * Floating status card for a background-removal job: stage ("Preparing runtime" →
 * "Removing background"), percent when the worker reports one, Cancel; a classified
 * error with the raw worker tail behind Details when it fails.
 */
export function RemoveBackgroundStatus({ job, error, onCancel, onDismissError }: RemoveBackgroundStatusProps) {
  if (!job && !error) return null;
  return (
    <div className="absolute bottom-3 right-3 z-30 w-[300px] max-w-[calc(100%-24px)]" data-testid="rembg-status">
      {job && (
        <div className="bg-app-surface border border-border rounded-lg shadow-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-medium text-text-primary truncate">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5 align-middle" />
              {REMBG_STAGE_LABELS[job.stage]}
              {job.pct !== undefined ? ` · ${Math.round(job.pct)}%` : ''}
            </span>
            <button type="button" onClick={onCancel} className="text-[10px] text-text-dim hover:text-accent-red shrink-0">Cancel</button>
          </div>
          <ProgressBar value={job.pct ?? (job.stage === 'saving' ? 100 : 0)} />
          <div className="mt-1 text-[10px] text-text-dim truncate" title={job.label}>
            {job.message ?? job.label}
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error.message} details={error.details} onDismiss={onDismissError} />
        </div>
      )}
    </div>
  );
}
