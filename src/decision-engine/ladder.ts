/**
 * Which provider answers (DECISION_MODELS_DESIGN.md §6, §4 `ladder.ts`). Pure: the registered providers (with their readiness, checked
 * by the engine beforehand) and the user's settings come in as arguments.
 *
 * `auto` walks local (registered AND calibrated for the request's family) → the hosted rungs in `decisionsHostedOrder` → the LLM
 * fallback (only with `allowUncalibrated`); every rung passed over carries a plain `why`. A pinned rung never falls back: unavailable →
 * `no-provider`, over its limits → `unsupported`. Mode `off` → `no-provider`, no rung at all.
 */
import { DEFAULT_DECISIONS_HOSTED_ORDER } from '../shared/types/decisions';
import { isDecisionCalibrated } from './calibration-table';
import type {
  DecisionLimits,
  DecisionProviderId,
  DecisionProviderReadiness,
  DecisionRequest,
  DecisionsMode,
  HostedDecisionProviderId,
} from './types';
import type { DecisionRequestMeasure } from './validate';

/** One registered provider as the engine sees it right now. */
export interface LadderProviderState {
  id: DecisionProviderId;
  model: string;
  readiness: DecisionProviderReadiness;
  limits: DecisionLimits;
}

/** The user's settings (§8). `hostedOrder` is read from storage and may be stale: unknown ids and repeats are ignored. */
export interface DecisionLadderSettings {
  mode: DecisionsMode;
  hostedOrder: readonly string[];
}

export interface LadderInput {
  request: Pick<DecisionRequest, 'provider' | 'allowUncalibrated' | 'family'>;
  measure: DecisionRequestMeasure;
  providers: readonly LadderProviderState[];
  settings: DecisionLadderSettings;
}

/** A rung in walking order; `why` present = passed over. */
export interface LadderRung {
  provider: DecisionProviderId;
  why?: string;
}

export type LadderPlan =
  | { ok: true; rungs: LadderRung[]; usable: DecisionProviderId[] }
  | { ok: false; code: 'no-provider' | 'unsupported'; reason: string; rungs: LadderRung[] };

export const WHY_NO_LOCAL = 'no local model';
export const WHY_NO_KEY = 'no key';
export const WHY_NO_TEXT_PROVIDER = 'no text provider';
export const WHY_OVER_LIMITS = 'over its limits';
export const WHY_SWITCHED_OFF = 'switched off in Settings';
export const WHY_UNCALIBRATED_LLM = 'uncalibrated — allowUncalibrated is off';
export const WHY_UNCALIBRATED_LOCAL = 'uncalibrated for this task family';

const HOSTED: readonly HostedDecisionProviderId[] = DEFAULT_DECISIONS_HOSTED_ORDER;

function isHosted(id: string): id is HostedDecisionProviderId {
  return (HOSTED as readonly string[]).includes(id);
}

function fits(measure: DecisionRequestMeasure, limits: DecisionLimits): boolean {
  return (
    measure.maxOptions <= limits.maxOptions &&
    measure.maxLevels <= limits.maxLevels &&
    measure.stateTokens <= limits.maxStateTokens &&
    measure.questionCount <= limits.maxQuestions
  );
}

function missingWhy(id: DecisionProviderId): string {
  if (id === 'local') return WHY_NO_LOCAL;
  if (id === 'llm') return WHY_NO_TEXT_PROVIDER;
  return WHY_NO_KEY;
}

/** The user's hosted order, de-duplicated, unknown ids dropped. */
function enabledHosted(order: readonly string[]): HostedDecisionProviderId[] {
  const out: HostedDecisionProviderId[] = [];
  for (const id of order) if (isHosted(id) && !out.includes(id)) out.push(id);
  return out;
}

/** Why `id` cannot answer this request (undefined = it can). `pinned` skips the auto-only gates (local calibration, allowUncalibrated). */
function rungWhy(id: DecisionProviderId, input: LadderInput, enabled: readonly HostedDecisionProviderId[], pinned: boolean): string | undefined {
  if (isHosted(id) && !enabled.includes(id)) return WHY_SWITCHED_OFF;
  if (id === 'llm' && !pinned && input.request.allowUncalibrated !== true) return WHY_UNCALIBRATED_LLM;
  const provider = input.providers.find((p) => p.id === id);
  if (!provider) return missingWhy(id);
  if (!provider.readiness.ready) return provider.readiness.reason;
  if (id === 'local' && !pinned && !isDecisionCalibrated(id, provider.model, input.request.family)) return WHY_UNCALIBRATED_LOCAL;
  if (!fits(input.measure, provider.limits)) return WHY_OVER_LIMITS;
  return undefined;
}

function rung(provider: DecisionProviderId, why: string | undefined): LadderRung {
  return why === undefined ? { provider } : { provider, why };
}

/** Plan the rungs for one validated request. */
export function planDecisionLadder(input: LadderInput): LadderPlan {
  const choice = input.request.provider ?? 'auto';
  const enabled = enabledHosted(input.settings.hostedOrder);

  if (input.settings.mode === 'off') {
    return { ok: false, code: 'no-provider', reason: 'Decisions are switched off in Settings.', rungs: [] };
  }

  if (choice !== 'auto') {
    const why = rungWhy(choice, input, enabled, true);
    const rungs = [rung(choice, why)];
    if (why === undefined) return { ok: true, rungs, usable: [choice] };
    const code = why === WHY_OVER_LIMITS ? 'unsupported' : 'no-provider';
    return { ok: false, code, reason: `${choice}: ${why}`, rungs };
  }

  const disabled = HOSTED.filter((id) => !enabled.includes(id));
  const order: DecisionProviderId[] = ['local', ...enabled, ...disabled, 'llm'];
  const rungs = order.map((id) => rung(id, rungWhy(id, input, enabled, false)));
  const usable = rungs.filter((r) => r.why === undefined).map((r) => r.provider);
  if (usable.length > 0) return { ok: true, rungs, usable };

  const overLimits = rungs.some((r) => r.why === WHY_OVER_LIMITS);
  const summary = rungs.map((r) => `${r.provider} — ${r.why ?? ''}`).join('; ');
  return overLimits
    ? { ok: false, code: 'unsupported', reason: `The request is over the limits of every available provider (${summary}).`, rungs }
    : { ok: false, code: 'no-provider', reason: `No decision provider can answer (${summary}).`, rungs };
}

/** The rungs passed over before `provider` (the `skipped` of a result it answered), in walking order. */
export function skippedBefore(rungs: readonly LadderRung[], provider: DecisionProviderId): Array<{ provider: DecisionProviderId; why: string }> {
  const out: Array<{ provider: DecisionProviderId; why: string }> = [];
  for (const r of rungs) {
    if (r.provider === provider) break;
    if (r.why !== undefined) out.push({ provider: r.provider, why: r.why });
  }
  return out;
}
