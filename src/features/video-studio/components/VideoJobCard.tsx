import { ProgressBar } from '@shared/components';
import { contentSafetyBlockMessage } from '@shared/content-safety';
import type { VideoJobView } from '../types';

interface VideoJobCardProps {
  job: VideoJobView;
  /** Wall clock, ticked by useVideoJobs so every card agrees. */
  now: number;
  onCancel: (jobId: string) => void;
  onDismiss: (jobId: string) => void;
}

const STATUS_LABEL: Record<VideoJobView['status'], string> = {
  pending: 'Queued',
  running: 'Generating',
  completed: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATUS_COLOR: Record<VideoJobView['status'], string> = {
  pending: 'text-text-dim',
  running: 'text-accent-light',
  completed: 'text-accent-green',
  failed: 'text-accent-red',
  cancelled: 'text-text-muted',
};

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * An in-flight job in the gallery grid. Everything it shows comes off the
 * `video:job-progress` push except the prompt, which the panel kept when it
 * submitted. Generation runs for minutes, so elapsed time is the honest
 * progress signal for the cloud providers (they report no percentage); the
 * local sd-cli provider reports its sampling steps, and the bar fills.
 */
export function VideoJobCard({ job, now, onCancel, onDismiss }: VideoJobCardProps) {
  const active = job.status === 'pending' || job.status === 'running';
  // A block is the one error whose wording is prescribed; the raw provider
  // message covers everything else (auth, quota, an unsafe output).
  const message = job.blocked
    ? contentSafetyBlockMessage(job.blocked)
    : job.error;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-app-base overflow-hidden">
      <div className="aspect-video flex flex-col items-center justify-center gap-2 bg-app-deep">
        {active ? (
          <>
            <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-text-muted">
              {formatElapsed(now - job.submittedAt)}
            </span>
            {job.progress && (
              <div className="flex w-[70%] flex-col items-center gap-1" data-job-progress={job.progress.percent}>
                <ProgressBar value={job.progress.percent} />
                <span className="text-[10px] text-text-dim">
                  {job.progress.totalSteps > 0
                    ? `Step ${job.progress.step}/${job.progress.totalSteps}`
                    : `${job.progress.percent}%`}
                </span>
              </div>
            )}
          </>
        ) : (
          <svg
            width={28}
            height={28}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`opacity-60 ${STATUS_COLOR[job.status]}`}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
      </div>

      <div className="p-2 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium ${STATUS_COLOR[job.status]}`}>
            {job.cancelling && active ? 'Cancelling…' : STATUS_LABEL[job.status]}
          </span>
          <span className="text-[10px] text-text-dim">·</span>
          <span className="text-[10px] text-text-dim truncate">{job.model}</span>
        </div>

        <span className="text-[10px] text-text-muted line-clamp-2" title={job.prompt}>
          {job.prompt}
        </span>

        {message && (
          <span className="text-[10px] text-accent-red bg-accent-red/10 rounded px-1.5 py-1">
            {message}
          </span>
        )}

        {active ? (
          <button
            type="button"
            className="mt-0.5 h-[22px] rounded text-[10px] text-text-secondary border border-border hover:border-accent-red hover:text-accent-red transition-colors disabled:opacity-40"
            onClick={() => onCancel(job.jobId)}
            disabled={job.cancelling}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="mt-0.5 h-[22px] rounded text-[10px] text-text-secondary border border-border hover:border-text-dim transition-colors"
            onClick={() => onDismiss(job.jobId)}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
