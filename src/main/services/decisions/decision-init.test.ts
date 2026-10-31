import { describe, expect, it } from 'vitest';
import { DecisionEngine, type LlmFallbackGenerateRequest, type SystemOneFetch } from '../../../decision-engine';
import { registerDecisionProviders } from './decision-init';

// decision-init (DECISION_MODELS_DESIGN.md §4, §8; the image-init.ts:98-117 pattern): every DECISION_PROVIDER_PRESETS entry whose
// `credentials[preset.credentialId]` exists registers; a re-run (a key change) re-registers with the new key and UNREGISTERS a preset whose
// key is gone (so `decisions:status` flips back, §15.3 2). The LLM fallback is registered with the app's text engine injected. No local
// provider — D3 failed (HANDOFF part (g)).
const FAKE_TYPESAFE = 'sk-test-FAKE-decisions-0001';
const FAKE_TYPESAFE_2 = 'sk-test-FAKE-decisions-0002';
const FAKE_OPENROUTER = 'sk-or-v1-FAKE-decisions-0003';
const OPENROUTER_MODEL = 'microsoft/microsoft-decision-1';

interface Sent { url: string; auth: string; body: { model: string } }

function stubFetch(): { fetch: SystemOneFetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetch: SystemOneFetch = async (url, init) => {
    sent.push({ url, auth: init.headers.Authorization ?? '', body: JSON.parse(init.body) as { model: string } });
    return { ok: true, status: 200, text: async () => JSON.stringify({ model: 'served-model', answers: { q: { noul: 0.9 } }, usage: { input_tokens: 10 } }) };
  };
  return { fetch, sent };
}

const llm = (overrides: Partial<{ ready: boolean; calls: LlmFallbackGenerateRequest[] }> = {}) => {
  const calls = overrides.calls ?? [];
  return {
    generate: async (request: LlmFallbackGenerateRequest) => {
      calls.push(request);
      return { text: '{"q": true}', model: 'text-model', usage: { inputTokens: 50 } };
    },
    isReady: async () => overrides.ready ?? true,
  };
};

const request = { state: 'A red ball.', questions: { q: { type: 'noul' as const, instructions: 'Is the ball red?' } }, featureSource: 'decision-agent' as const };

describe('registerDecisionProviders', () => {
  it('no key → no hosted rung; the LLM fallback is always registered; never a local rung', () => {
    const engine = new DecisionEngine({ fetch: stubFetch().fetch });
    expect(registerDecisionProviders(engine, { credentials: {}, openRouterModel: OPENROUTER_MODEL, llm: llm() })).toEqual([]);
    expect(engine.getProviders().sort()).toEqual(['llm']);
  });

  it('a typesafe key registers jev only; an openrouter key registers openrouter-decisions only', () => {
    const a = new DecisionEngine({ fetch: stubFetch().fetch });
    expect(registerDecisionProviders(a, { credentials: { typesafe: FAKE_TYPESAFE }, openRouterModel: OPENROUTER_MODEL, llm: llm() })).toEqual(['jev']);
    expect(a.getProviders().sort()).toEqual(['jev', 'llm']);
    const b = new DecisionEngine({ fetch: stubFetch().fetch });
    expect(registerDecisionProviders(b, { credentials: { openrouter: FAKE_OPENROUTER }, openRouterModel: OPENROUTER_MODEL, llm: llm() })).toEqual(['openrouter-decisions']);
    expect(b.getProviders().sort()).toEqual(['llm', 'openrouter-decisions']);
    expect(b.getProviders()).not.toContain('local');
  });

  it('both keys → both rungs at the preset URLs; OpenRouter requests the configured model', async () => {
    const { fetch, sent } = stubFetch();
    const engine = new DecisionEngine({ fetch });
    registerDecisionProviders(engine, {
      credentials: { typesafe: FAKE_TYPESAFE, openrouter: FAKE_OPENROUTER }, openRouterModel: 'microsoft/microsoft-decision-1-20261009', llm: llm(),
    });
    await engine.decideWith('jev', request);
    await engine.decideWith('openrouter-decisions', request);
    expect(sent.map((s) => [s.url, s.body.model])).toEqual([
      ['https://api.typesafe.ai/v1/systemone', 'jev-1.14.0'],
      ['https://openrouter.ai/api/alpha/decisions', 'microsoft/microsoft-decision-1-20261009'],
    ]);
  });

  it('a key change re-registers with the new key; a removed key unregisters its rung', async () => {
    const { fetch, sent } = stubFetch();
    const engine = new DecisionEngine({ fetch });
    registerDecisionProviders(engine, { credentials: { typesafe: FAKE_TYPESAFE }, openRouterModel: OPENROUTER_MODEL, llm: llm() });
    await engine.decideWith('jev', { ...request, state: 'one' });
    registerDecisionProviders(engine, { credentials: { typesafe: FAKE_TYPESAFE_2 }, openRouterModel: OPENROUTER_MODEL, llm: llm() });
    await engine.decideWith('jev', { ...request, state: 'two' });
    expect(sent.map((s) => s.auth)).toEqual([`Bearer ${FAKE_TYPESAFE}`, `Bearer ${FAKE_TYPESAFE_2}`]);

    expect(registerDecisionProviders(engine, { credentials: {}, openRouterModel: OPENROUTER_MODEL, llm: llm() })).toEqual([]);
    expect(engine.getProviders()).toEqual(['llm']);
    await expect(engine.decideWith('jev', { ...request, state: 'three' })).rejects.toMatchObject({ code: 'no-provider' });
    expect(sent).toHaveLength(2);
  });

  it('the LLM fallback calls the injected text engine; not ready → "no text provider"', async () => {
    const calls: LlmFallbackGenerateRequest[] = [];
    const engine = new DecisionEngine({ fetch: stubFetch().fetch });
    registerDecisionProviders(engine, { credentials: {}, openRouterModel: OPENROUTER_MODEL, llm: llm({ calls }) });
    const result = await engine.decideWith('llm', request);
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ provider: 'llm', model: 'text-model', calibrated: false, answers: { q: { type: 'noul', p: 1 } } });

    const offline = new DecisionEngine({ fetch: stubFetch().fetch });
    registerDecisionProviders(offline, { credentials: {}, openRouterModel: OPENROUTER_MODEL, llm: llm({ ready: false }) });
    await expect(offline.checkReady('llm')).resolves.toEqual({ ready: false, reason: 'no text provider' });
  });
});
