import type { AiUsageSummary, AiUsagePeriod, AiUsageChartData, AiUsageEntry, AiFeatureSource } from '@shared/types/ai-usage';

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
