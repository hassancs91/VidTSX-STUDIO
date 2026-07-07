import { useCallback, useMemo, useState } from 'react';
import { Button } from '@shared/components';
import { EmptyState } from '@renderer/components/EmptyState';
import type { RenderCodec, RenderHistoryEntry, RenderQueueJob } from '@shared/ipc/types';
import { useRenderQueue } from '../hooks/useRenderQueue';
import { useRenderHistory } from '../hooks/useRenderHistory';
import { RenderItem } from './RenderItem';

const DISMISSED_STORAGE_KEY = 'render-queue:dismissed-output-paths';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set<string>(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage may be unavailable or full — dismissal stays in-memory only.
  }
}

const PlayIcon = () => (
  <svg
    width={48}
    height={48}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 10V38L38 24L14 10Z" />
  </svg>
);

function historyEntryToJob(entry: RenderHistoryEntry): RenderQueueJob {
  const fileName =
    entry.fileName ??
    entry.outputPath.split(/[/\\]/).pop() ??
    entry.outputPath;
  return {
    id: `history:${entry.outputPath}`,
    fileName,
    filePath: entry.filePath,
    compositionId: '',
    outputPath: entry.outputPath,
    codec: (entry.codec as RenderCodec) ?? 'h264',
    width: entry.width ?? 1920,
    height: entry.height ?? 1080,
    fps: 30,
    scale: entry.scale ?? 1,
    status: 'done',
    progress: 100,
    framesRendered: 0,
    totalFrames: 0,
    fileSize: entry.fileSize,
    createdAt: entry.completedAt,
    completedAt: entry.completedAt,
  };
}

export function RenderScreen() {
  const { jobs, cancelJob, retryJob, clearCompleted, openFile, openFolder } = useRenderQueue();
  const { entries, reload } = useRenderHistory();
  const [dismissedPaths, setDismissedPaths] = useState<Set<string>>(() => loadDismissed());

  const displayJobs = useMemo(() => {
    const queueOutputs = new Set(
      jobs.map((j) => j.outputPath).filter(Boolean)
    );
    const historyDerived = entries
      .filter(
        (e) =>
          e.exists &&
          e.outputPath &&
          !queueOutputs.has(e.outputPath) &&
          !dismissedPaths.has(normalizePath(e.outputPath))
      )
      .sort((a, b) => b.completedAt - a.completedAt)
      .map(historyEntryToJob);
    return [...jobs, ...historyDerived];
  }, [jobs, entries, dismissedPaths]);

  const hasClearableJobs = useMemo(
    () => displayJobs.some(
      (j) => j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
    ),
    [displayJobs]
  );

  const handleClearCompleted = useCallback(() => {
    const next = new Set(dismissedPaths);
    for (const j of displayJobs) {
      if (
        (j.status === 'done' || j.status === 'error' || j.status === 'cancelled') &&
        j.outputPath
      ) {
        next.add(normalizePath(j.outputPath));
      }
    }
    setDismissedPaths(next);
    saveDismissed(next);
    clearCompleted();
    setTimeout(reload, 50);
  }, [displayJobs, dismissedPaths, clearCompleted, reload]);

  if (displayJobs.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <span className="text-[13px] font-medium text-text-secondary">
            Render queue
          </span>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<PlayIcon />}
            title="No renders yet"
            description="Open a file and click Render to start"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-secondary">
          Render queue
        </span>
        {hasClearableJobs && (
          <Button variant="secondary" onClick={handleClearCompleted}>
            Clear completed
          </Button>
        )}
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-auto bg-app-base">
        {displayJobs.map((job) => (
          <RenderItem
            key={job.id}
            job={job}
            onCancel={cancelJob}
            onRetry={retryJob}
            onOpenFile={openFile}
            onOpenFolder={openFolder}
          />
        ))}
      </div>
    </div>
  );
}
