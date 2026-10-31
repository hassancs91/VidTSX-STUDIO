import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import type { DecisionRequest, DecisionResult } from '../../shared/types/decisions';
import type { DecisionsDecideRequest, DecisionsDecideResponse, DecisionsStatus } from '../../shared/ipc/types/decisions';
import { DecisionError } from '../../decision-engine';

// The decisions IPC handlers (DECISION_MODELS_DESIGN.md §12): every body in try / catch with a typed error — a throwing runtime never rejects
// the invoke; the key test (`{ test: 'jev' }`, D-r19) ignores every other field; the renderer's free-form decide may log only as the
// developer tester (`decision-test`) or the canvas preview (`decision-flow`); no error carries a key.
const FAKE_KEY = 'sk-test-FAKE-handlers-0011';

const STATUS: DecisionsStatus = {
  mode: 'auto',
  hostedOrder: ['jev', 'openrouter-decisions'],
  openRouterModel: 'microsoft/microsoft-decision-1',
  jev: { id: 'jev', name: 'Jev (TypeSafe)', model: 'jev-1.14.0', keyProvider: 'typesafe', hasKey: true, enabled: true, available: true },
  'openrouter-decisions': {
    id: 'openrouter-decisions', name: 'Microsoft-Decision-1 (OpenRouter)', model: 'microsoft/microsoft-decision-1', keyProvider: 'openrouter',
    hasKey: false, enabled: true, available: false, why: 'no key',
  },
  local: { state: 'none', available: false, why: 'no local model' },
  llm: { available: true },
};
const RESULT = { answers: { q: { type: 'noul', p: 0.97 } }, provider: 'jev', model: 'jev-1.14.0' } as unknown as DecisionResult;
const REQUEST: DecisionRequest = {
  state: 'private state text',
  questions: { q: { type: 'noul', instructions: 'Is it?' } },
  featureSource: 'decision-test',
};

const runtime = {
  decide: vi.fn(async (_req: DecisionRequest) => RESULT),
  status: vi.fn(async () => STATUS),
  setSettings: vi.fn(async (_patch: unknown) => STATUS),
  testKey: vi.fn(async (..._args: unknown[]): Promise<DecisionsDecideResponse> => ({ ok: true, result: RESULT })),
};
const factory = vi.hoisted(() => ({ throws: false }));
vi.mock('../services/settings-db', () => ({ getValue: () => undefined, setValue: () => undefined }));
vi.mock('../services/decisions/decision-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/decisions/decision-runtime')>()),
  getDecisionRuntime: () => {
    if (factory.throws) throw new Error(`runtime unavailable ${FAKE_KEY}`);
    return runtime;
  },
}));

const { handleDecisionsDecide, handleDecisionsStatus, handleDecisionsSettingsSet } = await import('./decisions-handlers');
const EVENT = {} as IpcMainInvokeEvent;
const decide = (req: unknown) => handleDecisionsDecide(EVENT, req as DecisionsDecideRequest);
const noKey = (value: unknown) => expect(JSON.stringify(value)).not.toContain(FAKE_KEY);

beforeEach(() => {
  factory.throws = false;
  runtime.decide.mockReset().mockImplementation(async () => RESULT);
  runtime.status.mockReset().mockImplementation(async () => STATUS);
  runtime.setSettings.mockReset().mockImplementation(async () => STATUS);
  runtime.testKey.mockReset().mockImplementation(async () => ({ ok: true, result: RESULT }));
});

describe('decisions:decide — the key test (D-r19)', () => {
  it('{ test: "jev" } runs the runtime key test with no argument', async () => {
    await expect(decide({ test: 'jev' })).resolves.toEqual({ ok: true, result: RESULT });
    expect(runtime.testKey).toHaveBeenCalledTimes(1);
    expect(runtime.testKey.mock.calls[0]).toEqual([]);
    expect(runtime.decide).not.toHaveBeenCalled();
  });

  it('ignores every other field the renderer sends (a request, a key)', async () => {
    await decide({ test: 'jev', request: { ...REQUEST, provider: 'llm' }, apiKey: FAKE_KEY });
    expect(runtime.testKey.mock.calls).toEqual([[]]);
    expect(runtime.decide).not.toHaveBeenCalled();
  });

  it('another rung id → invalid-request, no call', async () => {
    const res = await decide({ test: 'openrouter-decisions' });
    expect(res).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(runtime.testKey).not.toHaveBeenCalled();
  });

  it('a rejecting key test → a typed error, the key masked', async () => {
    runtime.testKey.mockImplementation(async () => { throw new Error(`invalid key ${FAKE_KEY}`); });
    const res = await decide({ test: 'jev' });
    expect(res).toMatchObject({ ok: false, error: { code: 'provider-error' } });
    noKey(res);
  });
});

describe('decisions:decide — the free-form path', () => {
  it.each(['decision-test', 'decision-flow'] as const)('featureSource %s → the runtime decides', async (featureSource) => {
    const request = { ...REQUEST, featureSource };
    await expect(decide({ request })).resolves.toEqual({ ok: true, result: RESULT });
    expect(runtime.decide).toHaveBeenCalledWith(request);
  });

  it.each([['decision-agent'], ['decision-routing'], ['auto-cut'], [undefined]])('featureSource %s → invalid-request, no call', async (featureSource) => {
    const res = await decide({ request: { ...REQUEST, featureSource } });
    expect(res).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(runtime.decide).not.toHaveBeenCalled();
  });

  it.each([[null], [undefined], [{}], [{ request: 5 }], ['decide']])('a malformed envelope %j → invalid-request', async (req) => {
    await expect(decide(req)).resolves.toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(runtime.decide).not.toHaveBeenCalled();
  });

  it('a DecisionError keeps its code', async () => {
    runtime.decide.mockImplementation(async () => { throw new DecisionError('timeout', 'Jev did not answer within 15000 ms', 'jev'); });
    await expect(decide({ request: REQUEST })).resolves.toEqual({
      ok: false,
      error: { code: 'timeout', message: 'Jev did not answer within 15000 ms' },
    });
  });

  it('a plain throw → provider-error, never a rejected invoke, the key masked', async () => {
    runtime.decide.mockImplementation(async () => { throw new Error(`upstream said Bearer ${FAKE_KEY} is bad`); });
    const res = await decide({ request: REQUEST });
    expect(res).toMatchObject({ ok: false, error: { code: 'provider-error' } });
    noKey(res);
  });

  it('a runtime that cannot be built → a typed error', async () => {
    factory.throws = true;
    const res = await decide({ request: REQUEST });
    expect(res).toMatchObject({ ok: false, error: { code: 'provider-error' } });
    noKey(res);
  });
});

describe('decisions:status', () => {
  it('answers the runtime status', async () => {
    await expect(handleDecisionsStatus()).resolves.toEqual(STATUS);
  });

  it('a failure → every rung unavailable, the error carried, no key', async () => {
    runtime.status.mockImplementation(async () => { throw new Error(`settings db closed ${FAKE_KEY}`); });
    const res = await handleDecisionsStatus();
    expect(res.error).toMatch(/settings db closed/);
    expect([res.jev.available, res['openrouter-decisions'].available, res.local.available, res.llm.available]).toEqual([false, false, false, false]);
    expect([res.jev.hasKey, res['openrouter-decisions'].hasKey]).toEqual([false, false]);
    expect(res).toMatchObject({ mode: 'auto', hostedOrder: ['jev', 'openrouter-decisions'], local: { state: 'none' } });
    noKey(res);
  });
});

describe('decisions:settings:set', () => {
  it('passes the patch and answers the new status', async () => {
    await expect(handleDecisionsSettingsSet(EVENT, { mode: 'off' })).resolves.toEqual(STATUS);
    expect(runtime.setSettings).toHaveBeenCalledWith({ mode: 'off' });
  });

  it('a refused patch → the unchanged status carrying the error', async () => {
    runtime.setSettings.mockImplementation(async () => { throw new Error('Unknown hosted rung: openai'); });
    await expect(handleDecisionsSettingsSet(EVENT, { hostedOrder: ['openai' as 'jev'] })).resolves.toEqual({ ...STATUS, error: 'Unknown hosted rung: openai' });
  });

  it('a refused patch while the status fails too → every rung unavailable + the error', async () => {
    runtime.setSettings.mockImplementation(async () => { throw new Error('write failed'); });
    runtime.status.mockImplementation(async () => { throw new Error('read failed'); });
    const res = await handleDecisionsSettingsSet(EVENT, { mode: 'auto' });
    expect(res).toMatchObject({ error: 'write failed', jev: { available: false }, 'openrouter-decisions': { available: false } });
  });

  it('a missing patch is an empty patch', async () => {
    await handleDecisionsSettingsSet(EVENT, undefined as unknown as { mode?: 'auto' });
    expect(runtime.setSettings).toHaveBeenCalledWith({});
  });
});
