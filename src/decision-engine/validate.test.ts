import { describe, expect, it } from 'vitest';
import { DECISION_REQUEST_CEILING, estimateTokens, validateDecisionRequest } from './validate';

// D2 §4 validate.ts: request shape + per-type rules (choice 2..255 options, score 2–10 levels, non-empty instructions, state size).
// Malformed → 'invalid-request'; over every adapter's ceiling → 'unsupported' (§3). Reasons never carry the state text.

const STATE_TEXT = 'PRIVATE-STATE-TEXT the caller would not want echoed';

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: STATE_TEXT,
    questions: { ok: { type: 'noul', instructions: 'Does the item do what the request asks?' } },
    featureSource: 'flows',
    ...overrides,
  };
}

function options(n: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < n; i++) out[`opt${i}`] = `option ${i}`;
  return out;
}

function levels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `level ${i}`);
}

function expectFail(input: unknown, code: 'invalid-request' | 'unsupported'): string {
  const r = validateDecisionRequest(input);
  expect(r.ok).toBe(false);
  if (r.ok) throw new Error('expected a failure');
  expect(r.code).toBe(code);
  expect(r.reason).not.toContain(STATE_TEXT);
  expect(r.reason.length).toBeGreaterThan(0);
  return r.reason;
}

describe('validateDecisionRequest — accepted shapes', () => {
  it('accepts a minimal noul request and measures it', () => {
    const r = validateDecisionRequest(base());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.measure).toEqual({ questionCount: 1, maxOptions: 0, maxLevels: 0, stateTokens: estimateTokens(STATE_TEXT) });
    expect(r.request.state).toBe(STATE_TEXT);
    expect(r.request.featureSource).toBe('flows');
  });

  it('accepts a D1-shaped T2 routing request (one choice over the six families)', () => {
    const families = { cut: 'cuts', audio: 'audio', shots: 'shots', captions: 'captions', export: 'export', none: 'none of these' };
    const r = validateDecisionRequest(
      base({ questions: { route: { type: 'choice', instructions: 'Which ONE tool family must act? Request: "x"', criteria: families } }, family: 'routing' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.measure.maxOptions).toBe(6);
  });

  it('accepts object and array states (measured as JSON)', () => {
    const obj = validateDecisionRequest(base({ state: { item: 'a caption style', request: 'bold yellow' } }));
    const arr = validateDecisionRequest(base({ state: ['one', 'two'] }));
    expect(obj.ok && arr.ok).toBe(true);
    if (obj.ok) expect(obj.measure.stateTokens).toBe(estimateTokens(JSON.stringify({ item: 'a caption style', request: 'bold yellow' })));
  });

  it('accepts noul criteria when both sides are non-empty, and score levels 2..10', () => {
    expect(validateDecisionRequest(base({ questions: { q: { type: 'noul', instructions: 'x', criteria: { true: 'yes', false: 'no' } } } })).ok).toBe(true);
    const r = validateDecisionRequest(base({ questions: { s: { type: 'score', instructions: 'rate', criteria: levels(10) } } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.measure.maxLevels).toBe(10);
    expect(validateDecisionRequest(base({ questions: { s: { type: 'score', instructions: 'rate', criteria: levels(2) } } })).ok).toBe(true);
  });

  it('accepts choice at exactly 2 and exactly 255 options', () => {
    expect(validateDecisionRequest(base({ questions: { c: { type: 'choice', instructions: 'pick', criteria: options(2) } } })).ok).toBe(true);
    const r = validateDecisionRequest(base({ questions: { c: { type: 'choice', instructions: 'pick', criteria: options(255) } } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.measure.maxOptions).toBe(255);
  });

  it('accepts every provider choice and family, and drops unknown fields from the returned request', () => {
    for (const provider of ['auto', 'local', 'jev', 'openrouter-decisions', 'llm']) {
      expect(validateDecisionRequest(base({ provider })).ok).toBe(true);
    }
    for (const family of ['routing', 'verify', 'other']) expect(validateDecisionRequest(base({ family })).ok).toBe(true);
    const r = validateDecisionRequest(base({ extra: 'junk', allowUncalibrated: true, timeoutMs: 15_000 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request).not.toHaveProperty('extra');
    expect(r.request.allowUncalibrated).toBe(true);
    expect(r.request.timeoutMs).toBe(15_000);
  });

  it('measures several questions: count, the widest choice, the deepest score', () => {
    const r = validateDecisionRequest(
      base({
        questions: {
          a: { type: 'choice', instructions: 'a', criteria: options(3) },
          b: { type: 'choice', instructions: 'b', criteria: options(7) },
          c: { type: 'score', instructions: 'c', criteria: levels(4) },
          d: { type: 'noul', instructions: 'd' },
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.measure).toMatchObject({ questionCount: 4, maxOptions: 7, maxLevels: 4 });
  });
});

describe('validateDecisionRequest — malformed → invalid-request', () => {
  it('rejects a non-object request', () => {
    for (const input of [null, undefined, 'x', 3, [base()]]) expectFail(input, 'invalid-request');
  });

  it('rejects a missing, empty or wrongly typed state', () => {
    for (const state of [undefined, null, '', '   ', 42, true]) expectFail(base({ state }), 'invalid-request');
  });

  it('needs at least one question in a keyed object', () => {
    expect(expectFail(base({ questions: {} }), 'invalid-request')).toMatch(/at least one question/);
    for (const questions of [undefined, null, 'q', [{ type: 'noul', instructions: 'x' }]]) expectFail(base({ questions }), 'invalid-request');
    expectFail(base({ questions: { '': { type: 'noul', instructions: 'x' } } }), 'invalid-request');
  });

  it('rejects an unknown question type and a non-object question', () => {
    expectFail(base({ questions: { q: { type: 'predicate', instructions: 'x' } } }), 'invalid-request');
    expectFail(base({ questions: { q: 'noul' } }), 'invalid-request');
  });

  it('needs non-empty instructions on every question type', () => {
    for (const instructions of [undefined, '', '  \n ', 7]) {
      expectFail(base({ questions: { q: { type: 'noul', instructions } } }), 'invalid-request');
      expectFail(base({ questions: { q: { type: 'choice', instructions, criteria: options(3) } } }), 'invalid-request');
      expectFail(base({ questions: { q: { type: 'score', instructions, criteria: levels(3) } } }), 'invalid-request');
    }
  });

  it('choice: fewer than 2 options, a non-object criteria, an empty id or description', () => {
    expect(expectFail(base({ questions: { c: { type: 'choice', instructions: 'p', criteria: options(1) } } }), 'invalid-request')).toMatch(/2/);
    expectFail(base({ questions: { c: { type: 'choice', instructions: 'p', criteria: options(0) } } }), 'invalid-request');
    expectFail(base({ questions: { c: { type: 'choice', instructions: 'p' } } }), 'invalid-request');
    expectFail(base({ questions: { c: { type: 'choice', instructions: 'p', criteria: ['a', 'b'] } } }), 'invalid-request');
    expectFail(base({ questions: { c: { type: 'choice', instructions: 'p', criteria: { a: 'A', '': 'B' } } } }), 'invalid-request');
    expectFail(base({ questions: { c: { type: 'choice', instructions: 'p', criteria: { a: 'A', b: ' ' } } } }), 'invalid-request');
    expectFail(base({ questions: { c: { type: 'choice', instructions: 'p', criteria: { a: 'A', b: 2 } } } }), 'invalid-request');
  });

  it('score: fewer than 2 levels, a non-array criteria, an empty level', () => {
    expectFail(base({ questions: { s: { type: 'score', instructions: 'r', criteria: levels(1) } } }), 'invalid-request');
    expectFail(base({ questions: { s: { type: 'score', instructions: 'r', criteria: { a: 'A', b: 'B' } } } }), 'invalid-request');
    expectFail(base({ questions: { s: { type: 'score', instructions: 'r', criteria: ['low', ''] } } }), 'invalid-request');
  });

  it('noul: criteria, when present, needs non-empty true and false', () => {
    expectFail(base({ questions: { q: { type: 'noul', instructions: 'x', criteria: { true: 'yes' } } } }), 'invalid-request');
    expectFail(base({ questions: { q: { type: 'noul', instructions: 'x', criteria: { true: 'yes', false: '' } } } }), 'invalid-request');
    expectFail(base({ questions: { q: { type: 'noul', instructions: 'x', criteria: 'yes/no' } } }), 'invalid-request');
  });

  it('rejects an unknown provider (OpenAI is dropped; the OpenRouter rung id is openrouter-decisions)', () => {
    for (const provider of ['openai', 'openrouter', 'typesafe', '', 3]) expectFail(base({ provider }), 'invalid-request');
  });

  it('rejects a missing featureSource and wrongly typed options', () => {
    expectFail(base({ featureSource: undefined }), 'invalid-request');
    expectFail(base({ featureSource: '' }), 'invalid-request');
    expectFail(base({ allowUncalibrated: 'yes' }), 'invalid-request');
    for (const timeoutMs of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, '15000']) expectFail(base({ timeoutMs }), 'invalid-request');
    for (const family of ['pick', '', 1]) expectFail(base({ family }), 'invalid-request');
  });
});

describe('validateDecisionRequest — over every adapter ceiling → unsupported', () => {
  it('the ceiling is the widest adapter in this slice (Jev: 255 options, 10 levels, 64k tokens)', () => {
    expect(DECISION_REQUEST_CEILING.maxOptions).toBe(255);
    expect(DECISION_REQUEST_CEILING.maxLevels).toBe(10);
    expect(DECISION_REQUEST_CEILING.maxStateTokens).toBe(64_000);
    expect(DECISION_REQUEST_CEILING.maxQuestions).toBe(1_000);
  });

  it('choice over 255 options and score over 10 levels', () => {
    expectFail(base({ questions: { c: { type: 'choice', instructions: 'p', criteria: options(256) } } }), 'unsupported');
    expectFail(base({ questions: { s: { type: 'score', instructions: 'r', criteria: levels(11) } } }), 'unsupported');
  });

  it('a state over the token ceiling (string and object), and exactly at it passes', () => {
    const atCeiling = 'a'.repeat(DECISION_REQUEST_CEILING.maxStateTokens * 3);
    expect(estimateTokens(atCeiling)).toBe(DECISION_REQUEST_CEILING.maxStateTokens);
    expect(validateDecisionRequest(base({ state: atCeiling })).ok).toBe(true);
    expect(expectFail(base({ state: `${atCeiling}abc` }), 'unsupported')).toMatch(/state/i);
    expectFail(base({ state: { text: atCeiling } }), 'unsupported');
  });

  it('more questions than the ceiling', () => {
    const questions: Record<string, unknown> = {};
    for (let i = 0; i <= DECISION_REQUEST_CEILING.maxQuestions; i++) questions[`q${i}`] = { type: 'noul', instructions: 'x' };
    expectFail(base({ questions }), 'unsupported');
  });
});

describe('estimateTokens', () => {
  it('is ceil(UTF-8 bytes / 3) — conservative for English, more so for Arabic', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcd')).toBe(2);
    expect(estimateTokens('مرحبا')).toBe(4); // 5 letters × 2 bytes = 10 bytes
  });
});
