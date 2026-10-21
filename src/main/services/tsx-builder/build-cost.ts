// The builder's cost before Start (TSX_BUILDER_DESIGN.md P5 part 3, P5-5):
// the measured tokens of the picked budget (build-budgets.ts
// MEASURED_BUILD_TOKENS, cheapest and dearest run) times the model's price.
// A Claude model on an Anthropic key is priced from the table below; an
// OpenRouter model from the list's `pricing` (openrouter-model-check.ts);
// the Claude subscription is "on your plan"; anything else, or a model with
// no price, is "cost unknown". Tokens only: generated images are not in it.
//
// Cache writes bill at 2× input: the Agent SDK writes the 1-hour cache. The
// rule (input + output + cache read + 2× input per cache write) gave the
// SDK's own `total_cost_usd` within 0.6 % on all 35 stored builds (10-21).

import type { BuildBudget, BuildTokens, TsxBuildCostEstimate } from '@shared/ipc/types';
import { measuredTokens } from '@shared/tsx-engine/build-budgets';
import { resolveProviderInfo, type ResolvedProviderInfo } from '../agents/tool-support';
import { fetchOpenRouterModels, isOpenRouterBaseUrl, type ModelPricing } from './openrouter-model-check';

/** USD per million tokens: input, output, cache read (claude-api skill, cached 2026-09-25). */
interface ClaudePrice {
  input: number;
  output: number;
  cacheRead: number;
}

export const CLAUDE_PRICES: Record<string, ClaudePrice> = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 },
};

/** The 1-hour cache write the Agent SDK uses, as a multiple of input. */
export const CACHE_WRITE_MULTIPLIER = 2;

/** `claude-haiku-4-5-20251001` → `claude-haiku-4-5`; a `[1m]` tag is dropped. */
export function claudePriceFor(model: string): ClaudePrice | undefined {
  const id = model.replace(/\[[^\]]*\]$/, '').trim();
  return CLAUDE_PRICES[id] ?? CLAUDE_PRICES[id.replace(/-\d{8}$/, '')];
}

/** A run's cost in USD at per-token prices. */
export function tokensCost(tokens: BuildTokens, price: ModelPricing): number {
  return (
    tokens.input * price.input +
    tokens.output * price.output +
    tokens.cacheRead * (price.cacheRead ?? price.input) +
    tokens.cacheCreation * (price.cacheWrite ?? price.input * CACHE_WRITE_MULTIPLIER)
  );
}

function claudePerToken(price: ClaudePrice): ModelPricing {
  return {
    input: price.input / 1e6,
    output: price.output / 1e6,
    cacheRead: price.cacheRead / 1e6,
    cacheWrite: (price.input * CACHE_WRITE_MULTIPLIER) / 1e6,
  };
}

/** The measured low/high run of the budget priced for a model (tokens keyed by the model, else Sonnet 5.5's). */
export function priceBudget(model: string, budget: BuildBudget, price: ModelPricing): { low: number; high: number } {
  const tokens = measuredTokens(model, budget);
  const low = tokensCost(tokens.low, price);
  const high = tokensCost(tokens.high, price);
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

/** `anthropic/claude-opus-5.5` → `claude-opus-5-5`, so a Claude model through OpenRouter uses its measured tokens. */
export function tokenModelFor(model: string): string {
  return model.replace(/^anthropic\//, '').replace(/\./g, '-');
}

const UNKNOWN: TsxBuildCostEstimate = { kind: 'unknown' };

/** The estimate for a resolved provider; OpenRouter's list is fetched (cached per app run). */
export async function estimateForProvider(
  info: ResolvedProviderInfo | null,
  model: string | undefined,
  budget: BuildBudget,
): Promise<TsxBuildCostEstimate> {
  if (!info) return UNKNOWN;
  const chosen = model || info.defaultModel;
  if (isOpenRouterBaseUrl(info.baseURL)) {
    if (!chosen) return UNKNOWN;
    const models = await fetchOpenRouterModels(info.baseURL!);
    const pricing = models?.get(chosen)?.pricing;
    if (!pricing) return UNKNOWN;
    return { kind: 'usd', ...priceBudget(tokenModelFor(chosen), budget, pricing), source: 'openrouter', model: chosen };
  }
  // Claude itself: the Agent SDK with no base URL (the other Anthropic-compatible presets carry one).
  if (info.type !== 'agent-sdk' || info.baseURL) return UNKNOWN;
  if (info.authMode === 'subscription') return { kind: 'plan' };
  if (info.authMode !== 'api-key' || !chosen) return UNKNOWN;
  const price = claudePriceFor(chosen);
  if (!price) return UNKNOWN;
  return { kind: 'usd', ...priceBudget(chosen, budget, claudePerToken(price)), source: 'claude', model: chosen };
}

/** The IPC entry: never throws; an unreadable setting is "cost unknown". */
export async function estimateBuildCost(req: { providerId?: string; model?: string; budget: BuildBudget }): Promise<TsxBuildCostEstimate> {
  try {
    return await estimateForProvider(await resolveProviderInfo(req.providerId), req.model, req.budget);
  } catch {
    return UNKNOWN;
  }
}
