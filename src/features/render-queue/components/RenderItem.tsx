import { useState } from 'react';
import { Button } from '@shared/components';
import type { RenderQueueJob } from '@shared/ipc/types';
import { RenderProgress } from './RenderProgress';
import { RenderItemDetails } from './RenderItemDetails';
import { getFormatLabel, formatResolution, formatFileSize } from '../services/queue-manager';
import { useJobProgress } from '../contexts/RenderQueueContext';

interface RenderItemProps {
  job: RenderQueueJob;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}

const PlayIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="currentColor"
    stroke="none"
  >
    <path d="M4 2.5L11 7L4 11.5V2.5Z" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width={12}
    height={12}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s ease',
    }}
  >
    <path d="M4 2.5L8 6L4 9.5" />
  </svg>
);

const statusColors: Record<string, string> = {
  rendering: 'var(--color-accent)',
  queued: 'var(--color-text-dim)',
  done: 'var(--color-accent-green)',
  error: 'var(--color-accent-red)',
  cancelled: 'var(--color-text-dim)',
};

export function RenderItem({ job, onCancel, onRetry, onOpenFile, onOpenFolder }: RenderItemProps) {
  const [showError, setShowError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const liveProgress = useJobProgress(job.status === 'rendering' ? job.id : undefined);
  const progress = liveProgress?.percent ?? job.progress;

  const getStatusText = () => {
    switch (job.status) {
      case 'rendering': {
        const phase = liveProgress?.phase;
        if (phase && phase !== 'rendering') {
          const label =
            phase === 'preparing' ? 'Preparing' :
            phase === 'extracting_audio' ? 'Extracting audio' :
            phase === 'bundling' ? 'Bundling' :
            phase === 'finishing' ? (liveProgress?.message ?? 'Finishing') :
            phase === 'verifying' ? 'Verifying' : 'Working';
          return `${label}... ${Math.round(progress)}%`;
        }
        // An engine's notice while it renders (docs/export-engines-plan.md D4).
        if (liveProgress?.message) return `${liveProgress.message} ${Math.round(progress)}%`;
        return `${Math.round(progress)}%`;
      }
      case 'queued':
        return 'Queued';
      case 'done':
        return 'Done';
      case 'error':
        return 'Error';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  };

  const formatLabel = getFormatLabel(job.codec);
  const scale = job.scale ?? 1;
  const resolutionLabel = formatResolution(
    Math.round(job.width * scale),
    Math.round(job.height * scale)
  );

  return (
    <div
      className="flex flex-col border-b"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide details' : 'Show details'}
          className="w-5 h-5 flex items-center justify-center text-text-dim hover:text-text-secondary transition-colors shrink-0"
        >
          <ChevronIcon expanded={expanded} />
        </button>

        {/* Status icon */}
        <div
          className="w-8 h-8 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: statusColors[job.status] }}
        >
          <span className="text-white">
            <PlayIcon />
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-text-primary truncate">
            {job.fileName}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-text-dim">
            <span>{formatLabel}</span>
            <span className="text-text-ghost">/</span>
            <span>{resolutionLabel}</span>
            {job.status === 'done' && job.fileSize && (
              <>
                <span className="text-text-ghost">/</span>
                <span>{formatFileSize(job.fileSize)}</span>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        <RenderProgress progress={progress} status={job.status} />

        {/* Status text */}
        <div
          className="w-16 text-[11px] text-right"
          style={{ color: statusColors[job.status] }}
        >
          {getStatusText()}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 ml-2">
          {(job.status === 'rendering' || job.status === 'queued') && (
            <Button variant="secondary" onClick={() => onCancel(job.id)}>
              Cancel
            </Button>
          )}
          {job.status === 'done' && (
            <>
              <Button variant="secondary" onClick={() => onOpenFile(job.outputPath)}>
                Open
              </Button>
              <Button variant="secondary" onClick={() => onOpenFolder(job.outputPath)}>
                Folder
              </Button>
            </>
          )}
          {job.status === 'error' && (
            <>
              <Button variant="secondary" onClick={() => onRetry(job.id)}>
                Retry
              </Button>
              <button
                onClick={() => setShowError(!showError)}
                className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                {showError ? 'Hide' : 'Details'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error details */}
      {job.status === 'error' && showError && job.error && (
        <div
          className="px-3 pb-2.5 pt-0"
          style={{ marginLeft: 76 }}
        >
          <div
            className="text-[10px] text-accent-red font-mono p-2 rounded"
            style={{ backgroundColor: 'rgba(240, 149, 149, 0.1)' }}
          >
            {job.error}
          </div>
        </div>
      )}

      {/* Expanded details panel */}
      {expanded && <RenderItemDetails job={job} />}
    </div>
  );
}
