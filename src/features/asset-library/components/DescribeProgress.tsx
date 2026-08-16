interface DescribeProgressProps {
  running: boolean;
  done: number;
  total: number;
  summary: { succeeded: number; failed: number; canceled: boolean } | null;
  onCancel: () => void;
}

/**
 * Batch describe progress (ASSET_LIBRARY_DESIGN.md L2) — per-item counts
 * from the job event stream, and a summary once the run ends.
 *
 * The summary reports failures as a COUNT beside the successes rather than
 * as an error banner, because that is what they are: per-item failures that
 * left the rest of the batch intact. The assets that failed simply still
 * have no description, and the user can run it again.
 */
export function DescribeProgress({
  running,
  done,
  total,
  summary,
  onCancel,
}: DescribeProgressProps) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      data-describe-progress
      className="flex items-center gap-3 px-3 py-2 rounded bg-app-surface"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      {running ? (
        <>
          <span className="text-[11px] text-text-secondary shrink-0">
            Describing {done}/{total}
          </span>
          <div className="flex-1 h-1 rounded-full bg-app-base overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 px-2 py-0.5 rounded text-[11px] text-text-muted hover:text-text-primary hover:bg-app-hover"
          >
            Cancel
          </button>
        </>
      ) : (
        summary && (
          <span className="text-[11px] text-text-secondary" data-describe-summary>
            {summary.canceled ? 'Describe canceled — ' : 'Described '}
            {summary.succeeded} asset{summary.succeeded === 1 ? '' : 's'}
            {summary.failed > 0 && (
              <span className="text-text-muted">
                {' '}
                · {summary.failed} failed and {summary.failed === 1 ? 'still has' : 'still have'} no
                description
              </span>
            )}
          </span>
        )
      )}
    </div>
  );
}
