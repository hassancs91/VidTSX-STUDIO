/**
 * The decision contract (DECISION_MODELS_DESIGN.md §3) — typed questions about a state → typed answers with probabilities.
 * Shared by main, `src/decision-engine/` and the renderer's status view: no electron / Node import here.
 *
 * A probability is NOT a fact (§1, the E3 lesson): callers consume a decision as an order, a gate or a route; the number appears only
 * in logs, a flow's run record and the developer tester — never shown to the user or the assistant as a claim.
 */
import type { AiFeatureSource } from './ai-usage';

/**
 * The rungs that can answer. `openrouter-decisions` is the Microsoft-Decision-1 rung over OpenRouter's Decisions API (§3 / §15.1 call it
 * `openrouter`; the id is the preset's, §4 / §8). No `openai` id: OpenAI is dropped (Hasan, E-e). `local` stays in the union (§3) though no
 * local model ships in this slice (D3 failed) — a pinned `local` yields `no-provider`.
 */
export type DecisionProviderId = 'local' | 'jev' | 'openrouter-decisions' | 'llm';

/** Every rung id, in the `auto` ladder's fixed outer order (local → hosted → llm, §6). */
export const DECISION_PROVIDER_IDS: readonly DecisionProviderId[] = ['local', 'jev', 'openrouter-decisions', 'llm'];

/** The hosted rungs the user can order or switch off (§8 `decisionsHostedOrder`). */
export type HostedDecisionProviderId = 'jev' | 'openrouter-decisions';

/** §8 default for `decisionsHostedOrder`. */
export const DEFAULT_DECISIONS_HOSTED_ORDER: readonly HostedDecisionProviderId[] = ['jev', 'openrouter-decisions'];

/** What a request may ask for: `auto` (the ladder, default) or one pinned rung (never falls back). */
export type DecisionProviderChoice = 'auto' | DecisionProviderId;

/** §8 `decisionsMode`: `off` → every request is `no-provider` without a network call. */
export type DecisionsMode = 'auto' | 'off';

/**
 * The task family the caller declares (§15.1). `calibrated: true` is earned per (provider, model, family); `other` (the default) is never
 * calibrated in slice 1.
 */
export type DecisionTaskFamily = 'routing' | 'verify' | 'other';

export type DecisionQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } } // → P(true)
  | { type: 'choice'; instructions: string; criteria: Record<string, string> } // option id → description (2..255)
  | { type: 'score'; instructions: string; criteria: string[] }; // ordered levels, 2–10

export interface DecisionRequest {
  /** The evidence, sent ONCE per request (the option lists live in criteria). */
  state: string | Record<string, unknown> | unknown[];
  /** Keyed by the caller's names (System One). */
  questions: Record<string, DecisionQuestion>;
  /** `auto` (default) or a pinned rung. */
  provider?: DecisionProviderChoice;
  /** Who asks — the usage log's column (§9). */
  featureSource: AiFeatureSource;
  /** May `auto` end at the LLM fallback (default false). */
  allowUncalibrated?: boolean;
  /** The caller's budget (§9 defaults). */
  timeoutMs?: number;
  /** The task family for `calibrated` (§15.1; default `other` → never calibrated). */
  family?: DecisionTaskFamily;
}

export type DecisionAnswer =
  | { type: 'noul'; p: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: Record<string, number>; confidence: number }
  | { type: 'refused'; reason: string };

export interface DecisionResult {
  answers: Record<string, DecisionAnswer>;
  provider: DecisionProviderId;
  /** As served (e.g. 'jev-1.14.0', 'microsoft/microsoft-decision-1-20261009'). */
  model: string;
  /** §1: earned per (provider, model, task family) — §15.1. */
  calibrated: boolean;
  usage: { inputTokens: number; costUsd: number };
  latencyMs: number;
  cached: boolean;
  /** The rungs `auto` passed over, in plain words. */
  skipped?: Array<{ provider: DecisionProviderId; why: string }>;
}

/**
 * Typed error codes (§3). `invalid-request` = a malformed request (fewer than 2 options or levels, empty instructions, no question, a
 * wrong field type) — `unsupported` stays "over every available adapter's limits".
 */
export type DecisionErrorCode =
  | 'no-provider'
  | 'unsupported'
  | 'timeout'
  | 'provider-error'
  | 'invalid-answer'
  | 'cancelled'
  | 'invalid-request';
