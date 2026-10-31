// `decide` (DECISION_MODELS_DESIGN.md §10.1, §11) through a mocked decisions runtime — no network. What it sends (the caller's framing,
// D-r16 (d)), the band of ruling D-r18 (the TOP probability, never `confidence`), the uncalibrated path, the plain error sentences, the
// featureSource per caller (agent vs flow), and the node's ports as the flow runner reads them (`p` in the run record, the band first).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { DecisionAnswer, DecisionRequest, DecisionResult } from '../../../../shared/types/decisions';
import { DecisionError } from '../../../../decision-engine';
import { mapOutputs } from '../../flows/flow-args';
import { makeToolContext } from './test-context';

const decide = vi.fn<(request: DecisionRequest, options: { signal?: AbortSignal }) => Promise<DecisionResult>>();
vi.mock('../../decisions/decision-runtime', () => ({
  getDecisionRuntime: () => ({ decide: (request: DecisionRequest, options: { signal?: AbortSignal }) => decide(request, options) }),
}));

const { decideTool } = await import('./decide');

function result(answer: DecisionAnswer, calibrated = true): DecisionResult {
  return {
    answers: { decision: answer },
    provider: 'jev',
    model: 'jev-1.14.0',
    calibrated,
    usage: { inputTokens: 120, costUsd: 0.000005 },
    latencyMs: 300,
    cached: false,
  };
}
const choice = (pick: string, p: number, confidence = p): DecisionAnswer => ({
  type: 'choice',
  choice: pick,
  probabilities: { billing: pick === 'billing' ? p : 1 - p, support: pick === 'billing' ? 1 - p : p },
  confidence,
});
const TEAMS = { billing: 'a payment or invoice question', support: 'a bug or a crash' };
const text = (r: { content: Array<{ text: string }> }) => r.content.map((c) => c.text).join('\n');

beforeEach(() => {
  decide.mockReset();
  decide.mockResolvedValue(result(choice('billing', 0.95)));
});

describe('decide — what it sends (the caller frames, D-r16 (d))', () => {
  it('one question keyed `decision`, auto, family other, no uncalibrated fallback, featureSource decision-agent in an agent run', async () => {
    const ctx = makeToolContext({ featureSource: 'agent' });
    await decideTool.handler({ state: 'Invoice 4411 was charged twice.', type: 'choice', instructions: 'Which team?', options: TEAMS }, ctx);
    expect(decide).toHaveBeenCalledTimes(1);
    const [request, options] = decide.mock.calls[0];
    expect(request).toEqual({
      state: 'Invoice 4411 was charged twice.',
      questions: { decision: { type: 'choice', instructions: 'Which team?', criteria: TEAMS } },
      provider: 'auto',
      featureSource: 'decision-agent',
      allowUncalibrated: false,
      family: 'other',
    });
    expect(options.signal).toBe(ctx.signal);
  });

  it('a context without a featureSource is an agent call', async () => {
    await decideTool.handler({ state: 's', type: 'choice', instructions: 'Which team?', options: TEAMS }, makeToolContext());
    expect(decide.mock.calls[0][0].featureSource).toBe('decision-agent');
  });

  it('in a flow run: featureSource decision-flow; the canvas options (one `id: description` per line), the toggles and the pin', async () => {
    const ctx = makeToolContext({ featureSource: 'flows' });
    const options = 'billing: a payment or invoice question\n\n  support :  a bug or a crash  \n';
    await decideTool.handler(
      { state: 's', type: 'choice', instructions: 'Which team?', options, family: 'routing', provider: 'jev', allowUncalibrated: 'on' },
      ctx,
    );
    expect(decide.mock.calls[0][0]).toMatchObject({
      questions: { decision: { type: 'choice', criteria: TEAMS } },
      provider: 'jev',
      featureSource: 'decision-flow',
      allowUncalibrated: true,
      family: 'routing',
    });
  });

  it('a noul question goes out without criteria (the adapter adds OpenRouter’s own) and ignores options', async () => {
    decide.mockResolvedValue(result({ type: 'noul', p: 0.97 }));
    await decideTool.handler({ state: 's', type: 'noul', instructions: 'Is it a refund?', options: TEAMS, allowUncalibrated: 'off' }, makeToolContext());
    expect(decide.mock.calls[0][0].questions).toEqual({ decision: { type: 'noul', instructions: 'Is it a refund?' } });
    expect(decide.mock.calls[0][0].allowUncalibrated).toBe(false);
  });

  it('a choice with fewer than two options is refused before any call, in a plain sentence with no number', async () => {
    for (const options of [undefined, 'billing: a payment', { billing: 'a payment' }, 'billing: a\nbilling: b']) {
      const out = await decideTool.handler({ state: 's', type: 'choice', instructions: 'Which team?', options }, makeToolContext());
      expect(out.isError).toBe(true);
      expect(text(out)).not.toMatch(/\d/);
      expect(text(out)).toMatch(/option/);
    }
    expect(decide).not.toHaveBeenCalled();
  });
});

describe('decide — the band (D-r18: the top probability, never `confidence`)', () => {
  it('choice: act iff probabilities[choice] ≥ threshold AND calibrated', async () => {
    const act = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS }, makeToolContext());
    expect(text(act)).toBe('Decision: billing (act)');
    expect(act.fields).toEqual({ band: 'act', answer: 'billing', p: 0.95 });

    decide.mockResolvedValue(result(choice('billing', 0.85, 0.99))); // confidence over the bar, the top probability under it
    const esc = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS }, makeToolContext());
    expect(text(esc)).toBe('Decision: uncertain — top answer billing (escalate)');
    expect(esc.fields).toEqual({ band: 'escalate', answer: 'billing', p: 0.85 });
  });

  it('noul: the answer is yes iff p ≥ 0.5 and the band reads max(p, 1 − p)', async () => {
    const cases: Array<[number, string, string, number]> = [
      [0.97, 'yes', 'act', 0.97],
      [0.03, 'no', 'act', 0.97],
      [0.5, 'yes', 'escalate', 0.5],
      [0.2, 'no', 'escalate', 0.8],
    ];
    for (const [p, answer, band, top] of cases) {
      decide.mockResolvedValue(result({ type: 'noul', p }));
      const out = await decideTool.handler({ state: 's', type: 'noul', instructions: 'q' }, makeToolContext());
      expect(out.fields?.answer, String(p)).toBe(answer);
      expect(out.fields?.band, String(p)).toBe(band);
      expect(out.fields?.p, String(p)).toBeCloseTo(top, 10);
    }
  });

  it('the threshold is the caller’s (default 0.9)', async () => {
    decide.mockResolvedValue(result(choice('support', 0.6)));
    const low = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS, threshold: 0.55 }, makeToolContext());
    expect(low.fields?.band).toBe('act');
    const dflt = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS }, makeToolContext());
    expect(dflt.fields?.band).toBe('escalate');
  });

  it('an uncalibrated answer escalates; allowUncalibrated lets it act with the note, still under the threshold', async () => {
    decide.mockResolvedValue(result(choice('billing', 0.99), false));
    const off = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS }, makeToolContext());
    expect(text(off)).toBe('Decision: uncertain — top answer billing (escalate)');
    expect(off.fields?.band).toBe('escalate');

    const progress: string[] = [];
    const on = await decideTool.handler(
      { state: 's', type: 'choice', instructions: 'q', options: TEAMS, allowUncalibrated: true },
      makeToolContext({ emitProgress: (d) => progress.push(d) }),
    );
    expect(text(on)).toBe('Decision: billing (act — uncalibrated)');
    expect(on.fields).toEqual({ band: 'act', answer: 'billing', p: 0.99, note: 'uncalibrated' });
    expect(progress.join(' ')).toMatch(/uncalibrated/);

    decide.mockResolvedValue(result(choice('billing', 0.7), false));
    const under = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS, allowUncalibrated: true }, makeToolContext());
    expect(under.fields?.band).toBe('escalate');
  });

  it('a refused answer escalates with no answer and no p', async () => {
    decide.mockResolvedValue(result({ type: 'refused', reason: 'policy' }));
    const out = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS }, makeToolContext());
    expect(text(out)).toBe('Decision: uncertain — no answer (escalate)');
    expect(out.fields).toEqual({ band: 'escalate', answer: '' });
    expect(out.isError).toBeUndefined();
  });
});

describe('decide — errors are plain sentences (no number, never the engine’s message)', () => {
  const CODES = ['no-provider', 'unsupported', 'timeout', 'provider-error', 'invalid-answer', 'cancelled', 'invalid-request'] as const;

  it('every DecisionError code, and a plain throw', async () => {
    const seen = new Set<string>();
    for (const code of CODES) {
      decide.mockRejectedValue(new DecisionError(code, `HTTP 500 after 15000 ms (Bearer sk-test-FAKE-decide-0041) state=Invoice 4411`, 'jev'));
      const out = await decideTool.handler({ state: 'Invoice 4411', type: 'noul', instructions: 'q' }, makeToolContext());
      expect(out.isError, code).toBe(true);
      expect(out.fields, code).toBeUndefined();
      expect(text(out), code).not.toMatch(/\d|FAKE|Bearer|Invoice|HTTP/);
      expect(text(out), code).toMatch(/^[A-Z][^\n]*\.$/);
      seen.add(text(out));
    }
    expect(seen.size).toBe(CODES.length);
    decide.mockRejectedValue(new Error('socket hang up 127.0.0.1:9'));
    const plain = await decideTool.handler({ state: 's', type: 'noul', instructions: 'q' }, makeToolContext());
    decide.mockRejectedValue(new DecisionError('provider-error', 'x'));
    const typed = await decideTool.handler({ state: 's', type: 'noul', instructions: 'q' }, makeToolContext());
    expect(text(plain)).toBe(text(typed));
  });
});

describe('decide — the node (a tool with ports, §11)', () => {
  it('state in; band first (what the canvas previews), answer, and p as a number the run record keeps', () => {
    const ports = decideTool.ports;
    if (!ports) throw new Error('decide has no ports');
    expect(ports.inputs).toEqual([expect.objectContaining({ id: 'state', dataType: 'text', required: true, argKey: 'state' })]);
    expect(ports.outputs.map((o) => [o.id, o.dataType, o.from])).toEqual([
      ['band', 'text', 'field:band'],
      ['answer', 'text', 'field:answer'],
      ['p', 'number', 'field:p'],
    ]);
    expect(ports.configSchema.map((f) => f.key)).toEqual(['type', 'instructions', 'options', 'threshold', 'provider', 'family', 'allowUncalibrated']);
    const provider = ports.configSchema.find((f) => f.key === 'provider');
    expect(provider?.kind === 'select' ? provider.options.map((o) => o.value) : []).toEqual(['auto', 'jev', 'openrouter-decisions', 'llm']);
    expect(ports.defaultConfig).toMatchObject({ type: 'choice', threshold: 0.9, provider: 'auto', family: 'other', allowUncalibrated: 'off' });
    expect(z.object(decideTool.schema).partial().safeParse(ports.defaultConfig).success).toBe(true);
  });

  it('the flow runner maps the result: band + answer as text, p as a number; the agent text never carries p', async () => {
    decide.mockResolvedValue(result(choice('billing', 0.9731)));
    const out = await decideTool.handler({ state: 's', type: 'choice', instructions: 'q', options: TEAMS }, makeToolContext({ featureSource: 'flows' }));
    const ports = decideTool.ports;
    if (!ports) throw new Error('decide has no ports');
    expect(mapOutputs(ports, out, null)).toEqual({
      band: { kind: 'text', value: 'act' },
      answer: { kind: 'text', value: 'billing' },
      p: { kind: 'number', value: 0.9731 },
    });
    expect(text(out)).not.toMatch(/0\.9|97/);
  });

  it('tells the model to ask the user or gather evidence on escalate', () => {
    expect(decideTool.description).toMatch(/escalate/);
    expect(decideTool.description).toMatch(/ask the user/i);
    expect(decideTool.description).toMatch(/evidence/i);
  });
});
