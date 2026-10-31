/**
 * §15.1's bar for the gated live test (DECISION_MODELS_DESIGN.md): on each of T2 and T3, accuracy ≥ 38 / 40 (two flips allowed for
 * drift), Brier ≤ 0.05, 0 off-list, 0 errors; latency per 40-question request ≤ 2,000 ms for Jev and ≤ 4,000 ms for MSD1 with its first
 * call excluded. One request per set means "p95 per request" is each request itself; MSD1's first call is its T2 request (sent first —
 * D1's cold 2,983 ms call was T2 too), so its bound is read on T3 only and its T2 latency is recorded as a note. Pure.
 */
import type { HostedDecisionProviderId } from '../../../../shared/types/decisions';
import type { LiveProviderResult, LiveTaskResult } from './live-run';

export const LIVE_BAR = {
  minRight: 38,
  maxBrier: 0.05,
  latencyMs: { jev: 2_000, 'openrouter-decisions': 4_000 } as Record<HostedDecisionProviderId, number>,
  firstCallExcluded: { jev: false, 'openrouter-decisions': true } as Record<HostedDecisionProviderId, boolean>,
} as const;

/** Every way the results miss the bar, in plain words (numbers only); empty = PASS. */
export function liveBarViolations(results: readonly LiveProviderResult[]): string[] {
  const out: string[] = results.length ? [] : ['no provider was run'];
  for (const r of results) {
    if (r.refused) {
      out.push(`${r.provider}: refused — its key is not set`);
      continue;
    }
    if (r.tasks.length !== 2) out.push(`${r.provider}: ${r.tasks.length} set(s) run, expected T2 + T3`);
    for (const t of r.tasks) {
      const at = `${r.provider} ${t.task}`;
      if (t.errors) out.push(`${at}: ${t.errors} error(s)`);
      if (t.right < LIVE_BAR.minRight) out.push(`${at}: accuracy ${t.right} / ${t.n} < ${LIVE_BAR.minRight} / 40`);
      if (t.brier === null || t.brier > LIVE_BAR.maxBrier) out.push(`${at}: Brier ${t.brier === null ? 'none' : t.brier.toFixed(3)} > ${LIVE_BAR.maxBrier}`);
      if (t.offList) out.push(`${at}: ${t.offList} off-list`);
      const bound = LIVE_BAR.latencyMs[r.provider];
      const excluded = LIVE_BAR.firstCallExcluded[r.provider] && t.firstCall;
      if (!excluded && t.latencyMs > bound) out.push(`${at}: latency ${t.latencyMs} ms > ${bound} ms`);
    }
  }
  return out;
}

const TASK_FIELDS = [
  'task',
  'family',
  'n',
  'right',
  'missing',
  'accuracy',
  'brier',
  'ece',
  'offList',
  'errors',
  'errorCode',
  'latencyMs',
  'firstCall',
  'http',
  'model',
  'calibrated',
  'inputTokens',
  'costUsd',
] as const satisfies ReadonlyArray<keyof LiveTaskResult>;

/** The live result file: the bar, per provider × set the numbers (+ the served model, error codes), the violations. No key, no state. */
export function liveResultJson(results: readonly LiveProviderResult[], meta: { requests?: number } = {}): string {
  const providers = results.map((r) => ({
    provider: r.provider,
    ...(r.refused ? { refused: true } : {}),
    tasks: r.tasks.map((t) => Object.fromEntries(TASK_FIELDS.filter((k) => t[k] !== undefined).map((k) => [k, t[k]]))),
  }));
  const violations = liveBarViolations(results);
  return `${JSON.stringify(
    {
      format: 'vidtsx-decisions-live/1',
      createdAt: new Date().toISOString(),
      bar: LIVE_BAR,
      requests: meta.requests ?? null,
      providers,
      verdict: violations.length ? 'FAIL' : 'PASS',
      violations,
    },
    null,
    1,
  )}\n`;
}
