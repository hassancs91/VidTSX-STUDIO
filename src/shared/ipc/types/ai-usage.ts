import type { AiUsageAgentTotal, AiUsageSummary, AiUsagePeriod, AiUsageMetric, AiUsageChartData, AiUsageEntry, AiFeatureSource } from '@shared/types/ai-usage';

// ─── AI Usage tracking ───
export interface AiUsageGetSummaryRequest {
  startDate?: string;
  endDate?: string;
  provider?: string;
}

export interface AiUsageGetSummaryResponse {
  success: boolean;
  summary?: AiUsageSummary;
  error?: string;
}

export interface AiUsageGetChartRequest {
  period: AiUsagePeriod;
  /** Y-axis metric; defaults to 'tokens'. */
  metric?: AiUsageMetric;
  startDate?: string;
  endDate?: string;
  provider?: string;
}

export interface AiUsageGetChartResponse {
  success: boolean;
  chartData?: AiUsageChartData;
  error?: string;
}

export interface AiUsageGetLogRequest {
  limit?: number;
  offset?: number;
  provider?: string;
  featureSource?: AiFeatureSource;
  /** `<namespace>/<name>` — one agent's own rows (agents plan §9). */
  agentId?: string;
}

export interface AiUsageGetAgentsRequest {
  startDate?: string;
  endDate?: string;
  provider?: string;
}

export interface AiUsageGetAgentsResponse {
  success: boolean;
  agents?: AiUsageAgentTotal[];
  error?: string;
}

export interface AiUsageGetLogResponse {
  success: boolean;
  entries?: AiUsageEntry[];
  total?: number;
  error?: string;
}

export interface AiUsageClearResponse {
  success: boolean;
  error?: string;
}
