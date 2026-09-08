/** Feature that triggered the AI request */
export type AiFeatureSource =
  | 'ai-chat'
  | 'tsx-generation'
  | 'tsx-analysis'
  | 'image-generation'
  | 'video-studio'
  | 'flows'
  | 'auto-cut'
  | 'studio-tsx-shot'
  | 'studio-shot-asset'
  | 'agent'
  | 'library-describe'
  | 'library-organize'
  | 'provider-test'
  | 'transcription'
  | 'other';

/** Type of AI request */
export type AiRequestType = 'llm' | 'image' | 'local-llm' | 'stt' | 'video';

/** A single logged AI API request */
export interface AiUsageEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  featureSource: AiFeatureSource;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number;
  durationMs: number;
  requestType: AiRequestType;
  /**
   * Which installed agent the request was made for — `<namespace>/<name>`,
   * set only when `featureSource` is `'agent'` (agents plan §9).
   *
   * `featureSource` alone cannot answer "what did this agent cost me", and it
   * never will: every agent shares the one source. It is optional because rows
   * logged before the column existed have no agent, and because most of the
   * app is not an agent at all.
   */
  agentId?: string;
}

/** Aggregated summary for the dashboard */
export interface AiUsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
}

/** Chart time period */
export type AiUsagePeriod = 'daily' | 'weekly' | 'monthly';

/**
 * What the chart's y-axis plots. Tokens only exist for LLM requests; requests
 * and cost make the non-token types (image, stt, video) visible.
 */
export type AiUsageMetric = 'tokens' | 'requests' | 'cost';

/** A single provider's token data across time buckets */
export interface AiUsageChartSeries {
  provider: string;
  data: number[];
}

/** Multi-line chart data: one line per provider */
export interface AiUsageChartData {
  labels: string[];
  series: AiUsageChartSeries[];
}

/** Filter for usage queries */
export interface AiUsageFilter {
  startDate?: string;
  endDate?: string;
  provider?: string;
  featureSource?: AiFeatureSource;
  agentId?: string;
}

/** One agent's share of the usage in a window — the by-agent breakdown. */
export interface AiUsageAgentTotal {
  agentId: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  costUsd: number;
}

/** Versioned storage format */
export interface AiUsageStorage {
  version: 1;
  entries: AiUsageEntry[];
}
