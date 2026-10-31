import { describe, expect, it, vi } from 'vitest';
import type { DecisionsDecideResponse } from '../../../shared/ipc/types/decisions';
import { PROVIDER_REGISTRY } from '../../../shared/providers/registry';
import {
  decisionKeyTestGate,
  decisionSectionRows,
  decisionTestResult,
  isDecisionOnlyProvider,
  runDecisionKeyTest,
} from './decision-providers';

describe('decisionSectionRows — the AI → Providers "Decisions" section (D2 §8, §15.3 2)', () => {
  it('gives TypeSafe its key row there and lists OpenRouter under it too', () => {
    const { keyRows, listedRows } = decisionSectionRows(PROVIDER_REGISTRY);
    expect(keyRows.map((r) => r.id)).toEqual(['typesafe']);
    expect(listedRows.map((r) => r.id)).toEqual(['openrouter']);
  });

  it('only decision-only providers leave the API keys table', () => {
    expect(PROVIDER_REGISTRY.filter(isDecisionOnlyProvider).map((r) => r.id)).toEqual(['typesafe']);
  });
});

describe('decisionKeyTestGate — D-r19 (3) / D-r20: disabled until a TypeSafe key is SAVED, and the tooltip says so', () => {
  it('is disabled with no saved key', () => {
    const gate = decisionKeyTestGate({ saved: false, draft: '', clearing: false });
    expect(gate.disabled).toBe(true);
    expect(gate.title).toMatch(/save/i);
  });

  it('is disabled while a typed key is unsaved — a typed key is never sent', () => {
    for (const saved of [false, true]) {
      const gate = decisionKeyTestGate({ saved, draft: 'sk-test-FAKE-ui-0071', clearing: false });
      expect(gate.disabled).toBe(true);
      expect(gate.title).toMatch(/save/i);
      expect(gate.title).not.toContain('sk-test-FAKE-ui-0071');
    }
  });

  it('is disabled while the key is marked for removal', () => {
    expect(decisionKeyTestGate({ saved: true, draft: '', clearing: true }).disabled).toBe(true);
  });

  it('is enabled with a saved key and no draft', () => {
    const gate = decisionKeyTestGate({ saved: true, draft: '  ', clearing: false });
    expect(gate.disabled).toBe(false);
    expect(gate.title).toMatch(/saved/i);
  });
});

describe('decisionTestResult — shown as the other rows’ results are (plain words, no probability)', () => {
  it('a success reads as connected with the latency', () => {
    const state = decisionTestResult({
      ok: true,
      result: {
        answers: { test: { type: 'noul', p: 0.97 } },
        provider: 'jev',
        model: 'jev-1.14.0',
        calibrated: false,
        usage: { inputTokens: 40, costUsd: 0.000002 },
        latencyMs: 318.6,
        cached: false,
      },
    });
    expect(state).toEqual({ testing: false, success: true, durationMs: 319 });
    expect(JSON.stringify(state)).not.toContain('0.97');
  });

  it('a failure reads as plain words with the scrubbed message', () => {
    const state = decisionTestResult({ ok: false, error: { code: 'provider-error', message: 'TypeSafe answered 401 Unauthorized' } });
    expect(state.success).toBe(false);
    expect(state.testing).toBe(false);
    expect(state.error).toMatch(/401 Unauthorized/);
  });

  it('no-provider and timeout get their own plain sentence', () => {
    expect(decisionTestResult({ ok: false, error: { code: 'no-provider', message: 'x' } }).error).toMatch(/no saved TypeSafe key|off/i);
    expect(decisionTestResult({ ok: false, error: { code: 'timeout', message: 'x' } }).error).toMatch(/in time/);
  });
});

describe('runDecisionKeyTest — the TypeSafe row’s Test button (D-r19: the SAVED key, test mode only)', () => {
  const FAKE_KEY = 'sk-test-FAKE-keytest-0091';

  it('sends exactly { test: "jev" } — no key, no request — and reads the answer as a row result', async () => {
    const decide = vi.fn(async (): Promise<DecisionsDecideResponse> => ({ ok: false, error: { code: 'timeout', message: 'x' } }));
    const out = await runDecisionKeyTest({ decisionsDecide: decide });
    expect(decide).toHaveBeenCalledTimes(1);
    expect(decide.mock.calls[0]).toEqual([{ test: 'jev' }]);
    expect(out).toEqual({ testing: false, success: false, error: 'Jev did not answer in time' });
  });

  it('a rejected invoke reads as a plain failure, never the thrown text', async () => {
    const out = await runDecisionKeyTest({ decisionsDecide: async () => Promise.reject(new Error(`bad ${FAKE_KEY}`)) });
    expect(out).toEqual({ testing: false, success: false, error: 'Test request failed' });
  });
});
