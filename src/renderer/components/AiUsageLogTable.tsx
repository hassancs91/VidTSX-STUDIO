import { Button } from '@shared/components';
import type { AiUsageEntry } from '../../shared/types/ai-usage';

interface AiUsageLogTableProps {
  entries: AiUsageEntry[];
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDuration(ms: number): string {
  if (ms >= 1_000) return (ms / 1_000).toFixed(1) + 's';
  return Math.round(ms) + 'ms';
}

const GRID_COLS = '120px 80px 1fr 70px 70px 80px 120px';

export function AiUsageLogTable({ entries, total, hasMore, onLoadMore }: AiUsageLogTableProps) {
  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div
        className="grid items-center px-3 h-[32px] text-[10px] font-medium text-text-dim uppercase tracking-wider gap-x-2"
        style={{ gridTemplateColumns: GRID_COLS, borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span>Timestamp</span>
        <span>Provider</span>
        <span>Model</span>
        <span className="text-right">In Tokens</span>
        <span className="text-right">Out Tokens</span>
        <span className="text-right">Duration</span>
        <span>Source</span>
      </div>

      {entries.length === 0 ? (
        <div className="p-4 text-[12px] text-text-muted text-center">
          No usage entries yet. Make some AI requests to see data here.
        </div>
      ) : (
        entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`grid items-center px-3 gap-x-2 h-[36px] hover:bg-app-hover transition-colors text-[11px] ${
              index !== entries.length - 1 ? 'border-b border-border' : ''
            }`}
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span className="text-text-muted truncate">{formatTimestamp(entry.timestamp)}</span>
            <span className="text-text-secondary truncate">{entry.provider}</span>
            <span className="text-text-muted font-mono text-[10px] truncate">{entry.model}</span>
            <span className="text-text-muted text-right">{entry.inputTokens.toLocaleString()}</span>
            <span className="text-text-muted text-right">{entry.outputTokens.toLocaleString()}</span>
            <span className="text-text-dim text-right">{formatDuration(entry.durationMs)}</span>
            <span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent/10 text-accent-light truncate">
                {entry.featureSource}
              </span>
            </span>
          </div>
        ))
      )}

      {/* Footer with load more and total count */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border">
          <span className="text-[10px] text-text-dim">
            Showing {entries.length} of {total.toLocaleString()} entries
          </span>
          {hasMore && (
            <Button variant="secondary" onClick={onLoadMore}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
