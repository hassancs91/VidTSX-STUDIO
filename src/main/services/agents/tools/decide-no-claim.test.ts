// The no-claim test (DECISION_MODELS_DESIGN.md §15.1, §1 — the E3 lesson): over EVERY T2 / T3 row and BOTH bands, plus the uncalibrated,
// refused and error texts, what the agent reads from `decide` / `check_matches_request` / `route_request` holds none of `%`, `match`,
// `matches`, `sure`, `confident`, `definitely`, `certain`, `probability` (case-insensitive, whole words — §10.1's own escalate text says
// "uncertain", which is the hedge, not the claim) and no number at all; `band` is the only verdict word. Mocked runtime, no network.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DecisionAnswer, DecisionErrorCode, DecisionRequest, DecisionResult } from '../../../../shared/types/decisions';
import { DecisionError } from '../../../../decision-engine';
import t2 from '../../decisions/benchmark/fixtures/t2-routing.json';
import t3 from '../../decisions/benchmark/fixtures/t3-verify.json';
import type { AgentToolResult } from './types';
import { makeToolContext } from './test-context';

const decide = vi.fn<(request: DecisionRequest) => Promise<DecisionResult>>();
vi.mock('../../decisions/decision-runtime', () => ({
  getDecisionRuntime: () => ({ decide: (request: DecisionRequest) => decide(request) }),
}));

const { decideTool } = await import('./decide');
const { checkMatchesRequestTool } = await import('./check-matches-request');
const { routeRequestTool } = await import('./route-request');

const NO_CLAIM = [/%/, /\bmatch\b/i, /\bmatches\b/i, /\bsure\b/i, /\bconfident\b/i, /\bdefinitely\b/i, /\bcertain\b/i, /\bprobability\b/i];
/** The only shapes the agent may read (§10.1): the answer + the band, or a plain sentence. */
const SHAPE = /^Decision: (?:[a-z]+ \((?:act|act — uncalibrated)\)|uncertain — (?:top answer [a-z]+|no answer) \(escalate\))$/;

function assertNoClaim(out: AgentToolResult, label: string): string {
  const text = out.content.map((c) => c.text).join('\n');
  for (const banned of NO_CLAIM) expect(text, `${label}: ${banned}`).not.toMatch(banned);
  expect(text, `${label}: a number`).not.toMatch(/\d/);
  return text;
}
const reply = (answer: DecisionAnswer, calibrated = true): DecisionResult => ({
  answers: { decision: answer },
  provider: 'jev',
  model: 'jev-1.14.0',
  calibrated,
  usage: { inputTokens: 400, costUsd: 0.0000168 },
  latencyMs: 412,
  cached: false,
});
const familyTools = t2.familyTools as Record<string, { meaning?: string } | undefined>;
const T2_OPTIONS = Object.fromEntries(t2.families.map((f) => [f, familyTools[f]?.meaning ?? 'no editing tool']));
const t2Choice = (family: string, top: number): DecisionAnswer => {
  const rest = (1 - top) / (t2.families.length - 1);
  return { type: 'choice', choice: family, probabilities: Object.fromEntries(t2.families.map((f) => [f, f === family ? top : rest])), confidence: 0.99 };
};
type T3Row = Omit<(typeof t3.rows)[number], 'kind'> & { kind: 'template' | 'caption' | 'clip'; request?: string; scriptLine?: string };

// A block body: a function RETURNED from beforeEach is a teardown — `mockReset()` returns the mock, which vitest would then call.
beforeEach(() => {
  decide.mockReset();
});

describe('no-claim — every T3 row × both bands (check_matches_request, and decide on the same question)', () => {
  it('act and escalate, for yes and no answers', async () => {
    let count = 0;
    for (const row of t3.rows as T3Row[]) {
      const item = row.question.split('\n').slice(1, -1).join('\n');
      const request = row.request ?? row.scriptLine ?? '';
      for (const p of row.answer ? [0.9973, 0.6314] : [0.0021, 0.4187]) {
        decide.mockResolvedValue(reply({ type: 'noul', p }));
        const gate = await checkMatchesRequestTool.handler({ item, request, itemKind: row.kind }, makeToolContext({ featureSource: 'flows' }));
        expect(assertNoClaim(gate, `${row.id} p=${p}`), row.id).toMatch(SHAPE);
        const generic = await decideTool.handler({ state: t3.instruction, type: 'noul', instructions: row.question, family: 'verify' }, makeToolContext());
        expect(assertNoClaim(generic, `${row.id} decide p=${p}`)).toMatch(SHAPE);
        count += 2;
      }
    }
    expect(count).toBe(160);
  });
});

describe('no-claim — every T2 row × both bands (route_request, and decide on the same question)', () => {
  it('act and escalate on the row’s own family', async () => {
    let bands = new Set<string>();
    for (const row of t2.rows) {
      for (const top of [0.9817, 0.5462]) {
        decide.mockResolvedValue(reply(t2Choice(row.family, top)));
        const routed = await routeRequestTool.handler({ request: row.request, options: T2_OPTIONS, rule: t2.instruction }, makeToolContext());
        expect(assertNoClaim(routed, `${row.id} top=${top}`)).toMatch(SHAPE);
        bands = bands.add(String(routed.fields?.band));
        const generic = await decideTool.handler(
          { state: t2.instruction, type: 'choice', instructions: `Request: ${JSON.stringify(row.request)}`, options: T2_OPTIONS, family: 'routing' },
          makeToolContext({ featureSource: 'flows' }),
        );
        expect(assertNoClaim(generic, `${row.id} decide top=${top}`)).toMatch(SHAPE);
      }
    }
    expect([...bands].sort()).toEqual(['act', 'escalate']);
  });
});

describe('no-claim — the uncalibrated, refused and error texts', () => {
  it('uncalibrated (both toggles) and refused', async () => {
    decide.mockResolvedValue(reply(t2Choice('captions', 0.97), false));
    for (const allowUncalibrated of [false, true]) {
      const out = await routeRequestTool.handler({ request: 'Turn on subtitles.', options: T2_OPTIONS, allowUncalibrated }, makeToolContext());
      expect(assertNoClaim(out, `uncalibrated allow=${allowUncalibrated}`)).toMatch(SHAPE);
    }
    decide.mockResolvedValue(reply({ type: 'refused', reason: 'policy 42 %' }));
    const refused = await checkMatchesRequestTool.handler({ item: 'x', request: 'y' }, makeToolContext());
    expect(assertNoClaim(refused, 'refused')).toMatch(SHAPE);
  });

  it('every error code, from all three tools — a plain sentence, never the engine’s message', async () => {
    const codes: DecisionErrorCode[] = ['no-provider', 'unsupported', 'timeout', 'provider-error', 'invalid-answer', 'cancelled', 'invalid-request'];
    for (const code of codes) {
      decide.mockImplementation(async () => {
        throw new DecisionError(code, 'p=0.97 (97 %) — the decider is sure it is a match, confident and certain');
      });
      const steps: Array<() => Promise<AgentToolResult>> = [
        () => decideTool.handler({ state: 's', type: 'noul', instructions: 'q' }, makeToolContext()),
        () => checkMatchesRequestTool.handler({ item: 'x', request: 'y' }, makeToolContext()),
        () => routeRequestTool.handler({ request: 'y', options: T2_OPTIONS }, makeToolContext()),
      ];
      for (const step of steps) {
        const out = await step();
        expect(out.isError, code).toBe(true);
        assertNoClaim(out, code);
      }
    }
    const invalid = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: 'one: only' }, makeToolContext());
    assertNoClaim(invalid, 'too few options');
  });

  it('the three tool descriptions make no claim either', () => {
    for (const tool of [decideTool, checkMatchesRequestTool, routeRequestTool]) {
      for (const banned of NO_CLAIM) expect(tool.description, `${tool.id}: ${banned}`).not.toMatch(banned);
      expect(tool.description, tool.id).toMatch(/escalate/);
    }
  });
});
