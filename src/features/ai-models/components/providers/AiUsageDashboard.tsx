import { Button } from '@shared/components';
import { useAiUsage } from '@renderer/hooks/useAiUsage';
import { AiUsageSummaryCards } from '@renderer/components/AiUsageSummaryCards';
import { AiUsageChart } from '@renderer/components/AiUsageChart';
import { AiUsageLogTable } from '@renderer/components/AiUsageLogTable';
import { AiUsageByAgent } from '@renderer/components/AiUsageByAgent';

export function AiUsageDashboard() {
  const {
    summary,
    chartData,
    logEntries,
    logTotal,
    period,
    setPeriod,
    metric,
    setMetric,
    agentTotals,
    agentFilter,
    setAgentFilter,
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
      <AiUsageChart
        chartData={chartData}
        period={period}
        onPeriodChange={setPeriod}
        metric={metric}
        onMetricChange={setMetric}
      />

      {/* By agent — renders nothing until an agent has actually run (§9) */}
      <AiUsageByAgent agents={agentTotals} selected={agentFilter} onSelect={setAgentFilter} />

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
