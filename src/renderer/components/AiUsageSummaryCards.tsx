import type { AiUsageSummary } from '../../shared/types/ai-usage';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDuration(totalMs: number, count: number): string {
  if (count === 0) return '—';
  const avgMs = totalMs / count;
  if (avgMs >= 1_000) return (avgMs / 1_000).toFixed(1) + 's';
  return Math.round(avgMs) + 'ms';
}

interface SummaryCardProps {
  label: string;
  value: string;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border flex-1 min-w-0">
      <div className="text-[10px] text-text-dim uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[18px] font-semibold text-text-primary truncate">{value}</div>
    </div>
  );
}

interface AiUsageSummaryCardsProps {
  summary: AiUsageSummary | null;
}

export function AiUsageSummaryCards({ summary }: AiUsageSummaryCardsProps) {
  if (!summary) {
    return (
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-app-surface rounded-lg p-3 border border-border flex-1 min-w-0 animate-pulse">
            <div className="h-[10px] bg-app-hover rounded w-16 mb-2" />
            <div className="h-[18px] bg-app-hover rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <SummaryCard label="Requests" value={summary.totalRequests.toLocaleString()} />
      <SummaryCard
        label="Tokens Used"
        value={formatTokens(summary.totalInputTokens + summary.totalOutputTokens)}
      />
      <SummaryCard
        label="Avg Duration"
        value={formatDuration(summary.totalDurationMs, summary.totalRequests)}
      />
    </div>
  );
}
