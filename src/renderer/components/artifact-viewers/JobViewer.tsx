// `job` — one row for a render or a video generation (agents plan §1.3, §1.4).
//
// One kind covers both because a job artifact has the same before/after split
// `RenderItem` has: at submit time it holds an id and a status and NOTHING the
// output will have. So this shows progress until the job is terminal, and then
// points at the `video` artifact that carries the result — it never reads an
// output field off a job that has not settled.

import { CheckCircle2, CircleSlash, Film, Loader2, XCircle } from 'lucide-react';
import type { AgentJobStatus } from '../../../shared/types/agents';
import type { ArtifactViewerProps } from './types';

const STATUS_COLOR: Record<AgentJobStatus, string> = {
  pending: 'var(--color-text-dim)',
  running: 'var(--color-accent)',
  completed: 'var(--color-accent-green)',
  failed: 'var(--color-accent-red)',
  cancelled: 'var(--color-text-dim)',
};

const STATUS_LABEL: Record<AgentJobStatus, string> = {
  pending: 'Queued',
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function StatusIcon({ status }: { status: AgentJobStatus }) {
  const props = { size: 14, strokeWidth: 1.75 } as const;
  if (status === 'completed') return <CheckCircle2 {...props} className="text-accent-green" />;
  if (status === 'failed') return <XCircle {...props} className="text-accent-red" />;
  if (status === 'cancelled') return <CircleSlash {...props} className="text-text-dim" />;
  if (status === 'running') return <Loader2 {...props} className="text-accent animate-spin" />;
  return <Film {...props} className="text-text-dim" />;
}

export function JobViewer({ artifact, live }: ArtifactViewerProps) {
  if (artifact.kind !== 'job') return null;
  const { status, progress, error, job, resultArtifactId } = artifact.payload;
  const percent = live?.progress ?? progress ?? (status === 'completed' ? 100 : 0);

  return (
    <div className="flex items-center justify-center h-full w-full p-6">
      <div
        className="w-full max-w-[420px] rounded-[8px] bg-app-surface p-4"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <StatusIcon status={status} />
          <span className="text-[12px] font-medium text-text-primary truncate">{artifact.title}</span>
        </div>
        <div className="text-[10px] text-text-dim mb-3">
          {job === 'render' ? 'Render queue' : 'Video generation'} ·{' '}
          {live?.statusText ?? STATUS_LABEL[status]}
        </div>

        <div className="h-[4px] rounded-[2px] bg-app-hover overflow-hidden">
          <div
            className="h-full transition-[width] duration-200"
            style={{
              width: `${Math.max(0, Math.min(100, percent))}%`,
              backgroundColor: STATUS_COLOR[status],
            }}
          />
        </div>

        {error ? <div className="mt-3 text-[11px] text-accent-red leading-snug">{error}</div> : null}
        {resultArtifactId ? (
          <div className="mt-3 text-[11px] text-text-muted">
            The finished video is artifact{' '}
            <span className="text-accent-light">{resultArtifactId}</span> — select it on the
            filmstrip.
          </div>
        ) : null}
        {live?.onCancel && (status === 'pending' || status === 'running') ? (
          <button
            onClick={live.onCancel}
            className="mt-3 rounded-[6px] px-2.5 py-1 text-[11px] text-text-secondary hover:bg-app-hover"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
