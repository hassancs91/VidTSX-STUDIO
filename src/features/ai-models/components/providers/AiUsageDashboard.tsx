import { Button } from '@shared/components';
import { useAiUsage } from '@renderer/hooks/useAiUsage';
import { AiUsageSummaryCards } from '@renderer/components/AiUsageSummaryCards';
import { AiUsageChart } from '@renderer/components/AiUsageChart';
import { AiUsageLogTable } from '@renderer/components/AiUsageLogTable';

export function AiUsageDashboard() {
  const {
    summary,
    chartData,
    logEntries,
    logTotal,
    period,
    setPeriod,
    loading,
    refresh,
    loadMore,
    clearUsage,
    hasMore,
  } = useAiUsage();

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-text-secondary">AI Usage</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button
            variant="secondary"
            onClick={clearUsage}
            className="!text-accent-red hover:!text-accent-red"
          >
            Clear Data
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <AiUsageSummaryCards summary={summary} />

      {/* Chart */}
      <AiUsageChart chartData={chartData} period={period} onPeriodChange={setPeriod} />

      {/* Log table */}
      <AiUsageLogTable
        entries={logEntries}
        total={logTotal}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}
