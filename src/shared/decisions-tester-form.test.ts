import { describe, expect, it } from 'vitest';
import type { DecisionsDecideResponse } from './ipc/types/decisions';
import type { DecisionResult } from './types/decisions';
import {
  DECISIONS_TESTER_THRESHOLD,
  DECISIONS_TESTER_TIMEOUT_MS,
  EMPTY_TESTER_FORM,
  TESTER_QUESTION_KEY,
  buildTesterRequest,
  parseTesterOptions,
  testerResultView,
  type DecisionsTesterForm,
} from './decisions-tester-form';

const form = (over: Partial<DecisionsTesterForm> = {}): DecisionsTesterForm => ({
  ...EMPTY_TESTER_FORM,
  state: 'A user asks for a refund of the March invoice.',
  instructions: 'Which team must act on this request?',
  ...over,
});

const result = (over: Partial<DecisionResult> = {}): DecisionResult => ({
  answers: {},
  provider: 'jev',
  model: 'jev-1.14.0',
  calibrated: true,
  usage: { inputTokens: 120, costUsd: 0.000005 },
  latencyMs: 412,
  cached: false,
  ...over,
});

describe('parseTesterOptions — one `id: description` per line', () => {
  it('reads ids and descriptions, skips blanks, first occurrence wins', () => {
    expect(parseTesterOptions('billing: money questions\n\n  tech : bugs and crashes \nbilling: again\nsales')).toEqual({
      billing: 'money questions',
      tech: 'bugs and crashes',
      sales: 'sales',
    });
  });
});

describe('buildTesterRequest', () => {
  it('builds a noul request with featureSource decision-test and no criteria', () => {
    const built = buildTesterRequest(form({ type: 'noul', provider: 'jev', family: 'verify' }));
    expect(built).toEqual({
      ok: true,
      request: {
        state: 'A user asks for a refund of the March invoice.',
        questions: { [TESTER_QUESTION_KEY]: { type: 'noul', instructions: 'Which team must act on this request?' } },
        provider: 'jev',
        featureSource: 'decision-test',
        family: 'verify',
        timeoutMs: 30_000,
      },
    });
  });

  it('carries the developer tester’s 30 s budget (D2 §9)', () => {
    expect(DECISIONS_TESTER_TIMEOUT_MS).toBe(30_000);
    const built = buildTesterRequest(form({ type: 'noul' }));
    expect(built.ok && built.request.timeoutMs).toBe(30_000);
  });

  it('builds a choice request with the options as criteria', () => {
    const built = buildTesterRequest(form({ type: 'choice', options: 'billing: money\ntech: bugs', family: 'routing' }));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.questions[TESTER_QUESTION_KEY]).toEqual({
      type: 'choice',
      instructions: 'Which team must act on this request?',
      criteria: { billing: 'money', tech: 'bugs' },
    });
    expect(built.request.provider).toBe('auto');
    expect(built.request.featureSource).toBe('decision-test');
  });

  it('refuses a blank state, blank instructions and a choice with fewer than two options — no request', () => {
    expect(buildTesterRequest(form({ state: '  ' })).ok).toBe(false);
    expect(buildTesterRequest(form({ instructions: '' })).ok).toBe(false);
    const one = buildTesterRequest(form({ type: 'choice', options: 'billing: money' }));
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.reason).toMatch(/two options/);
  });
});

describe('testerResultView — the ONE place probabilities are shown, as numbers (D2 §8)', () => {
  it('shows a choice answer, the band, provider / model / calibrated / latency and every probability', () => {
    const response: DecisionsDecideResponse = {
      ok: true,
      result: result({
        answers: {
          [TESTER_QUESTION_KEY]: {
            type: 'choice',
            choice: 'billing',
            probabilities: { tech: 0.03, billing: 0.95, sales: 0.02 },
            confidence: 0.9,
          },
        },
        skipped: [{ provider: 'local', why: 'no local model' }],
      }),
    };
    const view = testerResultView(response);
    expect(view).toMatchObject({
      ok: true,
      answer: 'billing',
      band: 'act',
      provider: 'jev',
      model: 'jev-1.14.0',
      calibrated: true,
      latencyMs: 412,
      cached: false,
      skipped: ['local: no local model'],
    });
    if (!view.ok) return;
    expect(view.probabilities).toEqual([
      { label: 'billing', value: '0.950' },
      { label: 'tech', value: '0.030' },
      { label: 'sales', value: '0.020' },
    ]);
  });

  it('reads a noul as yes / no with both numbers; the band uses the top answer', () => {
    const view = testerResultView({ ok: true, result: result({ answers: { [TESTER_QUESTION_KEY]: { type: 'noul', p: 0.2 } } }) });
    expect(view).toMatchObject({ ok: true, answer: 'no', band: 'escalate' });
    if (view.ok) expect(view.probabilities).toEqual([
      { label: 'yes', value: '0.200' },
      { label: 'no', value: '0.800' },
    ]);
  });

  it('escalates an uncalibrated answer and a refusal', () => {
    const uncal = testerResultView({
      ok: true,
      result: result({ calibrated: false, provider: 'llm', answers: { [TESTER_QUESTION_KEY]: { type: 'noul', p: 1 } } }),
    });
    expect(uncal).toMatchObject({ ok: true, answer: 'yes', band: 'escalate', calibrated: false });
    const refused = testerResultView({
      ok: true,
      result: result({ answers: { [TESTER_QUESTION_KEY]: { type: 'refused', reason: 'out of scope' } } }),
    });
    expect(refused).toMatchObject({ ok: true, answer: '', band: 'escalate', refused: 'out of scope', probabilities: [] });
  });

  it('passes a typed error through', () => {
    expect(testerResultView({ ok: false, error: { code: 'no-provider', message: 'No provider can answer' } })).toEqual({
      ok: false,
      code: 'no-provider',
      message: 'No provider can answer',
    });
  });

  it('bands at the decide tool’s default threshold', () => {
    expect(DECISIONS_TESTER_THRESHOLD).toBe(0.9);
  });
});
