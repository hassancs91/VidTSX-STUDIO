import { describe, expect, it, vi } from 'vitest';
import { DecisionEngine } from './decision-engine';
import type { DecisionLadderSettings } from './ladder';
import {
  DecisionError,
  type DecisionErrorCode,
  type DecisionLimits,
  type DecisionProvider,
  type DecisionProviderId,
  type DecisionProviderOutput,
  type DecisionProviderReadiness,
  type DecisionRequest,
} from './types';

// D4 (b) — RED FIRST (written by D4 builder #1 after part (a), c7ad6da). The engine class (D2 §4 decision-engine.ts, §6, §9) through
// fake providers registered with registerInstance: validate → ladder → cache → stamp calibrated / skipped / cached / latency.
// A provider-error moves to the next rung ONCE; a timeout does not; a refused answer is returned as is; a pin never falls back;
// failures are never cached; no error message carries the state text.

const STATE = 'PRIVATE-STATE the engine must never echo in an error';
const WIDE: DecisionLimits = { maxOptions: 255, maxLevels: 10, maxStateTokens: 64_000, maxQuestions: 100_000 };

interface FakeProvider extends DecisionProvider {
  calls: DecisionRequest[];
  signals: AbortSignal[];
}

function fake(
  id: DecisionProviderId,
  opts: {
    model?: string;
    served?: string;
    readiness?: DecisionProviderReadiness;
    limits?: DecisionLimits;
    answer?: (req: DecisionRequest, signal: AbortSignal) => Promise<DecisionProviderOutput>;
  } = {},
): FakeProvider {
  const model = opts.model ?? `${id}-model`;
  const provider: FakeProvider = {
    id,
    model,
    calls: [],
    signals: [],
    limits: () => opts.limits ?? WIDE,
    checkReady: async () => opts.readiness ?? { ready: true },
    decide: async (req, signal) => {
      provider.calls.push(req);
      provider.signals.push(signal);
      if (opts.answer) return opts.answer(req, signal);
      return { answers: { q: { type: 'noul', p: 0.97 } }, model: opts.served ?? model, usage: { inputTokens: 120, costUsd: 0.00000504 } };
    },
  };
  return provider;
}

function request(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
  return {
    state: STATE,
    questions: { q: { type: 'noul', instructions: 'Does the item do what the request asks?' } },
    featureSource: 'flows',
    family: 'verify',
    ...overrides,
  };
}

function engineWith(providers: DecisionProvider[], settings?: DecisionLadderSettings): DecisionEngine {
  const engine = new DecisionEngine();
  if (settings) engine.setSettingsResolver(() => settings);
  for (const p of providers) engine.registerInstance(p);
  return engine;
}

async function caught(promise: Promise<unknown>): Promise<DecisionError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof DecisionError) return err;
    throw err;
  }
  throw new Error('expected a DecisionError');
}

async function expectCode(promise: Promise<unknown>, code: DecisionErrorCode): Promise<DecisionError> {
  const err = await caught(promise);
  expect(err.code).toBe(code);
  expect(err.message).not.toContain(STATE);
  return err;
}

const providerError = (): Promise<DecisionProviderOutput> => Promise.reject(new DecisionError('provider-error', 'HTTP 503'));

describe('DecisionEngine — registration', () => {
  it('registerInstance / unregister / getProviders', () => {
    const engine = engineWith([fake('jev'), fake('openrouter-decisions')]);
    expect(engine.getProviders().sort()).toEqual(['jev', 'openrouter-decisions']);
    engine.unregister('jev');
    expect(engine.getProviders()).toEqual(['openrouter-decisions']);
  });

  it('register(config): system-one needs a key; local-decider and llm-fallback register as instances only', () => {
    const engine = new DecisionEngine();
    const base = { name: 'Jev', baseURL: 'https://api.typesafe.ai/v1/systemone', model: 'jev-1.14.0', credentialId: 'typesafe' as const };
    expect(() => engine.register({ id: 'jev', type: 'system-one', ...base })).toThrow();
    engine.register({ id: 'jev', type: 'system-one', apiKey: 'sk-test-FAKE-0000', ...base });
    expect(engine.getProviders()).toEqual(['jev']);
    expect(() => engine.register({ id: 'local', type: 'local-decider', ...base })).toThrow(/registerInstance/);
    expect(() => engine.register({ id: 'llm', type: 'llm-fallback', ...base })).toThrow(/registerInstance/);
  });

  it('checkReady reports an unregistered rung and a provider’s own readiness', async () => {
    const engine = engineWith([fake('jev', { readiness: { ready: false, reason: 'offline' } })]);
    expect(await engine.checkReady('jev')).toEqual({ ready: false, reason: 'offline' });
    expect((await engine.checkReady('openrouter-decisions')).ready).toBe(false);
  });
});

describe('DecisionEngine.decide — auto', () => {
  it('answers on the first ready rung and stamps the result', async () => {
    const jev = fake('jev', { model: 'jev-1.14.0', served: 'jev-1.14.0' });
    const msd1 = fake('openrouter-decisions');
    const result = await engineWith([jev, msd1]).decide(request());
    expect(result.provider).toBe('jev');
    expect(result.model).toBe('jev-1.14.0');
    expect(result.answers).toEqual({ q: { type: 'noul', p: 0.97 } });
    expect(result.usage).toEqual({ inputTokens: 120, costUsd: 0.00000504 });
    expect(result.cached).toBe(false);
    expect(result.calibrated).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.skipped).toEqual([{ provider: 'local', why: 'no local model' }]);
    expect(msd1.calls).toHaveLength(0);
  });

  it('stamps calibrated from the SERVED model and the family (§15.1)', async () => {
    const msd1 = fake('openrouter-decisions', { model: 'microsoft/microsoft-decision-1', served: 'microsoft/microsoft-decision-1-20261009' });
    const engine = engineWith([msd1]);
    expect((await engine.decide(request({ family: 'verify' }))).calibrated).toBe(true);
    expect((await engine.decide(request({ family: 'other' }))).calibrated).toBe(false);
    expect((await engine.decide(request({ family: undefined, state: 'another state' }))).calibrated).toBe(false);
    const drifted = fake('openrouter-decisions', { model: 'microsoft/microsoft-decision-1', served: 'microsoft/microsoft-decision-1-20261201' });
    expect((await engineWith([drifted]).decide(request())).calibrated).toBe(false);
  });

  it('rejects an invalid request before any provider call (invalid-request / unsupported)', async () => {
    const jev = fake('jev');
    const engine = engineWith([jev]);
    await expectCode(engine.decide(request({ questions: {} })), 'invalid-request');
    await expectCode(engine.decide(request({ questions: { c: { type: 'choice', instructions: 'pick', criteria: { a: 'A' } } } })), 'invalid-request');
    await expectCode(engine.decide(request({ state: 'a'.repeat(64_000 * 3 + 3) })), 'unsupported');
    expect(jev.calls).toHaveLength(0);
  });

  it('no rung → no-provider whose message explains the rungs but never the state', async () => {
    const err = await expectCode(engineWith([]).decide(request()), 'no-provider');
    expect(err.message).toContain('no key');
  });

  it('a provider-error moves to the next rung ONCE and is reported in skipped', async () => {
    const jev = fake('jev', { answer: providerError });
    const msd1 = fake('openrouter-decisions');
    const result = await engineWith([jev, msd1]).decide(request());
    expect(result.provider).toBe('openrouter-decisions');
    expect(result.skipped?.map((s) => s.provider)).toEqual(['local', 'jev']);
    expect(result.skipped?.[1].why).toMatch(/provider error/i);
  });

  it('two provider-errors in a row → provider-error; the third rung is never tried', async () => {
    const llm = fake('llm');
    const engine = engineWith([fake('jev', { answer: providerError }), fake('openrouter-decisions', { answer: providerError }), llm]);
    await expectCode(engine.decide(request({ allowUncalibrated: true })), 'provider-error');
    expect(llm.calls).toHaveLength(0);
  });

  it('a plain Error from a provider counts as provider-error', async () => {
    const jev = fake('jev', { answer: () => Promise.reject(new Error('socket hang up')) });
    const result = await engineWith([jev, fake('openrouter-decisions')]).decide(request());
    expect(result.provider).toBe('openrouter-decisions');
  });

  it('a timeout does not fall back: the budget is spent, the provider’s signal is aborted', async () => {
    const hang = (_req: DecisionRequest, signal: AbortSignal): Promise<DecisionProviderOutput> =>
      new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    const jev = fake('jev', { answer: hang });
    const msd1 = fake('openrouter-decisions');
    await expectCode(engineWith([jev, msd1]).decide(request({ timeoutMs: 30 })), 'timeout');
    expect(jev.signals[0].aborted).toBe(true);
    expect(msd1.calls).toHaveLength(0);
    const typed = fake('jev', { answer: () => Promise.reject(new DecisionError('timeout', 'slow')) });
    const msd1b = fake('openrouter-decisions');
    await expectCode(engineWith([typed, msd1b]).decide(request()), 'timeout');
    expect(msd1b.calls).toHaveLength(0);
  });

  it('a refused answer is returned as is; an invalid-answer does not fall back', async () => {
    const refusing = fake('jev', {
      answer: async () => ({ answers: { q: { type: 'refused', reason: 'images are not supported' } }, model: 'jev-1.14.0', usage: { inputTokens: 5, costUsd: 0 } }),
    });
    const msd1 = fake('openrouter-decisions');
    const result = await engineWith([refusing, msd1]).decide(request());
    expect(result.answers.q).toEqual({ type: 'refused', reason: 'images are not supported' });
    expect(msd1.calls).toHaveLength(0);
    const garbled = fake('jev', { answer: () => Promise.reject(new DecisionError('invalid-answer', 'off-list option')) });
    const msd1b = fake('openrouter-decisions');
    await expectCode(engineWith([garbled, msd1b]).decide(request()), 'invalid-answer');
    expect(msd1b.calls).toHaveLength(0);
  });

  it('a pre-aborted caller signal → cancelled, no provider call', async () => {
    const jev = fake('jev');
    const controller = new AbortController();
    controller.abort();
    await expectCode(engineWith([jev]).decide(request(), { signal: controller.signal }), 'cancelled');
    expect(jev.calls).toHaveLength(0);
  });

  it('a not-ready provider is skipped with its own reason', async () => {
    const result = await engineWith([fake('jev', { readiness: { ready: false, reason: 'the key was rejected' } }), fake('openrouter-decisions')]).decide(request());
    expect(result.provider).toBe('openrouter-decisions');
    expect(result.skipped).toContainEqual({ provider: 'jev', why: 'the key was rejected' });
  });
});

describe('DecisionEngine — settings (§8) and pins (§6)', () => {
  it('mode off → no-provider without calling anything', async () => {
    const jev = fake('jev');
    await expectCode(engineWith([jev], { mode: 'off', hostedOrder: ['jev', 'openrouter-decisions'] }).decide(request()), 'no-provider');
    expect(jev.calls).toHaveLength(0);
  });

  it('jev removed from decisionsHostedOrder → OpenRouter answers', async () => {
    const jev = fake('jev');
    const result = await engineWith([jev, fake('openrouter-decisions')], { mode: 'auto', hostedOrder: ['openrouter-decisions'] }).decide(request());
    expect(result.provider).toBe('openrouter-decisions');
    expect(jev.calls).toHaveLength(0);
  });

  it('decideWith pins one rung and never falls back', async () => {
    const jev = fake('jev');
    const msd1 = fake('openrouter-decisions', { answer: providerError });
    const engine = engineWith([jev, msd1]);
    await expectCode(engine.decideWith('openrouter-decisions', request()), 'provider-error');
    expect(jev.calls).toHaveLength(0);
    await expectCode(engine.decideWith('local', request()), 'no-provider');
    const pinnedInRequest = await engine.decide(request({ provider: 'jev' }));
    expect(pinnedInRequest.provider).toBe('jev');
    expect(pinnedInRequest.skipped ?? []).toEqual([]);
  });

  it('a pinned rung over its limits → unsupported', async () => {
    const narrow = fake('jev', { limits: { ...WIDE, maxOptions: 2 } });
    const choice = { c: { type: 'choice' as const, instructions: 'pick', criteria: { a: 'A', b: 'B', c: 'C' } } };
    await expectCode(engineWith([narrow]).decideWith('jev', request({ questions: choice })), 'unsupported');
  });
});

describe('DecisionEngine — cache (§9)', () => {
  it('an identical request is answered from the cache (cached: true, no second call)', async () => {
    const jev = fake('jev');
    const engine = engineWith([jev]);
    expect((await engine.decide(request())).cached).toBe(false);
    expect((await engine.decide(request())).cached).toBe(true);
    expect(jev.calls).toHaveLength(1);
  });

  it('identical concurrent requests share one provider call', async () => {
    const jev = fake('jev');
    const engine = engineWith([jev]);
    const results = await Promise.all([engine.decide(request()), engine.decide(request())]);
    expect(jev.calls).toHaveLength(1);
    expect(results.filter((r) => !r.cached)).toHaveLength(1);
  });

  it('a failure is never cached', async () => {
    const answer = vi
      .fn<(req: DecisionRequest, signal: AbortSignal) => Promise<DecisionProviderOutput>>()
      .mockRejectedValueOnce(new DecisionError('provider-error', 'HTTP 500'))
      .mockResolvedValue({ answers: { q: { type: 'noul', p: 0.9 } }, model: 'jev-1.14.0', usage: { inputTokens: 1, costUsd: 0 } });
    const engine = engineWith([fake('jev', { answer })]);
    await expectCode(engine.decideWith('jev', request()), 'provider-error');
    expect((await engine.decideWith('jev', request())).cached).toBe(false);
    expect(answer).toHaveBeenCalledTimes(2);
  });

  it('the cache is per rung: another provider answering the same request is a new call', async () => {
    const jev = fake('jev');
    const msd1 = fake('openrouter-decisions');
    const engine = engineWith([jev, msd1]);
    await engine.decide(request());
    engine.unregister('jev');
    const result = await engine.decide(request());
    expect(result.provider).toBe('openrouter-decisions');
    expect(result.cached).toBe(false);
  });
});
