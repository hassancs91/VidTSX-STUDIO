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

/** Per hosted rung, a base URL that replaces the preset's (only ever a dev stub's — `resolveDecisionStubURLs`). */
export type DecisionBaseURLs = Partial<Record<HostedDecisionProviderId, string>>;

export interface DecisionRegistrationInput {
  credentials: DecisionCredentials;
  /** `decisionsOpenRouterModel` (§8) — the model the `openrouter-decisions` rung requests. */
  openRouterModel: string;
  llm: DecisionLlmDeps;
  /** Ruling D-r21's dev stub URLs (resolved once at start); absent → every preset's own URL. */
  baseURLs?: DecisionBaseURLs;
}

/** Ruling D-r21: the two variables, one per hosted rung (so §15.3 5 can tell the OpenRouter-shaped call from Jev's). */
export const DECISION_STUB_URL_ENV: Record<HostedDecisionProviderId, string> = {
  jev: 'VIDTSX_DECISIONS_JEV_URL',
  'openrouter-decisions': 'VIDTSX_DECISIONS_OPENROUTER_URL',
};

export interface DecisionStubURLInput {
  /** `app.isPackaged` — a packaged app never honours a stub URL. */
  isPackaged: boolean;
  env: Readonly<Record<string, string | undefined>>;
  log: (line: string) => void;
  warn: (line: string) => void;
}

/** `host:port` when the URL is plain http on 127.0.0.1 / localhost without credentials; else null. */
function loopbackHost(raw: string): string | null {
  try {
    const url = new URL(raw);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    return url.protocol === 'http:' && loopback && !url.username && !url.password ? url.host : null;
  } catch {
    return null;
  }
}

/**
 * Ruling D-r21 — the dev-only stub hook (§15.3 1 / 3 / 4 / 5 without a real key): a set variable replaces its rung's preset URL ONLY when
 * the app is not packaged AND the URL is http on 127.0.0.1 / localhost (any port); otherwise it is ignored with one warning (naming the
 * variable, never the URL). One log line per rung in use, naming host:port only. The key still comes from the credential store.
 */
export function resolveDecisionStubURLs(input: DecisionStubURLInput): DecisionBaseURLs {
  const out: DecisionBaseURLs = {};
  for (const id of Object.keys(DECISION_STUB_URL_ENV) as HostedDecisionProviderId[]) {
    const name = DECISION_STUB_URL_ENV[id];
    const raw = input.env[name]?.trim();
    if (!raw) continue;
    const host = input.isPackaged ? null : loopbackHost(raw);
    if (!host) {
      input.warn(`decisions: ${name} ignored — a dev stub URL is honoured only in an unpackaged app, on http://127.0.0.1 or http://localhost`);
      continue;
    }
    out[id] = raw;
    input.log(`decisions: dev stub URL in use for ${id} (${host})`);
  }
  return out;
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
    const stubURL = input.baseURLs?.[id];
    // On a stub host the OpenRouter rung keeps its OpenRouter shape (noul criteria) — the adapter would otherwise detect it by host.
    const stub = stubURL ? { baseURL: stubURL, noulCriteriaRequired: id === 'openrouter-decisions' } : {};
    try {
      engine.register({ ...preset, model, apiKey, ...stub });
      registered.push(id);
    } catch {
      engine.unregister(id);
    }
  }
  engine.registerInstance(new LlmFallbackProvider({ generate: input.llm.generate, isReady: input.llm.isReady }));
  return registered;
}
