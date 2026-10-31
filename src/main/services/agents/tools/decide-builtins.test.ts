// The two gate nodes (DECISION_MODELS_DESIGN.md §10.2) — ruling D-r16 (b) + (c): fed D1's T3 rows / D1's T2 rule + families, the
// built-ins' requests, sent through the REAL engine and the System One adapter with a fake `fetch` (no network, a fake key), produce HTTP
// bodies whose state + question text + criteria EQUAL D1's dry-run bodies for EVERY row. Also: the family each sets, the band on the
// fake answers, featureSource per caller, and route_request's default rule.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DecisionRequest } from '../../../../shared/types/decisions';
import { DECISION_PROVIDER_PRESETS, DecisionEngine, type SystemOneFetch } from '../../../../decision-engine';
import t2 from '../../decisions/benchmark/fixtures/t2-routing.json';
import t3 from '../../decisions/benchmark/fixtures/t3-verify.json';
import dry from '../../decisions/benchmark/fixtures/d1-dry-run-t2-t3.json';
import { makeToolContext } from './test-context';

interface SentBody {
  model: string;
  state: unknown;
  questions: Record<string, { type: string; instructions: string; criteria?: unknown }>;
}
const sent: SentBody[] = [];
const requests: DecisionRequest[] = [];
/** Answers every question of a body: T3 by the row's label, T2 by the row's family (looked up by the question text). */
let answerFor: (q: { type: string; instructions: string }) => Record<string, unknown> = () => ({});

const fetch: SystemOneFetch = async (_url, init) => {
  const body = JSON.parse(init.body) as SentBody;
  sent.push(body);
  const answers = Object.fromEntries(Object.entries(body.questions).map(([key, q]) => [key, answerFor(q)]));
  return { ok: true, status: 200, text: async () => JSON.stringify({ model: body.model, answers, usage: { input_tokens: 400 } }) };
};
const JEV = DECISION_PROVIDER_PRESETS.find((p) => p.id === 'jev');
if (!JEV) throw new Error('no jev preset');
/** A fresh engine per test — its cache would otherwise answer a repeated question without a body. */
let engine = new DecisionEngine({ fetch });

vi.mock('../../decisions/decision-runtime', () => ({
  getDecisionRuntime: () => ({
    decide: (request: DecisionRequest, options: { signal?: AbortSignal }) => {
      requests.push(request);
      return engine.decide(request, options);
    },
  }),
}));

const { checkMatchesRequestTool } = await import('./check-matches-request');
const { routeRequestTool } = await import('./route-request');

const dryKey = (id: string) => id.replace(/[^A-Za-z0-9_]/g, '_');
type T3Row = Omit<(typeof t3.rows)[number], 'kind'> & { kind: 'template' | 'caption' | 'clip'; request?: string; scriptLine?: string };
const t3Rows = t3.rows as T3Row[];
/** D1's T3 question = header line, the item line(s), then `Request: "<request>"` / `Script line: "<line>"`. */
const itemOf = (row: T3Row) => row.question.split('\n').slice(1, -1).join('\n');
const requestOf = (row: T3Row) => row.request ?? row.scriptLine ?? '';
/** D1's T2 criteria (`K1\hosted-run.cjs:50`): each family's meaning; `none` has no tools. */
const familyTools = t2.familyTools as Record<string, { meaning?: string } | undefined>;
const T2_OPTIONS = Object.fromEntries(
  t2.families.map((f) => [f, familyTools[f]?.meaning ?? 'no editing tool: a question, thanks, a preference to remember, notes']),
);
const dryT3 = dry.t3.questions as Record<string, SentBody['questions'][string]>;
const dryT2 = dry.t2.questions as Record<string, SentBody['questions'][string]>;

beforeEach(() => {
  sent.length = 0;
  requests.length = 0;
  engine = new DecisionEngine({ fetch });
  engine.register({ ...JEV, apiKey: 'sk-test-FAKE-decide-0031' });
});

describe('check_matches_request — D1’s T3 shape, every row (D-r16 (b), (c))', () => {
  it('state = D1’s T3 rule verbatim; ONE noul question = the row’s question; D1’s T3 criteria; family verify', async () => {
    expect(t3Rows).toHaveLength(40);
    for (const row of t3Rows) {
      answerFor = () => ({ noul: row.answer ? 0.98 : 0.02 });
      const out = await checkMatchesRequestTool.handler(
        { item: itemOf(row), request: requestOf(row), itemKind: row.kind },
        makeToolContext({ featureSource: 'flows' }),
      );
      const body = sent[sent.length - 1];
      expect(body.state, row.id).toBe(dry.t3.state);
      expect(body.state, row.id).toBe(t3.instruction);
      const questions = Object.values(body.questions);
      expect(questions, row.id).toHaveLength(1);
      expect(questions[0], row.id).toEqual(dryT3[dryKey(row.id)]);
      const request = requests[requests.length - 1];
      expect(request.family, row.id).toBe('verify');
      expect(request.featureSource, row.id).toBe('decision-flow');
      expect(out.fields, row.id).toEqual({ band: 'act', answer: row.answer ? 'yes' : 'no', p: 0.98 });
    }
    expect(sent).toHaveLength(40);
  });

  it('a generic item kind (the default) asks D1’s question family about “this item”', async () => {
    answerFor = () => ({ noul: 0.6 });
    const out = await checkMatchesRequestTool.handler({ item: 'A slow zoom on a city skyline.', request: 'Open on the city.' }, makeToolContext());
    const q = Object.values(sent[0].questions)[0];
    expect(q.instructions).toBe('Does this item do what the request asks?\nA slow zoom on a city skyline.\nRequest: "Open on the city."');
    expect(q.criteria).toEqual(dryT3.t3_01.criteria);
    expect(requests[0].featureSource).toBe('decision-agent');
    expect(out.fields?.band).toBe('escalate');
  });
});

describe('route_request — D1’s T2 shape, every row (D-r16 (b), (c))', () => {
  it('state = the rule passed (D1’s T2 rule); ONE choice “Which ONE tool family must act on this request? Request: <JSON>”; the options as criteria; family routing', async () => {
    expect(t2.rows).toHaveLength(40);
    for (const row of t2.rows) {
      answerFor = () => ({
        choice: row.family,
        probabilities: Object.fromEntries(t2.families.map((f) => [f, f === row.family ? 0.95 : 0.01])),
        confidence: 0.9,
      });
      const out = await routeRequestTool.handler(
        { request: row.request, options: T2_OPTIONS, rule: t2.instruction, subject: 'tool family' },
        makeToolContext({ featureSource: 'agent' }),
      );
      const body = sent[sent.length - 1];
      expect(body.state, row.id).toBe(dry.t2.state);
      const questions = Object.values(body.questions);
      expect(questions, row.id).toHaveLength(1);
      expect(questions[0], row.id).toEqual(dryT2[dryKey(row.id)]);
      const request = requests[requests.length - 1];
      expect(request.family, row.id).toBe('routing');
      expect(request.featureSource, row.id).toBe('decision-agent');
      expect(out.fields?.answer, row.id).toBe(row.family);
      expect(out.fields?.band, row.id).toBe('act');
    }
  });

  it('the canvas form (one `id: description` per line) and the default subject send the same body as the record', async () => {
    const row = t2.rows[0];
    answerFor = () => ({ choice: 'cut', probabilities: { cut: 0.95, audio: 0.01, shots: 0.01, captions: 0.01, export: 0.01, none: 0.01 } });
    const lines = Object.entries(T2_OPTIONS).map(([id, d]) => `${id}: ${d}`).join('\n');
    await routeRequestTool.handler({ request: row.request, options: lines, rule: t2.instruction }, makeToolContext());
    expect(Object.values(sent[0].questions)[0]).toEqual(dryT2[dryKey(row.id)]);
  });

  it('without a rule, the state is a generic rule naming the caller’s options', async () => {
    answerFor = () => ({ choice: 'billing', probabilities: { billing: 0.5, support: 0.5 } });
    const out = await routeRequestTool.handler(
      { request: 'I was charged twice.', options: 'billing: a payment question\nsupport: a bug', subject: 'team' },
      makeToolContext(),
    );
    expect(sent[0].state).toBe('You route a request to the ONE team that must act on it: billing (a payment question), or support (a bug).');
    expect(Object.values(sent[0].questions)[0]).toEqual({
      type: 'choice',
      instructions: 'Which ONE team must act on this request? Request: "I was charged twice."',
      criteria: { billing: 'a payment question', support: 'a bug' },
    });
    expect(out.fields?.band).toBe('escalate');
  });

  it('fewer than two options → a plain sentence, no request', async () => {
    const out = await routeRequestTool.handler({ request: 'x', options: 'billing: a payment question' }, makeToolContext());
    expect(out.isError).toBe(true);
    expect(sent).toHaveLength(0);
  });
});
