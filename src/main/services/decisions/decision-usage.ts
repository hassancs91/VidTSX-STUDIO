// The decision engine's usage listener → the AI-usage log (DECISION_MODELS_DESIGN.md §9; D-r17 (1), D-r18 (2)–(3)). One row per provider
// HTTP call — the engine emits an event only for a real call, never for a cache hit or a request that shared an in-flight call:
// `provider` = the KEY's registry id (`typesafe` / `openrouter`; the rung id is a different field), `model` as served,
// `requestType: 'decision'`, the caller's `decision-*` featureSource, input tokens (output is free on System One), `costUsd` as the adapter
// computed it (the provider-reported cost, else input tokens × the preset's price), `durationMs`.
//
// The `llm` rung is logged here ONCE, as provider `llm`: `llmEngine.generate` writes no usage row of its own (decision-usage.test.ts
// scans src/engine/ for that). Its event carries input tokens and the reported cost only.

import type { AiUsageEntry } from '../../../shared/types/ai-usage';
import { DECISION_PROVIDER_PRESETS, type DecisionProviderId, type DecisionUsageEvent } from '../../../decision-engine';

type UsageRow = Omit<AiUsageEntry, 'id'>;

/** The usage row's `provider`: the registry id of the key that paid for the call (§9). */
function usageProviderOf(rung: DecisionProviderId): string {
  const preset = DECISION_PROVIDER_PRESETS.find((p) => p.id === rung);
  if (preset) return preset.credentialId;
  return rung === 'local' ? 'local-decider' : rung;
}

export function decisionUsageEntry(event: DecisionUsageEvent, now: Date): UsageRow {
  return {
    timestamp: now.toISOString(),
    provider: usageProviderOf(event.provider),
    model: event.model,
    featureSource: event.featureSource,
    inputTokens: event.inputTokens,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    costUsd: event.costUsd,
    durationMs: event.durationMs,
    requestType: 'decision',
  };
}

/** `decisionEngine.setUsageListener(createDecisionUsageListener(aiUsageService.appendEntry))` — fire and forget; a failed write never fails a decision. */
export function createDecisionUsageListener(
  append: (entry: UsageRow) => Promise<unknown> | void,
  now: () => Date = () => new Date(),
): (event: DecisionUsageEvent) => void {
  return (event) => {
    try {
      const pending = append(decisionUsageEntry(event, now()));
      if (pending) pending.catch(() => undefined);
    } catch {
      // the usage log never fails a decision
    }
  };
}
