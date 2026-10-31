import { describe, expect, it } from 'vitest';
import { SystemOneProvider, SYSTEM_ONE_LIMITS, type SystemOneFetch, type SystemOneFetchResponse } from './system-one-provider';
import recordedBodies from './fixtures/system-one-recorded-bodies.json';
import { DecisionError, type DecisionErrorCode, type DecisionQuestion, type DecisionRequest } from '../types';

// D4 (b) — the System One adapter's failure paths (D2 §3 typed errors, §5.1, §9): an off-list option and a cut / unparseable body →
// invalid-answer; one retry on 429 / 5xx / network inside the budget, never on 4xx; a split only over a per-request limit; no error
// message ever carries the key or the state text (or the evidence inside a question's instructions).

const FAKE_KEY = 'sk-test-FAKE-0000-abcdefghijklmnop';
const STATE = 'PRIVATE STATE TEXT — the user’s script line that must never reach an error message';
const EVIDENCE = 'Item: the private clip description the caller put in the instructions';
const JEV_T2 = (recordedBodies as unknown as Record<string, { model: string; answers: Record<string, unknown>; usage: unknown }>)['jev-t2'];
const FAMILIES = { cut: 'c', audio: 'a', shots: 's', captions: 'cap', export: 'e', none: 'n' };

type Step = { status: number; text: string } | Error;

function scripted(steps: Step[]): { fetch: SystemOneFetch; bodies: Array<Record<string, Record<string, DecisionQuestion>>> } {
  const bodies: Array<Record<string, Record<string, DecisionQuestion>>> = [];
  let i = 0;
  const fetch: SystemOneFetch = async (_url, init): Promise<SystemOneFetchResponse> => {
    bodies.push(JSON.parse(init.body) as Record<string, Record<string, DecisionQuestion>>);
    const step = steps[Math.min(i++, steps.length - 1)];
    if (step instanceof Error) throw step;
    return { ok: step.status >= 200 && step.status < 300, status: step.status, text: async () => step.text };
  };
  return { fetch, bodies };
}

function provider(steps: Step[]): { p: SystemOneProvider; bodies: ReturnType<typeof scripted>['bodies'] } {
  const { fetch, bodies } = scripted(steps);
  const p = new SystemOneProvider({ id: 'jev', baseURL: 'https://api.typesafe.ai/v1/systemone', model: 'jev-1.14.0', apiKey: FAKE_KEY, fetch, retryDelayMs: () => 0 });
  return { p, bodies };
}

function t2Request(): DecisionRequest {
  const questions = Object.fromEntries(
    Object.keys(JEV_T2.answers).map((k): [string, DecisionQuestion] => [k, { type: 'choice', instructions: `${EVIDENCE} ${k}`, criteria: FAMILIES }]),
  );
  return { state: STATE, questions, featureSource: 'flows' };
}

const ok = (body: unknown): Step => ({ status: 200, text: JSON.stringify(body) });
const T2_OK = ok(JEV_T2);

async function failure(promise: Promise<unknown>, code: DecisionErrorCode): Promise<DecisionError> {
  let err: unknown;
  try {
    await promise;
  } catch (e) {
    err = e;
  }
  if (!(err instanceof DecisionError)) throw new Error(`expected a DecisionError, got ${String(err)}`);
  expect(err.code).toBe(code);
  expect(err.provider).toBe('jev');
  for (const secret of [FAKE_KEY, STATE, EVIDENCE, 'FAKE-0000', 'PRIVATE STATE', 'private clip description']) expect(err.message).not.toContain(secret);
  return err;
}

const signal = (): AbortSignal => new AbortController().signal;

describe('SystemOneProvider — answers that cannot be read → invalid-answer (P11)', () => {
  it('an off-list option (in choice or in probabilities)', async () => {
    const offChoice = structuredClone(JEV_T2) as { answers: Record<string, { choice: string; probabilities: Record<string, number> }> };
    offChoice.answers.t2_01.choice = 'render';
    await failure(provider([ok(offChoice)]).p.decide(t2Request(), signal()), 'invalid-answer');
    const offProb = structuredClone(JEV_T2) as { answers: Record<string, { probabilities: Record<string, number> }> };
    offProb.answers.t2_02.probabilities = { ...offProb.answers.t2_02.probabilities, render: 0.2 };
    await failure(provider([ok(offProb)]).p.decide(t2Request(), signal()), 'invalid-answer');
  });

  it('a cut JSON body, a non-JSON body and a body without answers', async () => {
    const full = JSON.stringify(JEV_T2);
    await failure(provider([{ status: 200, text: full.slice(0, Math.floor(full.length / 2)) }]).p.decide(t2Request(), signal()), 'invalid-answer');
    await failure(provider([{ status: 200, text: '<html>gateway</html>' }]).p.decide(t2Request(), signal()), 'invalid-answer');
    await failure(provider([ok({ model: 'jev-1.14.0' })]).p.decide(t2Request(), signal()), 'invalid-answer');
  });

  it('a question with no answer, a wrong answer type and a noul p outside [0, 1]', async () => {
    const missing = structuredClone(JEV_T2) as { answers: Record<string, unknown> };
    delete missing.answers.t2_40;
    await failure(provider([ok(missing)]).p.decide(t2Request(), signal()), 'invalid-answer');
    const noul: DecisionRequest = { state: STATE, questions: { q: { type: 'noul', instructions: EVIDENCE } }, featureSource: 'flows' };
    await failure(provider([ok({ model: 'm', answers: { q: { type: 'choice', choice: 'x' } } })]).p.decide(noul, signal()), 'invalid-answer');
    await failure(provider([ok({ model: 'm', answers: { q: { type: 'noul', noul: 1.7 } } })]).p.decide(noul, signal()), 'invalid-answer');
  });

  it('renormalises hundredths that do not sum to 1 (P24)', async () => {
    const req: DecisionRequest = { state: STATE, questions: { c: { type: 'choice', instructions: 'pick', criteria: { a: 'A', b: 'B' } } }, featureSource: 'flows' };
    const out = await provider([ok({ model: 'jev-1.14.0', answers: { c: { type: 'choice', choice: 'a', confidence: 0.6, probabilities: { a: 0.6, b: 0.41 } } }, usage: { input_tokens: 9 } })]).p.decide(req, signal());
    const c = out.answers.c;
    if (c.type !== 'choice') throw new Error('not a choice');
    expect(c.choice).toBe('a');
    expect(c.confidence).toBe(0.6);
    expect(c.probabilities.a).toBeCloseTo(0.6 / 1.01, 12);
    expect(c.probabilities.a + c.probabilities.b).toBeCloseTo(1, 12);
  });
});

describe('SystemOneProvider — HTTP failures, retries and scrubbing (§9)', () => {
  it('retries once on 429 / 5xx / a network error, then answers', async () => {
    for (const first of [{ status: 429, text: '' }, { status: 503, text: 'busy' }, new TypeError('fetch failed')]) {
      const { p, bodies } = provider([first, T2_OK]);
      const out = await p.decide(t2Request(), signal());
      expect(bodies).toHaveLength(2);
      expect(out.model).toBe('jev-1.14.0');
    }
  });

  it('never retries a 4xx; a second 5xx is a provider-error', async () => {
    const four = provider([{ status: 400, text: '{"error":{"message":"bad request"}}' }, T2_OK]);
    const err = await failure(four.p.decide(t2Request(), signal()), 'provider-error');
    expect(err.message).toMatch(/400/);
    expect(err.message).toContain('bad request');
    expect(four.bodies).toHaveLength(1);
    const five = provider([{ status: 502, text: '' }, { status: 500, text: '' }, T2_OK]);
    await failure(five.p.decide(t2Request(), signal()), 'provider-error');
    expect(five.bodies).toHaveLength(2);
  });

  it('an error body echoing the key, the state or the evidence never reaches the message', async () => {
    const echoes = [
      { error: { message: `Invalid API key: ${FAKE_KEY}` } },
      { error: { message: `Could not parse state "${STATE}"` } },
      { message: `question failed: ${EVIDENCE.slice(0, 40)}` },
      { error: `Bearer ${FAKE_KEY} is not allowed` },
    ];
    for (const body of echoes) await failure(provider([{ status: 401, text: JSON.stringify(body) }]).p.decide(t2Request(), signal()), 'provider-error');
    const net = new Error(`connect ECONNREFUSED while sending Authorization: Bearer ${FAKE_KEY} with ${STATE}`);
    await failure(provider([net, net]).p.decide(t2Request(), signal()), 'provider-error');
  });

  it('an aborted signal stops before or during the request', async () => {
    const controller = new AbortController();
    controller.abort();
    await failure(provider([T2_OK]).p.decide(t2Request(), controller.signal), 'cancelled');
  });
});

describe('SystemOneProvider — limits, readiness and packing (§5.1, §9)', () => {
  it('reports D2 §5.1 limits and is ready only with a key', async () => {
    expect(SYSTEM_ONE_LIMITS).toEqual({ maxOptions: 255, maxLevels: 10, maxStateTokens: 64_000, maxQuestions: 1_000 });
    expect(provider([]).p.limits()).toEqual(SYSTEM_ONE_LIMITS);
    expect(await provider([]).p.checkReady()).toEqual({ ready: true });
    const keyless = new SystemOneProvider({ id: 'jev', baseURL: 'https://x', model: 'm', apiKey: '' });
    expect((await keyless.checkReady()).ready).toBe(false);
  });

  it('sends one request up to 400 questions; splits a bigger one (one usage entry per HTTP call)', async () => {
    const questions = Object.fromEntries(Array.from({ length: 401 }, (_, i): [string, DecisionQuestion] => [`q${i}`, { type: 'noul', instructions: `is ${i} even?` }]));
    const answerAll: SystemOneFetch = async (_url, init) => {
      const asked = Object.keys((JSON.parse(init.body) as { questions: Record<string, unknown> }).questions);
      const answers = Object.fromEntries(asked.map((k) => [k, { type: 'noul', noul: 0.25 }]));
      return { ok: true, status: 200, text: async () => JSON.stringify({ model: 'jev-1.14.0', answers, usage: { input_tokens: asked.length } }) };
    };
    const p = new SystemOneProvider({ id: 'jev', baseURL: 'https://x', model: 'jev-1.14.0', apiKey: FAKE_KEY, fetch: answerAll });
    const out = await p.decide({ state: 'rule', questions, featureSource: 'flows' }, signal());
    expect(Object.keys(out.answers)).toHaveLength(401);
    expect(out.calls?.map((c) => c.inputTokens)).toEqual([400, 1]);
    expect(out.usage.inputTokens).toBe(401);
    const small = await p.decide({ state: 'rule', questions: { a: questions.q0 }, featureSource: 'flows' }, signal());
    expect(small.calls).toHaveLength(1);
  });
});
