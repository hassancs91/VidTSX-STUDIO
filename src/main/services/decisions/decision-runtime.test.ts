import { describe, expect, it, vi } from 'vitest';
import type { AiUsageEntry } from '../../../shared/types/ai-usage';
import type { DecisionsEvent, DecisionsSettingsSetRequest } from '../../../shared/ipc/types/decisions';
import { DecisionEngine, type LlmFallbackGenerateRequest, type SystemOneFetch } from '../../../decision-engine';
import type { DecisionSettings } from './decision-settings';

// The singleton half of decision-runtime.ts reads the real KV store; the class under test gets everything injected.
vi.mock('../settings-db', () => ({ getValue: () => undefined, setValue: () => undefined }));
const { DecisionRuntime } = await import('./decision-runtime');

// decision-runtime (DECISION_MODELS_DESIGN.md §4, §8, §12, §15.3 2 / 5): the one entry main callers use — settings + engine + usage. The
// status carries has-key BOOLEANS only; no key and no state text in a status, an event, an error or a usage row.
const FAKE_TYPESAFE = 'sk-test-FAKE-decisions-0001';
const FAKE_OPENROUTER = 'sk-or-v1-FAKE-decisions-0003';
const STATE = 'The private state text: a red ball on a table.';
type Row = Omit<AiUsageEntry, 'id'>;
type Creds = Partial<Record<'typesafe' | 'openrouter', string>>;

function harness(initial: { creds?: Creds; status?: number; textReady?: boolean } = {}) {
  let creds: Creds = initial.creds ?? {};
  let settings: DecisionSettings = { mode: 'auto', hostedOrder: ['jev', 'openrouter-decisions'], openRouterModel: 'microsoft/microsoft-decision-1' };
  const sent: Array<{ url: string; body: { model: string; state: unknown; questions: Record<string, { type: string }> } }> = [];
  const fetch: SystemOneFetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) as (typeof sent)[number]['body'] });
    if (initial.status && initial.status !== 200) {
      // A hostile echo: the key and the request's own state in the error body — both must be scrubbed.
      const echoed = String((JSON.parse(init.body) as { state: unknown }).state);
      return { ok: false, status: initial.status, text: async () => `{"error":"invalid key ${FAKE_TYPESAFE} for ${echoed}"}` };
    }
    const keys = Object.keys((JSON.parse(init.body) as { questions: Record<string, unknown> }).questions);
    const answers = Object.fromEntries(keys.map((k) => [k, { noul: 0.97 }]));
    return { ok: true, status: 200, text: async () => JSON.stringify({ model: url.includes('openrouter') ? 'microsoft/microsoft-decision-1-20261009' : 'jev-1.14.0', answers, usage: { input_tokens: 40 } }) };
  };
  const rows: Row[] = [];
  const events: DecisionsEvent[] = [];
  const llmCalls: LlmFallbackGenerateRequest[] = [];
  const runtime = new DecisionRuntime({
    engine: new DecisionEngine({ fetch }),
    readSettings: () => settings,
    writeSettings: (patch: DecisionsSettingsSetRequest) => {
      settings = { ...settings, ...patch };
      return settings;
    },
    readCredentials: async () => creds,
    llm: {
      generate: async (request) => {
        llmCalls.push(request);
        return { text: '{"q": true}', model: 'text-model', usage: { inputTokens: 50 } };
      },
      isReady: async () => initial.textReady ?? true,
    },
    appendUsage: async (entry) => { rows.push(entry); },
    emit: (event) => events.push(event),
  });
  return { runtime, sent, rows, events, llmCalls, setCreds: (next: Creds) => { creds = next; } };
}

const request = { state: STATE, questions: { q: { type: 'noul' as const, instructions: 'Is the ball red?' } }, featureSource: 'decision-agent' as const };
const noSecret = (value: unknown): void => {
  const text = JSON.stringify(value);
  for (const secret of [FAKE_TYPESAFE, FAKE_OPENROUTER, 'private state text']) expect(text).not.toContain(secret);
};

describe('DecisionRuntime.status', () => {
  it('no keys: every hosted rung unavailable for "no key", the local rung none, the text fallback as the text engine says', async () => {
    const { runtime } = harness({ textReady: false });
    const status = await runtime.status();
    expect(status).toEqual({
      mode: 'auto',
      hostedOrder: ['jev', 'openrouter-decisions'],
      openRouterModel: 'microsoft/microsoft-decision-1',
      jev: { id: 'jev', name: 'Jev (TypeSafe)', model: 'jev-1.14.0', keyProvider: 'typesafe', hasKey: false, enabled: true, available: false, why: 'no key' },
      'openrouter-decisions': {
        id: 'openrouter-decisions', name: 'Microsoft-Decision-1 (OpenRouter)', model: 'microsoft/microsoft-decision-1', keyProvider: 'openrouter',
        hasKey: false, enabled: true, available: false, why: 'no key',
      },
      local: { state: 'none', available: false, why: 'no local model' },
      llm: { available: false, why: 'no text provider' },
    });
  });

  it('a key → hasKey true and available, as a boolean only (no key in the status)', async () => {
    const { runtime } = harness({ creds: { typesafe: FAKE_TYPESAFE, openrouter: FAKE_OPENROUTER } });
    const status = await runtime.status();
    expect(status.jev).toMatchObject({ hasKey: true, available: true });
    expect(status.jev.why).toBeUndefined();
    expect(status['openrouter-decisions']).toMatchObject({ hasKey: true, available: true });
    expect(status.llm).toEqual({ available: true });
    noSecret(status);
  });
});

describe('DecisionRuntime — key changes and settings', () => {
  it('a key added then removed: the rung flips available → unavailable, one status event each, no key in any event', async () => {
    const { runtime, events, setCreds } = harness();
    await runtime.start();
    expect(events).toHaveLength(0);
    setCreds({ typesafe: FAKE_TYPESAFE });
    await runtime.keysChanged();
    await runtime.keysChanged();
    expect(events).toHaveLength(1);
    expect(events[0].status.jev).toMatchObject({ hasKey: true, available: true });
    setCreds({});
    await runtime.keysChanged();
    expect(events).toHaveLength(2);
    expect(events[1].status.jev).toMatchObject({ hasKey: false, available: false, why: 'no key' });
    noSecret(events);
  });

  it('decisionsMode off → no-provider with no network call (§15.3 5); the status says why', async () => {
    const { runtime, sent, events } = harness({ creds: { typesafe: FAKE_TYPESAFE } });
    const status = await runtime.setSettings({ mode: 'off' });
    expect(status.mode).toBe('off');
    expect(status.jev).toMatchObject({ available: false, why: 'Decisions are off in Settings' });
    expect(events.at(-1)?.status.mode).toBe('off');
    await expect(runtime.decide(request)).rejects.toMatchObject({ code: 'no-provider' });
    expect(sent).toHaveLength(0);
  });

  it('jev removed from the order → auto calls the OpenRouter rung (§15.3 5); the configured model is requested', async () => {
    const { runtime, sent } = harness({ creds: { typesafe: FAKE_TYPESAFE, openrouter: FAKE_OPENROUTER } });
    const status = await runtime.setSettings({ hostedOrder: ['openrouter-decisions'], openRouterModel: 'microsoft/microsoft-decision-1-20261009' });
    expect(status.jev).toMatchObject({ hasKey: true, enabled: false, available: false, why: 'switched off in Settings' });
    const result = await runtime.decide(request);
    expect(result.provider).toBe('openrouter-decisions');
    expect(sent.map((s) => [s.url, s.body.model])).toEqual([['https://openrouter.ai/api/alpha/decisions', 'microsoft/microsoft-decision-1-20261009']]);
  });
});

describe('DecisionRuntime.decide — usage rows', () => {
  it('one row per HTTP call with the key id; the cache hit logs nothing', async () => {
    const { runtime, rows } = harness({ creds: { typesafe: FAKE_TYPESAFE } });
    await runtime.decide(request);
    await runtime.decide(request);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'typesafe', model: 'jev-1.14.0', requestType: 'decision', featureSource: 'decision-agent', inputTokens: 40 });
    noSecret(rows);
  });

  it('the llm rung (pinned) answers through the injected text engine and logs exactly one row', async () => {
    const { runtime, rows, llmCalls } = harness();
    const result = await runtime.decide({ ...request, provider: 'llm' });
    expect(result.provider).toBe('llm');
    expect(llmCalls).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provider: 'llm', model: 'text-model', requestType: 'decision' });
  });
});

describe('DecisionRuntime.testKey — the TypeSafe row test (§8)', () => {
  it('one tiny noul pinned to jev, featureSource decision-test; ok', async () => {
    const { runtime, sent, rows } = harness({ creds: { typesafe: FAKE_TYPESAFE, openrouter: FAKE_OPENROUTER } });
    const res = await runtime.testKey();
    expect(res.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(Object.values(sent[0].body.questions).map((q) => q.type)).toEqual(['noul']);
    expect(rows).toEqual([expect.objectContaining({ provider: 'typesafe', featureSource: 'decision-test', requestType: 'decision' })]);
    const again = await runtime.testKey();
    expect(again.ok).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it('no TypeSafe key → no-provider, no call; a refused key → provider-error without the key or the state', async () => {
    const none = harness({ creds: { openrouter: FAKE_OPENROUTER } });
    await expect(none.runtime.testKey()).resolves.toMatchObject({ ok: false, error: { code: 'no-provider' } });
    expect(none.sent).toHaveLength(0);

    const refused = harness({ creds: { typesafe: FAKE_TYPESAFE }, status: 401 });
    const res = await refused.runtime.testKey();
    expect(res).toMatchObject({ ok: false, error: { code: 'provider-error' } });
    noSecret(res);
    const failed = await refused.runtime.decide(request).catch((err: unknown) => err);
    expect(failed).toMatchObject({ code: 'provider-error' });
    noSecret(failed instanceof Error ? failed.message : failed);
  });
});
