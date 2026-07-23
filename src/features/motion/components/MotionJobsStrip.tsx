import type { TsxJobIpc, TsxJobStatus } from '../../../shared/ipc/types';
import { useTsxJobs, isJobActive, isJobFinished } from '../contexts/TsxJobsContext';

const MAX_CONCURRENT = 4;

const STATUS_LABELS: Record<TsxJobStatus, string> = {
  queued: 'Queued',
  planning: 'Planning',
  generating: 'Generating',
  verifying: 'Verifying',
  fixing: 'Validating',
  naming: 'Naming',
  saving: 'Saving',
  done: 'Done',
  error: 'Failed',
  cancelled: 'Cancelled',
};

const KIND_LABELS: Record<TsxJobIpc['kind'], string> = {
  generate: 'Gen',
  edit: 'Edit',
  fix: 'Fix',
};

function statusColor(status: TsxJobStatus): string {
  if (status === 'done') return 'var(--color-accent-green, #4ade80)';
  if (status === 'error') return 'var(--color-accent-red, #f87171)';
  if (status === 'cancelled') return 'var(--color-text-dim)';
  return 'var(--color-accent, #60a5fa)';
}

interface MotionJobsStripProps {
  onOpenJob: (job: TsxJobIpc) => void;
}

/**
 * Horizontal strip of generation jobs under the Creator toolbar. Each running
 * job shows its step + percent with a cancel button; finished jobs offer
 * click-to-open. Hidden when there are no jobs.
 */
export function MotionJobsStrip({ onOpenJob }: MotionJobsStripProps) {
  const { jobs, activeJobs, cancelJob, clearCompleted } = useTsxJobs();

  if (jobs.length === 0) return null;

  const runningCount = activeJobs.filter((j) => j.status !== 'queued').length;
  const hasFinished = jobs.some(isJobFinished);
  // Newest first so fresh jobs appear at the left edge
  const ordered = [...jobs].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 bg-app-surface shrink-0 overflow-x-auto"
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
    >
      <span className="text-[10px] text-text-dim shrink-0" title="Running generations">
        {runningCount}/{MAX_CONCURRENT}
      </span>
      {ordered.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded shrink-0 max-w-[240px]"
          style={{ border: '0.5px solid var(--color-border)', background: 'var(--color-app-bg)' }}
        >
          <span
            className="text-[9px] font-medium uppercase shrink-0"
            style={{ color: statusColor(job.status) }}
          >
            {KIND_LABELS[job.kind]}
          </span>
          <span className="text-[10px] text-text-secondary truncate" title={job.prompt}>
            {job.projectName ?? job.prompt}
          </span>
          <span className="text-[9px] text-text-dim shrink-0">
            {STATUS_LABELS[job.status]}
            {isJobActive(job) && job.status !== 'queued' ? ` ${job.progress.percent}%` : ''}
          </span>
          {isJobActive(job) ? (
            <button
              onClick={() => cancelJob(job.id)}
              className="shrink-0 w-4 h-4 flex items-center justify-center text-text-dim hover:text-text-primary cursor-pointer"
              title="Cancel"
            >
              <svg width={8} height={8} viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M1 1L7 7M7 1L1 7" />
              </svg>
            </button>
          ) : job.status === 'done' && job.versionPath ? (
            <button
              onClick={() => onOpenJob(job)}
              className="shrink-0 px-1 text-[9px] text-accent hover:underline cursor-pointer"
              title="Open result"
            >
              Open
            </button>
          ) : job.status === 'error' ? (
            <span className="shrink-0 w-4 h-4 flex items-center justify-center text-[10px]" title={job.error}>
              ⚠
            </span>
          ) : null}
        </div>
      ))}
      {hasFinished && (
        <button
          onClick={() => clearCompleted()}
          className="text-[9px] text-text-dim hover:text-text-primary shrink-0 ml-auto cursor-pointer"
          title="Clear finished jobs"
        >
          Clear
        </button>
      )}
    </div>
  );
}
