import { useState, useEffect, useCallback } from 'react';
import type { AiUsageSummary, AiUsageChartData, AiUsageEntry, AiUsagePeriod } from '../../shared/types/ai-usage';

export function useAiUsage() {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [chartData, setChartData] = useState<AiUsageChartData | null>(null);
  const [logEntries, setLogEntries] = useState<AiUsageEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [period, setPeriod] = useState<AiUsagePeriod>('daily');
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined);

  const loadSummary = useCallback(async () => {
    const res = await window.api.aiUsageGetSummary({ provider: providerFilter });
    if (res.success && res.summary) {
      setSummary(res.summary);
    }
  }, [providerFilter]);

  const loadChart = useCallback(async () => {
    const res = await window.api.aiUsageGetChart({ period, provider: providerFilter });
    if (res.success && res.chartData) {
      setChartData(res.chartData);
    }
  }, [period, providerFilter]);

  const loadLog = useCallback(async (offset = 0) => {
    const res = await window.api.aiUsageGetLog({ limit: 50, offset, provider: providerFilter });
    if (res.success && res.entries) {
      if (offset === 0) {
        setLogEntries(res.entries);
      } else {
        setLogEntries((prev) => [...prev, ...res.entries!]);
      }
      setLogTotal(res.total ?? 0);
    }
  }, [providerFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadSummary(), loadChart(), loadLog(0)]);
    setLoading(false);
  }, [loadSummary, loadChart, loadLog]);

  const loadMore = useCallback(() => {
    loadLog(logEntries.length);
  }, [loadLog, logEntries.length]);

  const clearUsage = useCallback(async () => {
    await window.api.aiUsageClear();
    setSummary(null);
    setChartData(null);
    setLogEntries([]);
    setLogTotal(0);
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch chart when period changes
  useEffect(() => {
    loadChart();
  }, [loadChart]);

  return {
    summary,
    chartData,
    logEntries,
    logTotal,
    period,
    setPeriod,
    providerFilter,
    setProviderFilter,
    loading,
    refresh,
    loadMore,
    clearUsage,
    hasMore: logEntries.length < logTotal,
  };
}
