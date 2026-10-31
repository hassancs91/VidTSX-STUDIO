// A DRY RUN of the gated live test's code path (DECISION_MODELS_DESIGN.md §15.1; ruling D-r16 (c)): the same `runLiveBenchmark` the live
// test calls — D1's T2 / T3 sets framed by the built-ins (`route_request` / `check_matches_request`), packed one request per task as D1
// packed them, through main's registration + the real engine + the System One adapter — with a STUB fetch that serves D1's RECORDED
// response bodies instead of the network. No key (fakes only), no hosted call. Proves: the bodies equal D1's dry-run bodies; the scoring
// path reproduces the replay; the bar (incl. MSD1's first call excluded); the key refusal; the ≤ 4 request cap; the result JSON carries
// numbers only.

import { describe, expect, it } from 'vitest';
import { DECISION_PROVIDER_PRESETS, type SystemOneFetch } from '../../../../decision-engine';
import type { HostedDecisionProviderId } from '../../../../shared/types/decisions';
import recorded from '../../../../decision-engine/providers/fixtures/system-one-recorded-bodies.json';
import dry from './fixtures/d1-dry-run-t2-t3.json';
import t2 from './fixtures/t2-routing.json';
import t3 from './fixtures/t3-verify.json';
import { buildLiveBenchmarkRequests } from './live-requests';
import { createRequestCap, isLiveBenchmarkEnabled, runLiveBenchmark, type LiveProviderResult } from './live-run';
import { liveBarViolations, liveResultJson } from './live-bar';

const KEYS: Record<HostedDecisionProviderId, string> = { jev: 'sk-test-FAKE-live-0051', 'openrouter-decisions': 'sk-or-v1-FAKE-live-0052' };
const presetOf = (id: HostedDecisionProviderId) => DECISION_PROVIDER_PRESETS.find((p) => p.id === id);

interface Sent { url: string; auth: string; body: { model: string; state: unknown; questions: Record<string, { type: string }> } }

/** Serves D1's recorded body for (provider, task): the model picks the provider, the question type the task. */
function recordedFetch(options: { clock?: { t: number }; ms?: (s: Sent) => number; status?: number } = {}) {
  const sent: Sent[] = [];
  const fetch: SystemOneFetch = async (url, init) => {
    const s: Sent = { url, auth: init.headers.Authorization ?? '', body: JSON.parse(init.body) as Sent['body'] };
    sent.push(s);
    if (options.clock) options.clock.t += options.ms?.(s) ?? 100;
    if (options.status) return { ok: false, status: options.status, text: async () => `{"error":"bad key ${s.auth} for ${String(s.body.state)}"}` };
    const who = s.body.model.startsWith('microsoft/') ? 'msd1' : 'jev';
    const task = Object.values(s.body.questions)[0]?.type === 'choice' ? 't2' : 't3';
    return { ok: true, status: 200, text: async () => JSON.stringify(recorded[`${who}-${task}`]) };
  };
  return { fetch, sent };
}

const taskOf = (r: LiveProviderResult, task: 't2' | 't3') => {
  const found = r.tasks.find((t) => t.task === task);
  if (!found) throw new Error(`no ${task}`);
  return found;
};

describe('the live gate', () => {
  it('runs only when VIDTSX_DECISIONS_LIVE is exactly "1"', () => {
    expect(isLiveBenchmarkEnabled({ VIDTSX_DECISIONS_LIVE: '1' })).toBe(true);
    for (const v of [undefined, '', '0', 'true', 'yes']) expect(isLiveBenchmarkEnabled({ VIDTSX_DECISIONS_LIVE: v })).toBe(false);
  });
});

describe('the live requests = D1’s packed bodies, framed by the built-ins (D-r16 (b), (c))', () => {
  it('one T2 request (D1’s rule, 40 choice questions) and one T3 request (D1’s rule, 40 noul questions) equal D1’s dry-run bodies', () => {
    const live = buildLiveBenchmarkRequests(t2, t3);
    expect({ state: live.t2.state, questions: live.t2.questions }).toEqual(dry.t2);
    expect({ state: live.t3.state, questions: live.t3.questions }).toEqual(dry.t3);
    expect([live.t2.family, live.t3.family]).toEqual(['routing', 'verify']);
    expect([live.t2.rows.length, live.t3.rows.length]).toEqual([40, 40]);
  });
});

describe('the live code path on D1’s recorded bodies (stub fetch)', () => {
  const expected: Record<HostedDecisionProviderId, [string, string]> = { jev: ['0.021', '0.003'], 'openrouter-decisions': ['0.014', '0.002'] };

  it.each(['jev', 'openrouter-decisions'] as const)('%s: 40 / 40 on T2 and T3, the replay’s Brier, 0 off-list, 0 errors, one HTTP call per task, the bar holds', async (provider) => {
    const { fetch, sent } = recordedFetch();
    const result = await runLiveBenchmark({ provider, apiKey: KEYS[provider], fetch });
    expect(sent).toHaveLength(2);
    for (const s of sent) {
      expect(s.url).toBe(presetOf(provider)?.baseURL);
      expect(s.auth).toBe(`Bearer ${KEYS[provider]}`);
      expect(s.body.model).toBe(presetOf(provider)?.model);
    }
    expect({ state: sent[0].body.state, questions: sent[0].body.questions }).toEqual(dry.t2);
    expect({ state: sent[1].body.state, questions: sent[1].body.questions }).toEqual(dry.t3);
    const [b2, b3] = expected[provider];
    expect(taskOf(result, 't2')).toMatchObject({ right: 40, n: 40, offList: 0, errors: 0, http: 1, calibrated: true, firstCall: true });
    expect(taskOf(result, 't3')).toMatchObject({ right: 40, n: 40, offList: 0, errors: 0, http: 1, calibrated: true, firstCall: false });
    expect([taskOf(result, 't2').brier?.toFixed(3), taskOf(result, 't3').brier?.toFixed(3)]).toEqual([b2, b3]);
    expect(liveBarViolations([result])).toEqual([]);
  });

  it('latency: Jev ≤ 2,000 ms on every request; MSD1 ≤ 4,000 ms with its FIRST call (T2, sent first) excluded', async () => {
    const run = async (provider: HostedDecisionProviderId, t2Ms: number, t3Ms: number) => {
      const clock = { t: 0 };
      const { fetch } = recordedFetch({ clock, ms: (s) => (Object.values(s.body.questions)[0]?.type === 'choice' ? t2Ms : t3Ms) });
      return runLiveBenchmark({ provider, apiKey: KEYS[provider], fetch, now: () => clock.t });
    };
    const msd1Cold = await run('openrouter-decisions', 9_000, 3_900);
    expect(taskOf(msd1Cold, 't2').latencyMs).toBe(9_000);
    expect(liveBarViolations([msd1Cold])).toEqual([]);
    expect(liveBarViolations([await run('openrouter-decisions', 900, 4_100)])).toEqual(['openrouter-decisions t3: latency 4100 ms > 4000 ms']);
    expect(liveBarViolations([await run('jev', 2_100, 300)])).toEqual(['jev t2: latency 2100 ms > 2000 ms']);
  });

  it('refuses a provider whose key is unset — before any request', async () => {
    const { fetch, sent } = recordedFetch();
    await expect(runLiveBenchmark({ provider: 'jev', apiKey: undefined, fetch })).rejects.toThrow(/JEV_API_KEY is not set/);
    await expect(runLiveBenchmark({ provider: 'openrouter-decisions', apiKey: '  ', fetch })).rejects.toThrow(/OPENROUTER_API_KEY is not set/);
    expect(sent).toHaveLength(0);
  });

  it('the request cap: no more than the cap ever reaches the network; a capped request is an error and fails the bar', async () => {
    const { fetch, sent } = recordedFetch();
    const cap = createRequestCap(fetch, 1);
    const result = await runLiveBenchmark({ provider: 'jev', apiKey: KEYS.jev, fetch: cap.fetch });
    expect(sent).toHaveLength(1);
    expect(cap.count()).toBe(1);
    expect(taskOf(result, 't3')).toMatchObject({ errors: 1, right: 0, errorCode: 'provider-error' });
    expect(liveBarViolations([result])).toEqual(expect.arrayContaining(['jev t3: 1 error(s)', 'jev t3: accuracy 0 / 40 < 38 / 40']));
  });

  it('a provider error (401) is counted, scored as missing, and neither the key nor the state reaches the result JSON', async () => {
    const { fetch } = recordedFetch({ status: 401 });
    const result = await runLiveBenchmark({ provider: 'openrouter-decisions', apiKey: KEYS['openrouter-decisions'], fetch });
    expect(result.tasks.map((t) => [t.task, t.errors, t.errorCode, t.right])).toEqual([['t2', 1, 'provider-error', 0], ['t3', 1, 'provider-error', 0]]);
    const json = liveResultJson([result]);
    for (const secret of [KEYS['openrouter-decisions'], 'Bearer', t2.instruction.slice(0, 40), t3.instruction.slice(0, 40), t2.rows[0].request]) {
      expect(json).not.toContain(secret);
    }
  });

  it('the result JSON holds numbers, the served model and codes only — never a key or the state', async () => {
    const results = await Promise.all((['jev', 'openrouter-decisions'] as const).map((provider) => runLiveBenchmark({ provider, apiKey: KEYS[provider], fetch: recordedFetch().fetch })));
    const json = liveResultJson(results);
    const parsed = JSON.parse(json) as { format: string; providers: Array<{ provider: string; tasks: Array<Record<string, unknown>> }> };
    expect(parsed.format).toBe('vidtsx-decisions-live/1');
    expect(parsed.providers.map((p) => p.provider)).toEqual(['jev', 'openrouter-decisions']);
    for (const task of parsed.providers.flatMap((p) => p.tasks)) {
      for (const [k, v] of Object.entries(task)) {
        expect(['number', 'boolean', 'string'].includes(typeof v) || v === null, k).toBe(true);
        if (typeof v === 'string') expect(['task', 'family', 'model', 'errorCode']).toContain(k);
      }
    }
    for (const secret of [KEYS.jev, KEYS['openrouter-decisions'], t2.instruction.slice(0, 40), t3.instruction.slice(0, 40), t3.rows[0].question.slice(0, 40)]) {
      expect(json).not.toContain(secret);
    }
  });
});
