/**
 * The gated live benchmark's run (DECISION_MODELS_DESIGN.md §15.1) — the code path the live test drives with the real `fetch` and the
 * dry-run test drives with a stub serving D1's recorded bodies. One provider per call: main's registration (`registerDecisionProviders`)
 * on a fresh engine with that provider's key, then D1's T2 and T3 sets — framed by the built-ins, ONE packed request per set, T2 first
 * (so MSD1's cold first call is T2, as in D1) — pinned to the provider, family set, through the System One adapter; each answered set is
 * scored by the tree's scorer. The result holds numbers, the served model and error codes only — never a key, a header or the state.
 */
import { DECISION_PROVIDER_PRESETS, DecisionEngine, DecisionError, type SystemOneFetch } from '../../../../decision-engine';
import type { DecisionResult, DecisionTaskFamily, HostedDecisionProviderId } from '../../../../shared/types/decisions';
import { registerDecisionProviders, type DecisionLlmDeps } from '../decision-init';
import t2Fixture from './fixtures/t2-routing.json';
import t3Fixture from './fixtures/t3-verify.json';
import { buildLiveBenchmarkRequests, type LiveTaskRequest } from './live-requests';
import { scoreChoiceAnswers, scoreNoulAnswers } from './score';
import type { BenchmarkRequestRecord, GroupMeasures } from './types';

/** Where the live test reads each provider's key (exported by the kit launcher). */
export const LIVE_KEY_ENV: Record<HostedDecisionProviderId, 'JEV_API_KEY' | 'OPENROUTER_API_KEY'> = {
  jev: 'JEV_API_KEY',
  'openrouter-decisions': 'OPENROUTER_API_KEY',
};

/** §15.1: ≤ 4 requests in all (one per set per provider). */
export const LIVE_MAX_REQUESTS = 4;
/** §9's flow / agent budget per request. */
const LIVE_TIMEOUT_MS = 15_000;

export function isLiveBenchmarkEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.VIDTSX_DECISIONS_LIVE === '1';
}

/** A hard cap over every request a run makes: past `max`, a call throws without reaching the network. */
export function createRequestCap(fetch: SystemOneFetch, max: number): { fetch: SystemOneFetch; count: () => number } {
  let made = 0;
  return {
    fetch: async (url, init) => {
      if (made >= max) throw new Error(`live request cap reached (${max})`);
      made += 1;
      return fetch(url, init);
    },
    count: () => made,
  };
}

export interface LiveTaskResult {
  task: 't2' | 't3';
  family: DecisionTaskFamily;
  n: number;
  right: number;
  /** rows without an answer (a failed request, a refusal) — counted wrong */
  missing: number;
  accuracy: number | null;
  /** top-label (T2) / binary (T3), over the answered rows */
  brier: number | null;
  ece: number | null;
  offList: number;
  /** failed requests (0 or 1 — one request per set) */
  errors: number;
  errorCode?: string;
  /** wall ms of the product call (engine.decide) */
  latencyMs: number;
  /** the provider's first request of the run (T2) */
  firstCall: boolean;
  /** HTTP calls attempted for this set (a retry counts) */
  http: number;
  model: string | null;
  calibrated: boolean | null;
  inputTokens: number | null;
  costUsd: number | null;
}

export interface LiveProviderResult {
  provider: HostedDecisionProviderId;
  /** the key was not set — nothing was sent */
  refused?: true;
  tasks: LiveTaskResult[];
}

export interface LiveRunOptions {
  provider: HostedDecisionProviderId;
  apiKey: string | undefined;
  fetch: SystemOneFetch;
  now?: () => number;
}

/** The live run never falls back to the text engine (the provider is pinned); this keeps it out. */
const NO_TEXT_ENGINE: DecisionLlmDeps = {
  generate: async () => {
    throw new Error('no text engine in the live benchmark');
  },
  isReady: async () => false,
};

function measureOf(req: LiveTaskRequest, result: DecisionResult | null, record: BenchmarkRequestRecord): GroupMeasures {
  const answerOf = (key: string) => result?.answers[key];
  if (req.task === 't2') {
    const answers = req.rows.flatMap(({ key, id }) => {
      const a = answerOf(key);
      return a?.type === 'choice' ? [{ id, probs: a.probabilities }] : [];
    });
    return scoreChoiceAnswers({ requests: [record], answers }, t2Fixture).groups.ALL;
  }
  const answers = req.rows.flatMap(({ key, id }) => {
    const a = answerOf(key);
    return a?.type === 'noul' ? [{ qid: id, pTrue: a.p }] : [];
  });
  return scoreNoulAnswers({ requests: [record], answers }, t3Fixture).groups.ALL;
}

export async function runLiveBenchmark(options: LiveRunOptions): Promise<LiveProviderResult> {
  const { provider } = options;
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error(`${LIVE_KEY_ENV[provider]} is not set — the live benchmark refuses to call ${provider}`);
  const preset = DECISION_PROVIDER_PRESETS.find((p) => p.id === provider);
  const openRouterModel = DECISION_PROVIDER_PRESETS.find((p) => p.id === 'openrouter-decisions')?.model;
  if (!preset || !openRouterModel) throw new Error(`no decision preset for ${provider}`);
  const now = options.now ?? (() => Date.now());
  let http = 0;
  const counted: SystemOneFetch = async (url, init) => {
    http += 1;
    return options.fetch(url, init);
  };

  const engine = new DecisionEngine({ fetch: counted, now });
  registerDecisionProviders(engine, { credentials: { [preset.credentialId]: apiKey }, openRouterModel, llm: NO_TEXT_ENGINE });

  const sets = buildLiveBenchmarkRequests(t2Fixture, t3Fixture);
  const tasks: LiveTaskResult[] = [];
  for (const [index, req] of [sets.t2, sets.t3].entries()) {
    const httpBefore = http;
    const started = now();
    let result: DecisionResult | null = null;
    let errorCode: string | undefined;
    try {
      result = await engine.decide({
        state: req.state,
        questions: req.questions,
        provider,
        featureSource: 'decision-test',
        family: req.family,
        timeoutMs: LIVE_TIMEOUT_MS,
      });
    } catch (err) {
      errorCode = err instanceof DecisionError ? err.code : 'provider-error';
    }
    const latencyMs = now() - started;
    const firstCall = index === 0;
    const m = measureOf(req, result, { latencyMs, questions: req.rows.length, phase: firstCall ? 'cold' : 'warm' });
    tasks.push({
      task: req.task,
      family: req.family,
      n: m.n,
      right: m.right,
      missing: m.missing,
      accuracy: m.accuracy,
      brier: m.brier,
      ece: m.ece,
      offList: m.offList ?? 0,
      errors: errorCode ? 1 : 0,
      ...(errorCode ? { errorCode } : {}),
      latencyMs,
      firstCall,
      http: http - httpBefore,
      model: result?.model ?? null,
      calibrated: result?.calibrated ?? null,
      inputTokens: result?.usage.inputTokens ?? null,
      costUsd: result?.usage.costUsd ?? null,
    });
  }
  return { provider, tasks };
}
