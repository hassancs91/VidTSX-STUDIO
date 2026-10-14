// A library row for a job that will add a project: a generation, or a build
// (P3 part 2) — clickable, with its latest still once it has looked.

import type { TsxJobIpc } from '@shared/ipc/types';
import { stillUrl } from '../services/build-panel-view';

interface Props {
  job: TsxJobIpc;
  /** The build the centre panel shows. */
  selected: boolean;
  /** Builds only: show this build in the centre panel. */
  onOpen?: (job: TsxJobIpc) => void;
}

export function PendingJobRow({ job, selected, onOpen }: Props) {
  const stills = job.build?.stills ?? [];
  const still = stills.find((s) => s.size === 'model') ?? stills[0];
  const clickable = Boolean(onOpen) && job.kind === 'build';
  return (
    <div
      role={clickable ? 'button' : undefined}
      onClick={clickable ? () => onOpen?.(job) : undefined}
      title={clickable ? 'Show this build' : undefined}
      className={`rounded-[6px] px-2 py-1.5 flex items-center gap-2 ${clickable ? 'cursor-pointer hover:bg-app-hover' : ''}`}
      style={{ border: `0.5px dashed ${selected ? 'var(--color-accent)' : 'var(--color-border)'}` }}
      data-pending-job={job.id}
    >
      {still ? (
        <img src={stillUrl(still.path)} alt="" className="w-7 h-7 rounded object-cover shrink-0 bg-app-base" />
      ) : (
        <div
          className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0"
          role="status"
        />
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] text-text-secondary truncate" title={job.prompt}>
          {job.projectName ?? job.prompt}
        </span>
        <span className="text-[9px] text-text-dim truncate">
          {job.status === 'queued'
            ? 'Queued'
            : `${job.progress.label} ${job.progress.percent}%`}
        </span>
      </div>
    </div>
  );
}
