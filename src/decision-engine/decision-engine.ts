/**
 * The decision engine (DECISION_MODELS_DESIGN.md §4 `decision-engine.ts`, §6, §9) — the `imageEngine` shape: providers registered from
 * presets (`register`) or as instances (`registerInstance`: the LLM fallback, a future local rung), one shared `decisionEngine`.
 *
 * `decide(request)` = validate → the ladder (§6) → per rung: the cache (§9; identical concurrent requests share one call) → the provider →
 * stamp `calibrated` from the SERVED model + the request's family (calibration-table.ts), `cached`, `latencyMs`, `skipped`. A
 * `provider-error` moves to the next usable rung ONCE; `timeout` (the caller's budget is spent), `invalid-answer`, `unsupported` and
 * `cancelled` never fall back; a refused answer is returned as is. A pin (`decideWith`, or `request.provider`) never falls back. Failures are
 * never cached; no error message carries the state text. Process-neutral: no electron, no Node import.
 */
import { DEFAULT_DECISIONS_HOSTED_ORDER } from '../shared/types/decisions';
import { DecisionCache } from './cache';
import { isDecisionCalibrated } from './calibration-table';
import { planDecisionLadder, WHY_NO_KEY, WHY_NO_LOCAL, WHY_NO_TEXT_PROVIDER, type DecisionLadderSettings, type LadderProviderState, type LadderRung } from './ladder';
import { SystemOneProvider, type SystemOneFetch } from './providers/system-one-provider';
import { decisionSecrets, scrubDecisionText } from './scrub';
import {
  DecisionError,
  type DecisionCallUsage,
  type DecisionProvider,
  type DecisionProviderConfig,
  type DecisionProviderId,
  type DecisionProviderOutput,
  type DecisionProviderReadiness,
  type DecisionRequest,
  type DecisionResult,
} from './types';
import { validateDecisionRequest } from './validate';

/** §9: a flow / agent `decide` budget when the caller sets none. */
export const DEFAULT_DECISION_TIMEOUT_MS = 15_000;
/** The `why` prefix of a rung that failed with a provider-error before the answering one. */
export const WHY_PROVIDER_ERROR = 'provider error';

/** One provider HTTP call, for main's usage log (§9: one row per call; a cache hit logs nothing). */
export interface DecisionUsageEvent extends DecisionCallUsage {
  provider: DecisionProviderId;
  featureSource: DecisionRequest['featureSource'];
}

export interface DecideOptions {
  signal?: AbortSignal;
}

export interface DecisionEngineOptions {
  /** Passed to every System One provider `register` builds (main: the global fetch; tests: a stub). */
  fetch?: SystemOneFetch;
  now?: () => number;
}

type Skipped = { provider: DecisionProviderId; why: string };

/** The caller's signal + the budget's timer as one signal; remembers which fired. */
class Budget {
  private readonly controller = new AbortController();
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly onCallerAbort = (): void => this.controller.abort();
  timedOut = false;

  constructor(
    readonly ms: number,
    private readonly caller?: AbortSignal,
  ) {
    this.timer = setTimeout(() => {
      this.timedOut = true;
      this.controller.abort();
    }, ms);
    caller?.addEventListener('abort', this.onCallerAbort, { once: true });
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.caller?.removeEventListener('abort', this.onCallerAbort);
  }
}

/** `work`, or a rejection the moment `signal` aborts (a provider that ignores its signal cannot hold the call past the budget). */
async function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort = (): void => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new DecisionError('cancelled', 'aborted'));
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function missingWhy(id: DecisionProviderId): string {
  if (id === 'local') return WHY_NO_LOCAL;
  if (id === 'llm') return WHY_NO_TEXT_PROVIDER;
  return WHY_NO_KEY;
}

/** The rungs passed over before `answered`: the ladder's whys plus the one that failed with a provider-error. */
function skippedFor(rungs: readonly LadderRung[], answered: DecisionProviderId, failed: readonly Skipped[]): Skipped[] {
  const out: Skipped[] = [];
  for (const r of rungs) {
    if (r.provider === answered) break;
    if (r.why !== undefined) out.push({ provider: r.provider, why: r.why });
    else out.push(...failed.filter((f) => f.provider === r.provider));
  }
  return out;
}

export class DecisionEngine {
  private readonly providers = new Map<DecisionProviderId, DecisionProvider>();
  private readonly cache = new DecisionCache<DecisionProviderOutput>();
  private settings: () => DecisionLadderSettings = () => ({ mode: 'auto', hostedOrder: DEFAULT_DECISIONS_HOSTED_ORDER });
  private usageListener: ((event: DecisionUsageEvent) => void) | null = null;
  private readonly fetchImpl?: SystemOneFetch;
  private readonly now: () => number;

  constructor(options: DecisionEngineOptions = {}) {
    this.fetchImpl = options.fetch;
    this.now = options.now ?? (() => Date.now());
  }

  /** Main installs the KV settings (§8); default `auto` + the default hosted order. */
  setSettingsResolver(resolver: () => DecisionLadderSettings): void {
    this.settings = resolver;
  }

  /** Main's usage log (§9). A listener that throws never breaks a decision. */
  setUsageListener(listener: ((event: DecisionUsageEvent) => void) | null): void {
    this.usageListener = listener;
  }

  /** A hosted preset with its key. The LLM fallback and a local rung are built by their host → `registerInstance`. */
  register(config: DecisionProviderConfig): void {
    if (config.type !== 'system-one') {
      throw new Error(`Decision provider "${config.id}" (${config.type}) is built by its host — use registerInstance()`);
    }
    if (!config.apiKey) throw new Error(`API key required for decision provider "${config.id}"`);
    this.registerInstance(
      new SystemOneProvider({
        id: config.id,
        baseURL: config.baseURL,
        model: config.model,
        apiKey: config.apiKey,
        fetch: this.fetchImpl,
        usdPerMInputTokens: config.usdPerMInputTokens,
        noulCriteriaRequired: config.noulCriteriaRequired,
      }),
    );
  }

  registerInstance(provider: DecisionProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(id: DecisionProviderId): void {
    this.providers.delete(id);
  }

  getProviders(): DecisionProviderId[] {
    return [...this.providers.keys()];
  }

  async checkReady(id: DecisionProviderId): Promise<DecisionProviderReadiness> {
    const provider = this.providers.get(id);
    if (!provider) return { ready: false, reason: missingWhy(id) };
    try {
      return await provider.checkReady();
    } catch {
      return { ready: false, reason: 'not ready' };
    }
  }

  /** The ladder (`request.provider` absent / `auto`) or the rung the request pins. */
  decide(request: DecisionRequest, options: DecideOptions = {}): Promise<DecisionResult> {
    return this.run(request, options);
  }

  /** One rung, never a fallback. */
  decideWith(providerId: DecisionProviderId, request: DecisionRequest, options: DecideOptions = {}): Promise<DecisionResult> {
    return this.run({ ...request, provider: providerId }, options);
  }

  private async run(input: DecisionRequest, options: DecideOptions): Promise<DecisionResult> {
    const started = this.now();
    if (options.signal?.aborted) throw new DecisionError('cancelled', 'The decision was cancelled.');
    const checked = validateDecisionRequest(input);
    if (!checked.ok) throw new DecisionError(checked.code, checked.reason);
    const request = checked.request;

    const providers = await this.ladderStates();
    const plan = planDecisionLadder({ request, measure: checked.measure, providers, settings: this.settings() });
    if (!plan.ok) throw new DecisionError(plan.code, plan.reason);

    const secrets = decisionSecrets(request);
    const budget = new Budget(request.timeoutMs ?? DEFAULT_DECISION_TIMEOUT_MS, options.signal);
    const failed: Skipped[] = [];
    try {
      for (const [index, id] of plan.usable.entries()) {
        const provider = this.providers.get(id);
        if (!provider) continue;
        try {
          const parts = { provider: id, model: provider.model, state: request.state, questions: request.questions };
          const { value, cached } = await this.cache.run(parts, () => this.call(provider, request, budget.signal));
          const skipped = skippedFor(plan.rungs, id, failed);
          return {
            answers: structuredClone(value.answers),
            provider: id,
            model: value.model,
            calibrated: isDecisionCalibrated(id, value.model, request.family),
            usage: cached ? { inputTokens: 0, costUsd: 0 } : { ...value.usage },
            latencyMs: this.now() - started,
            cached,
            ...(skipped.length > 0 ? { skipped } : {}),
          };
        } catch (err) {
          const typed = this.classify(err, id, budget, options.signal, secrets);
          const hasNext = index < plan.usable.length - 1;
          if (typed.code === 'provider-error' && failed.length === 0 && hasNext) {
            failed.push({ provider: id, why: `${WHY_PROVIDER_ERROR} — ${typed.message}` });
            continue;
          }
          throw typed;
        }
      }
      throw new DecisionError('no-provider', 'No decision provider could answer.');
    } finally {
      budget.dispose();
    }
  }

  private async ladderStates(): Promise<LadderProviderState[]> {
    return Promise.all(
      [...this.providers.values()].map(async (p) => ({ id: p.id, model: p.model, readiness: await this.checkReady(p.id), limits: p.limits() })),
    );
  }

  /** One real provider call (the cache's compute): bounded by the budget, one usage event per HTTP call. */
  private async call(provider: DecisionProvider, request: DecisionRequest, signal: AbortSignal): Promise<DecisionProviderOutput> {
    const t0 = this.now();
    const out = await untilAborted(provider.decide(request, signal), signal);
    const calls = out.calls ?? [{ model: out.model, inputTokens: out.usage.inputTokens, costUsd: out.usage.costUsd, durationMs: this.now() - t0 }];
    for (const call of calls) {
      try {
        this.usageListener?.({ ...call, provider: provider.id, featureSource: request.featureSource });
      } catch {
        // the usage log never breaks a decision
      }
    }
    return out;
  }

  /** The typed error for a failed rung: the caller's cancel and the spent budget win over whatever the provider threw. */
  private classify(err: unknown, id: DecisionProviderId, budget: Budget, caller: AbortSignal | undefined, secrets: readonly string[]): DecisionError {
    if (caller?.aborted) return new DecisionError('cancelled', 'The decision was cancelled.', id);
    if (budget.timedOut) return new DecisionError('timeout', `${id}: no answer within ${budget.ms} ms`, id);
    if (err instanceof DecisionError) return new DecisionError(err.code, scrubDecisionText(err.message, secrets), id);
    const message = err instanceof Error ? err.message : String(err);
    return new DecisionError('provider-error', scrubDecisionText(`${id}: ${message}`, secrets), id);
  }
}

export const decisionEngine = new DecisionEngine();
