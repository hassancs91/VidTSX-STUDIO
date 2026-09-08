import { useState, useEffect, useCallback } from 'react';
import type { AiUsageAgentTotal, AiUsageSummary, AiUsageChartData, AiUsageEntry, AiUsagePeriod, AiUsageMetric } from '../../shared/types/ai-usage';

export function useAiUsage() {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [chartData, setChartData] = useState<AiUsageChartData | null>(null);
  const [logEntries, setLogEntries] = useState<AiUsageEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [period, setPeriod] = useState<AiUsagePeriod>('daily');
  const [metric, setMetric] = useState<AiUsageMetric>('tokens');
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined);
  /** Usage grouped by agent, and the agent the log is narrowed to (§9). */
  const [agentTotals, setAgentTotals] = useState<AiUsageAgentTotal[]>([]);
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);

  const loadSummary = useCallback(async () => {
    const res = await window.api.aiUsageGetSummary({ provider: providerFilter });
    if (res.success && res.summary) {
      setSummary(res.summary);
    }
  }, [providerFilter]);

  const loadChart = useCallback(async () => {
    const res = await window.api.aiUsageGetChart({ period, metric, provider: providerFilter });
    if (res.success && res.chartData) {
      setChartData(res.chartData);
    }
  }, [period, metric, providerFilter]);

  const loadAgents = useCallback(async () => {
    const res = await window.api.aiUsageGetAgents({ provider: providerFilter });
    if (res.success && res.agents) setAgentTotals(res.agents);
  }, [providerFilter]);

  const loadLog = useCallback(async (offset = 0) => {
    const res = await window.api.aiUsageGetLog({
      limit: 50,
      offset,
      provider: providerFilter,
      ...(agentFilter ? { agentId: agentFilter } : {}),
    });
    if (res.success && res.entries) {
      if (offset === 0) {
        setLogEntries(res.entries);
      } else {
        setLogEntries((prev) => [...prev, ...res.entries!]);
      }
      setLogTotal(res.total ?? 0);
    }
  }, [providerFilter, agentFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadSummary(), loadChart(), loadAgents(), loadLog(0)]);
    setLoading(false);
  }, [loadSummary, loadChart, loadAgents, loadLog]);

  const loadMore = useCallback(() => {
    loadLog(logEntries.length);
  }, [loadLog, logEntries.length]);

  const clearUsage = useCallback(async () => {
    await window.api.aiUsageClear();
    setSummary(null);
    setChartData(null);
    setLogEntries([]);
    setLogTotal(0);
    setAgentTotals([]);
    setAgentFilter(undefined);
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch chart when period or metric changes
  useEffect(() => {
    loadChart();
  }, [loadChart]);

  // Narrowing the log to one agent re-reads only the log; the totals above it
  // are what the user is choosing FROM, so they must not move underneath them.
  useEffect(() => {
    void loadLog(0);
  }, [loadLog]);

  return {
    summary,
    chartData,
    logEntries,
    logTotal,
    period,
    setPeriod,
    metric,
    setMetric,
    providerFilter,
    setProviderFilter,
    agentTotals,
    agentFilter,
    setAgentFilter,
    loading,
    refresh,
    loadMore,
    clearUsage,
    hasMore: logEntries.length < logTotal,
  };
}
