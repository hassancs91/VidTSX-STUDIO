import { describe, expect, it, vi } from 'vitest';
import type { DecisionsDecideRequest, DecisionsDecideResponse, DecisionsStatusResponse } from './ipc/types/decisions';
import { applyDecisionsPatch, loadDecisionsStatus, runDecisionsTester, type DecisionsClientApi } from './decisions-client';
import { EMPTY_TESTER_FORM } from './decisions-tester-form';

const FAKE_KEY = 'sk-test-FAKE-client-0081';

const rung = (id: 'jev' | 'openrouter-decisions', hasKey: boolean) => ({
  id,
  name: id,
  model: 'm',
  keyProvider: id === 'jev' ? ('typesafe' as const) : ('openrouter' as const),
  hasKey,
  enabled: true,
  available: hasKey,
  ...(hasKey ? {} : { why: 'no key' }),
});

const STATUS: DecisionsStatusResponse = {
  mode: 'auto',
  hostedOrder: ['jev', 'openrouter-decisions'],
  openRouterModel: 'microsoft/microsoft-decision-1',
  jev: rung('jev', false),
  'openrouter-decisions': rung('openrouter-decisions', false),
  local: { state: 'none', available: false, why: 'no local model' },
  llm: { available: false },
};

function api(overrides: Partial<DecisionsClientApi> = {}): DecisionsClientApi {
  return {
    decisionsStatus: vi.fn(async () => STATUS),
    decisionsSettingsSet: vi.fn(async () => STATUS),
    decisionsDecide: vi.fn(async (): Promise<DecisionsDecideResponse> => ({ ok: false, error: { code: 'no-provider', message: 'x' } })),
    ...overrides,
  };
}

describe('loadDecisionsStatus — the Settings row reads decisions:status only', () => {
  it('returns the status and its error', async () => {
    expect(await loadDecisionsStatus(api())).toEqual({ status: STATUS, error: null });
    const failed = { ...STATUS, error: 'Decisions could not start' };
    expect(await loadDecisionsStatus(api({ decisionsStatus: async () => failed }))).toEqual({
      status: failed,
      error: 'Decisions could not start',
    });
  });

  it('a rejected invoke becomes a plain error, never a throw', async () => {
    const out = await loadDecisionsStatus(api({ decisionsStatus: async () => Promise.reject(new Error('gone')) }));
    expect(out).toEqual({ status: null, error: 'Could not read the Decisions status' });
  });
});

describe('applyDecisionsPatch — decisions:settings:set with exactly the patch', () => {
  it('sends the patch and returns the new status', async () => {
    const a = api();
    const out = await applyDecisionsPatch(a, { hostedOrder: ['openrouter-decisions'] });
    expect(a.decisionsSettingsSet).toHaveBeenCalledWith({ hostedOrder: ['openrouter-decisions'] });
    expect(out).toEqual({ status: STATUS, error: null });
  });

  it('a refused patch keeps the returned (unchanged) status and shows its error; a rejection keeps nothing', async () => {
    const refused = { ...STATUS, error: 'decisionsOpenRouterModel must be a model id' };
    expect(await applyDecisionsPatch(api({ decisionsSettingsSet: async () => refused }), { openRouterModel: 'x y' })).toEqual({
      status: refused,
      error: 'decisionsOpenRouterModel must be a model id',
    });
    expect(await applyDecisionsPatch(api({ decisionsSettingsSet: async () => Promise.reject(new Error('no')) }), { mode: 'off' })).toEqual({
      status: null,
      error: 'Could not save the Decisions setting',
    });
  });
});

describe('runDecisionsTester — the dev-preview tester (D2 §8 / §12, D-r20 (1))', () => {
  const form = { ...EMPTY_TESTER_FORM, type: 'noul' as const, state: 'A refund request.', instructions: 'Is this billing?' };

  it('refuses an incomplete form without a call', async () => {
    const a = api();
    const out = await runDecisionsTester(a, { ...form, state: '' });
    expect(out).toEqual({ kind: 'form', reason: expect.stringMatching(/state/i) });
    expect(a.decisionsDecide).not.toHaveBeenCalled();
  });

  it('sends { request } with featureSource decision-test and the 30 s budget — never a key, never test mode', async () => {
    const a = api();
    await runDecisionsTester(a, form);
    const sent = (a.decisionsDecide as ReturnType<typeof vi.fn>).mock.calls[0][0] as DecisionsDecideRequest;
    expect(Object.keys(sent)).toEqual(['request']);
    if (!('request' in sent)) throw new Error('expected a request envelope');
    expect(sent.request.featureSource).toBe('decision-test');
    expect(sent.request.timeoutMs).toBe(30_000);
    expect(JSON.stringify(sent)).not.toContain(FAKE_KEY);
  });

  it('shows the result view (probabilities as numbers) or the typed error', async () => {
    const ok = api({
      decisionsDecide: async () => ({
        ok: true,
        result: {
          answers: { decision: { type: 'noul', p: 0.96 } },
          provider: 'jev',
          model: 'jev-1.14.0',
          calibrated: false,
          usage: { inputTokens: 30, costUsd: 0 },
          latencyMs: 412,
          cached: false,
        },
      }),
    });
    const out = await runDecisionsTester(ok, form);
    expect(out.kind).toBe('result');
    if (out.kind !== 'result' || !out.view.ok) throw new Error('expected a result');
    expect(out.view.probabilities).toEqual([
      { label: 'yes', value: '0.960' },
      { label: 'no', value: '0.040' },
    ]);
    const failed = await runDecisionsTester(api(), form);
    expect(failed).toEqual({ kind: 'result', view: { ok: false, code: 'no-provider', message: 'x' } });
  });

  it('a rejected invoke is a plain error', async () => {
    const out = await runDecisionsTester(api({ decisionsDecide: async () => Promise.reject(new Error(`boom ${FAKE_KEY}`)) }), form);
    expect(out).toEqual({ kind: 'form', reason: 'The request failed before an answer came back' });
    expect(JSON.stringify(out)).not.toContain(FAKE_KEY);
  });
});
