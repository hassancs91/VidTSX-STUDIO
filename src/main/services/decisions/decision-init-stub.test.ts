// Ruling D-r21 — the dev-only stub hook (DECISION_MODELS_DESIGN.md §15.3 1 / 3 / 4 / 5 need a stub server without a real key):
// VIDTSX_DECISIONS_JEV_URL / VIDTSX_DECISIONS_OPENROUTER_URL replace the matching preset's baseURL ONLY when the app is NOT packaged AND the
// URL is http on 127.0.0.1 / localhost (any port); otherwise ignored with one warning; one log line per rung in use (host:port only).
// The key still comes from the credential store. The OpenRouter rung keeps its OpenRouter shape (noul criteria) on the stub.

import { describe, expect, it, vi } from 'vitest';
import { DECISION_PROVIDER_PRESETS, DecisionEngine, type SystemOneFetch } from '../../../decision-engine';
import { registerDecisionProviders, resolveDecisionStubURLs, type DecisionBaseURLs } from './decision-init';
import type { DecisionSettings } from './decision-settings';

vi.mock('../settings-db', () => ({ getValue: () => undefined, setValue: () => undefined }));
const { DecisionRuntime } = await import('./decision-runtime');

const FAKE_TYPESAFE = 'sk-test-FAKE-stub-0061';
const FAKE_OPENROUTER = 'sk-or-v1-FAKE-stub-0062';
const JEV_URL = DECISION_PROVIDER_PRESETS[0].baseURL;
const OPENROUTER_URL = DECISION_PROVIDER_PRESETS[1].baseURL;

function lines() {
  const log: string[] = [];
  const warn: string[] = [];
  return { log, warn, sinks: { log: (l: string) => log.push(l), warn: (l: string) => warn.push(l) } };
}

function stubFetch() {
  const sent: Array<{ url: string; body: { questions: Record<string, { criteria?: unknown }> } }> = [];
  const fetch: SystemOneFetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) as (typeof sent)[number]['body'] });
    return { ok: true, status: 200, text: async () => JSON.stringify({ model: 'stub-model', answers: { q: { noul: 0.9 } }, usage: { input_tokens: 9 } }) };
  };
  return { fetch, sent };
}

const llm = { generate: async () => ({ text: '{"q": true}', model: 'text-model' }), isReady: async () => false };
const request = (provider: 'jev' | 'openrouter-decisions') => ({
  state: 'A red ball.',
  questions: { q: { type: 'noul' as const, instructions: 'Is the ball red?' } },
  provider,
  featureSource: 'decision-test' as const,
});

describe('resolveDecisionStubURLs (D-r21)', () => {
  const env = { VIDTSX_DECISIONS_JEV_URL: 'http://127.0.0.1:8787/v1/systemone', VIDTSX_DECISIONS_OPENROUTER_URL: 'http://localhost:8788/decisions' };

  it('unpackaged + loopback http → used, one log line per rung naming host:port only', () => {
    const { log, warn, sinks } = lines();
    expect(resolveDecisionStubURLs({ isPackaged: false, env, ...sinks })).toEqual({
      jev: 'http://127.0.0.1:8787/v1/systemone',
      'openrouter-decisions': 'http://localhost:8788/decisions',
    });
    expect(log).toEqual(['decisions: dev stub URL in use for jev (127.0.0.1:8787)', 'decisions: dev stub URL in use for openrouter-decisions (localhost:8788)']);
    expect(warn).toEqual([]);
  });

  it('packaged → ignored, one warning per variable, no log, never the URL', () => {
    const { log, warn, sinks } = lines();
    expect(resolveDecisionStubURLs({ isPackaged: true, env, ...sinks })).toEqual({});
    expect(log).toEqual([]);
    expect(warn).toHaveLength(2);
    expect(warn[0]).toMatch(/^decisions: VIDTSX_DECISIONS_JEV_URL ignored/);
    expect(warn[1]).toMatch(/^decisions: VIDTSX_DECISIONS_OPENROUTER_URL ignored/);
    expect(warn.join(' ')).not.toMatch(/8787|8788|systemone/);
  });

  it.each([
    'https://127.0.0.1:8787/x', // not http
    'http://api.typesafe.ai/v1/systemone', // not loopback
    'http://127.0.0.2:8787/x',
    'http://localhost.evil.example:80/x',
    'http://user:pw@127.0.0.1:8787/x', // credentials in the URL
    'not a url',
  ])('non-loopback / malformed %s → ignored with one warning', (url) => {
    const { log, warn, sinks } = lines();
    expect(resolveDecisionStubURLs({ isPackaged: false, env: { VIDTSX_DECISIONS_JEV_URL: url }, ...sinks })).toEqual({});
    expect(warn).toHaveLength(1);
    expect(log).toEqual([]);
  });

  it('unset or blank → the preset URLs, silently', () => {
    const { log, warn, sinks } = lines();
    expect(resolveDecisionStubURLs({ isPackaged: false, env: { VIDTSX_DECISIONS_JEV_URL: '  ' }, ...sinks })).toEqual({});
    expect([log, warn]).toEqual([[], []]);
  });
});

describe('registerDecisionProviders with stub URLs', () => {
  const creds = { typesafe: FAKE_TYPESAFE, openrouter: FAKE_OPENROUTER };

  it('unset → each rung calls its preset URL', async () => {
    const { fetch, sent } = stubFetch();
    const engine = new DecisionEngine({ fetch });
    registerDecisionProviders(engine, { credentials: creds, openRouterModel: 'microsoft/microsoft-decision-1', llm });
    await engine.decide(request('jev'));
    await engine.decide(request('openrouter-decisions'));
    expect(sent.map((s) => s.url)).toEqual([JEV_URL, OPENROUTER_URL]);
  });

  it('a stub URL replaces only its rung; the OpenRouter rung keeps its OpenRouter shape (noul criteria) on the stub', async () => {
    const { fetch, sent } = stubFetch();
    const engine = new DecisionEngine({ fetch });
    const baseURLs: DecisionBaseURLs = { 'openrouter-decisions': 'http://127.0.0.1:8788/decisions' };
    registerDecisionProviders(engine, { credentials: creds, openRouterModel: 'microsoft/microsoft-decision-1', llm, baseURLs });
    await engine.decide(request('jev'));
    await engine.decide(request('openrouter-decisions'));
    expect(sent.map((s) => s.url)).toEqual([JEV_URL, 'http://127.0.0.1:8788/decisions']);
    expect(sent[0].body.questions.q.criteria).toBeUndefined();
    expect(sent[1].body.questions.q.criteria).toEqual({ true: 'yes', false: 'no' });
  });
});

describe('the runtime resolves the stub URLs once, at start', () => {
  it('start registers with them; a key change re-registers without resolving (or logging) again', async () => {
    const { fetch, sent } = stubFetch();
    const settings: DecisionSettings = { mode: 'auto', hostedOrder: ['jev', 'openrouter-decisions'], openRouterModel: 'microsoft/microsoft-decision-1' };
    const resolveBaseURLs = vi.fn(async (): Promise<DecisionBaseURLs> => ({ jev: 'http://127.0.0.1:8787/v1/systemone' }));
    const runtime = new DecisionRuntime({
      engine: new DecisionEngine({ fetch }),
      readSettings: () => settings,
      writeSettings: () => settings,
      readCredentials: async () => ({ typesafe: FAKE_TYPESAFE }),
      llm,
      appendUsage: async () => undefined,
      emit: () => undefined,
      resolveBaseURLs,
    });
    await runtime.start();
    await runtime.keysChanged();
    await runtime.decide(request('jev'));
    expect(resolveBaseURLs).toHaveBeenCalledTimes(1);
    expect(sent.map((s) => s.url)).toEqual(['http://127.0.0.1:8787/v1/systemone']);
  });
});
