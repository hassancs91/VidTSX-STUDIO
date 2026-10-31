/**
 * The decision engine's types (DECISION_MODELS_DESIGN.md §4): the contract (§3, re-exported from shared) plus what a provider
 * implements. Process-neutral — no electron, no fs (the `src/image-engine/` shape).
 */
import type {
  DecisionAnswer,
  DecisionErrorCode,
  DecisionProviderId,
  DecisionRequest,
} from '../shared/types/decisions';

export type {
  DecisionAnswer,
  DecisionErrorCode,
  DecisionProviderChoice,
  DecisionProviderId,
  DecisionQuestion,
  DecisionRequest,
  DecisionResult,
  DecisionsMode,
  DecisionTaskFamily,
  HostedDecisionProviderId,
} from '../shared/types/decisions';
export { DECISION_PROVIDER_IDS, DEFAULT_DECISIONS_HOSTED_ORDER } from '../shared/types/decisions';

/**
 * What a provider can take in one `decide` call (§5): a request over any of these is skipped by the ladder ('over its limits') or, pinned,
 * is `unsupported`. A provider that splits big requests itself (System One packing, §9) reports the post-split ceiling in `maxQuestions`.
 */
export interface DecisionLimits {
  /** Most options in one `choice` question (0 = no `choice`). */
  maxOptions: number;
  /** Most levels in one `score` question (0 = no `score`). */
  maxLevels: number;
  /** Most state tokens (estimated — `estimateTokens` in validate.ts). */
  maxStateTokens: number;
  /** Most questions in one `decide` call. */
  maxQuestions: number;
}

/** Can a provider answer right now? `reason` is a plain sentence (the ladder's `why`). */
export type DecisionProviderReadiness = { ready: true } | { ready: false; reason: string };

/** One provider HTTP call (§9: one usage row each — a split request makes several). */
export interface DecisionCallUsage {
  /** As served. */
  model: string;
  inputTokens: number;
  costUsd: number;
  durationMs: number;
}

/** What a provider returns; the engine adds provider, calibrated, latency, cached and skipped. */
export interface DecisionProviderOutput {
  answers: Record<string, DecisionAnswer>;
  /** As served. */
  model: string;
  /** The sum over `calls`. */
  usage: { inputTokens: number; costUsd: number };
  /** Per HTTP call, when the provider made several or measured them (absent = one call, `usage`). */
  calls?: DecisionCallUsage[];
}

/** The interface every decision provider implements (§4). */
export interface DecisionProvider {
  readonly id: DecisionProviderId;
  /** The model it requests (the served id comes back in `DecisionProviderOutput.model`). */
  readonly model: string;
  limits(): DecisionLimits;
  checkReady(): Promise<DecisionProviderReadiness>;
  decide(request: DecisionRequest, signal: AbortSignal): Promise<DecisionProviderOutput>;
}

/** The BYOK credentials that unlock a decision preset (§8: a new `typesafe` registry entry; the existing `openrouter` one). */
export type DecisionCredentialId = 'typesafe' | 'openrouter';

/** Provider configuration (§4). */
export interface DecisionProviderConfig {
  id: DecisionProviderId;
  name: string;
  type: 'system-one' | 'local-decider' | 'llm-fallback';
  baseURL: string;
  model: string;
  apiKey?: string;
  credentialId?: DecisionCredentialId;
  /** List price for input (§9: the cost when the provider reports none; output is free on System One). */
  usdPerMInputTokens?: number;
}

/** A built-in hosted provider: the shared credential that unlocks it (the `ImageProviderPreset` shape). */
export interface DecisionProviderPreset extends DecisionProviderConfig {
  credentialId: DecisionCredentialId;
}

/** Typed error (§3 `DecisionError.code`). Messages never carry a key or the state text. */
export class DecisionError extends Error {
  readonly code: DecisionErrorCode;
  readonly provider?: DecisionProviderId;

  constructor(code: DecisionErrorCode, message: string, provider?: DecisionProviderId) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
    this.provider = provider;
  }
}
