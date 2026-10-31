// Main's decision-provider registration (DECISION_MODELS_DESIGN.md §4, §8) — the `image-init.ts:98-117` loop: every
// DECISION_PROVIDER_PRESETS entry whose `credentials[preset.credentialId]` exists registers (Jev ← `typesafe`, Microsoft-Decision-1 ←
// `openrouter`). Run again on every key change: a changed key re-registers, and — unlike image-init — a REMOVED key unregisters its rung,
// so the ladder and `decisions:status` flip back at once (§15.3 2). The LLM fallback is registered with the app's text engine injected.
// No local provider: D3 failed, the local rung stays empty (the ladder reports 'no local model').
//
// Pure wiring: no I/O here — decision-runtime.ts reads the credentials and the settings and calls this.

import {
  DECISION_PROVIDER_PRESETS,
  LlmFallbackProvider,
  type DecisionCredentialId,
  type DecisionEngine,
  type LlmFallbackGenerate,
} from '../../../decision-engine';
import type { HostedDecisionProviderId } from '../../../shared/types/decisions';

/** The decision slice of the BYOK credentials (main only — never sent to the renderer). */
export type DecisionCredentials = Partial<Record<DecisionCredentialId, string>>;

/** The app's text engine, injected (`llmEngine.generate` / "is a text provider active?"). */
export interface DecisionLlmDeps {
  generate: LlmFallbackGenerate;
  isReady: () => Promise<boolean>;
}

export interface DecisionRegistrationInput {
  credentials: DecisionCredentials;
  /** `decisionsOpenRouterModel` (§8) — the model the `openrouter-decisions` rung requests. */
  openRouterModel: string;
  llm: DecisionLlmDeps;
}

/** (Re-)registers the hosted presets that have a key and the LLM fallback; returns the hosted rungs now registered, in preset order. */
export function registerDecisionProviders(engine: DecisionEngine, input: DecisionRegistrationInput): HostedDecisionProviderId[] {
  const registered: HostedDecisionProviderId[] = [];
  for (const preset of DECISION_PROVIDER_PRESETS) {
    const id = preset.id as HostedDecisionProviderId;
    const apiKey = input.credentials[preset.credentialId];
    if (!apiKey) {
      engine.unregister(id);
      continue;
    }
    const model = id === 'openrouter-decisions' ? input.openRouterModel : preset.model;
    try {
      engine.register({ ...preset, model, apiKey });
      registered.push(id);
    } catch {
      engine.unregister(id);
    }
  }
  engine.registerInstance(new LlmFallbackProvider({ generate: input.llm.generate, isReady: input.llm.isReady }));
  return registered;
}
