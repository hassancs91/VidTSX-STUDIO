import { describe, expect, it } from 'vitest';
import { SystemOneProvider, type SystemOneFetch } from './system-one-provider';
import recordedBodies from './fixtures/system-one-recorded-bodies.json';
import d1Scored from './fixtures/d1-scored-t2-t3.json';
import dryRunSlice from './fixtures/system-one-dry-run-slice.json';
import type { DecisionQuestion, DecisionRequest } from '../types';

// D4 (b) — the System One adapter against D1's RECORDED live responses (D2 §5.1, §15.1 "Shape"). The fixtures are scrubbed, compact copies
// of `C:\Users\hasan\AppData\Local\vidtsx-e2e\decisions\D1\hosted-responses\{jev,openrouter-msd1}-{t2-choice,t3-noul}-001.json` (model +
// answers + usage; the generation id and upstream provider dropped) and of the four answer files D1 scored
// (`.vidtsx-temp\decisions\D1\answers\hosted-{jev,openrouter-msd1}-{t2-choice,t3-noul}.json`); the dry-run slice is three rows per task of
// D1's request bodies (`D1\hosted-dryrun\jev-t{2,3}-*.first-body.json`). No key anywhere; the tests use a FAKE one.

const FAKE_KEY = 'sk-or-v1-FAKE-0000000000000000000000000000';
type RecordedName = 'jev-t2' | 'jev-t3' | 'msd1-t2' | 'msd1-t3';
interface Scored {
  model: string;
  usage: { input_tokens: number; cost?: number };
  probs?: Record<string, Record<string, number>>;
  pTrue?: Record<string, number>;
}
interface RecordedBody {
  model: string;
  answers: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number; cost?: number };
}
const BODIES = recordedBodies as unknown as Record<RecordedName, RecordedBody>;
const SCORED = d1Scored as unknown as Record<RecordedName, Scored>;
const DRY = dryRunSlice as unknown as Record<'t2' | 't3', { model: string; state: string; questions: Record<string, DecisionQuestion> }>;

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function replay(text: string, status = 200): { fetch: SystemOneFetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetch: SystemOneFetch = async (url, init) => {
    sent.push({ url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> });
    return { ok: status >= 200 && status < 300, status, text: async () => text };
  };
  return { fetch, sent };
}

const JEV = { id: 'jev' as const, baseURL: 'https://api.typesafe.ai/v1/systemone', model: 'jev-1.14.0' };
const MSD1 = { id: 'openrouter-decisions' as const, baseURL: 'https://openrouter.ai/api/alpha/decisions', model: 'microsoft/microsoft-decision-1' };

/** The request whose questions the recorded body answers: D1's key per row (`t2-01` → `t2_01`, D1's `safe()`), D1's criteria. */
function requestFor(name: RecordedName): DecisionRequest {
  const t2 = name.endsWith('t2');
  const criteria = Object.values(DRY.t2.questions)[0];
  const keys = Object.keys(BODIES[name].answers);
  const questions: Record<string, DecisionQuestion> = Object.fromEntries(
    keys.map((k): [string, DecisionQuestion] => [
      k,
      t2 && criteria.type === 'choice'
        ? { type: 'choice', instructions: `row ${k}`, criteria: criteria.criteria }
        : { type: 'noul', instructions: `row ${k}`, criteria: { true: 'Yes', false: 'No' } },
    ]),
  );
  return { state: t2 ? DRY.t2.state : DRY.t3.state, questions, featureSource: 'flows', family: t2 ? 'routing' : 'verify' };
}

const argmax = (probs: Record<string, number>): string => Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0];

describe.each<[RecordedName, typeof JEV | typeof MSD1]>([
  ['jev-t2', JEV],
  ['jev-t3', JEV],
  ['msd1-t2', MSD1],
  ['msd1-t3', MSD1],
])('recorded body %s → exactly what D1 scored', (name, preset) => {
  it('maps every row (choice + probabilities to 4 dp | noul p), the served model and the usage', async () => {
    const { fetch } = replay(JSON.stringify(BODIES[name]));
    const provider = new SystemOneProvider({ ...preset, apiKey: FAKE_KEY, fetch, retryDelayMs: () => 0 });
    const out = await provider.decide(requestFor(name), new AbortController().signal);
    const scored = SCORED[name];

    expect(out.model).toBe(scored.model);
    expect(out.usage.inputTokens).toBe(scored.usage.input_tokens);
    expect(Object.keys(out.answers)).toHaveLength(40);
    if (scored.probs) {
      for (const [id, probs] of Object.entries(scored.probs)) {
        const answer = out.answers[id.replace(/[^A-Za-z0-9_]/g, '_')];
        if (answer?.type !== 'choice') throw new Error(`${id}: not a choice answer`);
        expect(answer.choice).toBe(argmax(probs));
        expect(Object.keys(answer.probabilities).sort()).toEqual(Object.keys(probs).sort());
        for (const [option, p] of Object.entries(probs)) expect(answer.probabilities[option]).toBeCloseTo(p, 4);
        expect(answer.confidence).toBeGreaterThan(0);
        expect(answer.confidence).toBeLessThanOrEqual(1);
      }
    } else {
      for (const [id, p] of Object.entries(scored.pTrue ?? {})) {
        const answer = out.answers[id.replace(/[^A-Za-z0-9_]/g, '_')];
        if (answer?.type !== 'noul') throw new Error(`${id}: not a noul answer`);
        expect(answer.p).toBeCloseTo(p, 4);
      }
    }
  });
});

describe('usage (D2 §9)', () => {
  it("OpenRouter's usage.cost is read as the provider-reported cost", async () => {
    for (const name of ['msd1-t2', 'msd1-t3'] as const) {
      const { fetch } = replay(JSON.stringify(BODIES[name]));
      const out = await new SystemOneProvider({ ...MSD1, apiKey: FAKE_KEY, fetch }).decide(requestFor(name), new AbortController().signal);
      expect(out.usage.costUsd).toBe(SCORED[name].usage.cost);
      expect(out.calls).toEqual([{ model: SCORED[name].model, inputTokens: SCORED[name].usage.input_tokens, costUsd: SCORED[name].usage.cost, durationMs: expect.any(Number) }]);
    }
  });

  it('Jev (no reported cost): input tokens × $0.042 / M', async () => {
    const { fetch } = replay(JSON.stringify(BODIES['jev-t2']));
    const out = await new SystemOneProvider({ ...JEV, apiKey: FAKE_KEY, fetch }).decide(requestFor('jev-t2'), new AbortController().signal);
    expect(out.usage.costUsd).toBeCloseTo((10_858 * 0.042) / 1_000_000, 12);
  });
});

describe('the request body (D-r16 (a): a transport)', () => {
  it("sends D1's dry-run state + keyed questions unchanged, POST with a Bearer key", async () => {
    for (const task of ['t2', 't3'] as const) {
      for (const preset of [JEV, MSD1]) {
        const { fetch, sent } = replay(JSON.stringify({ model: preset.model, answers: {}, usage: { input_tokens: 1 } }));
        const provider = new SystemOneProvider({ ...preset, apiKey: FAKE_KEY, fetch });
        const request: DecisionRequest = { state: DRY[task].state, questions: DRY[task].questions, featureSource: 'flows' };
        await provider.decide(request, new AbortController().signal).catch(() => undefined); // empty answers → invalid-answer; the body is what counts
        expect(sent).toHaveLength(1);
        expect(sent[0].url).toBe(preset.baseURL);
        expect(sent[0].headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
        expect(sent[0].headers['Content-Type']).toBe('application/json');
        expect(sent[0].body).toEqual({ model: preset.model, state: DRY[task].state, questions: DRY[task].questions });
      }
    }
  });

  it("fills OpenRouter's required noul criteria only when the caller omitted it; Jev's body is untouched", async () => {
    const questions: Record<string, DecisionQuestion> = {
      bare: { type: 'noul', instructions: 'Is it a match?' },
      framed: { type: 'noul', instructions: 'Is it a match?', criteria: { true: 'Yes: it is', false: 'No: it is not' } },
    };
    const request: DecisionRequest = { state: 'rule', questions, featureSource: 'flows' };
    const reply = JSON.stringify({ model: 'm', answers: { bare: { type: 'noul', noul: 0.5 }, framed: { type: 'noul', noul: 0.5 } }, usage: { input_tokens: 3 } });

    const msd1 = replay(reply);
    await new SystemOneProvider({ ...MSD1, apiKey: FAKE_KEY, fetch: msd1.fetch }).decide(request, new AbortController().signal);
    expect(msd1.sent[0].body.questions).toEqual({ bare: { ...questions.bare, criteria: { true: 'yes', false: 'no' } }, framed: questions.framed });

    const jev = replay(reply);
    await new SystemOneProvider({ ...JEV, apiKey: FAKE_KEY, fetch: jev.fetch }).decide(request, new AbortController().signal);
    expect(jev.sent[0].body.questions).toEqual(questions);
    expect(questions.bare).toEqual({ type: 'noul', instructions: 'Is it a match?' }); // the caller's object is not mutated
  });
});
