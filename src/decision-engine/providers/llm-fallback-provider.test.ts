import { describe, expect, it } from 'vitest';
import { LlmFallbackProvider, type LlmFallbackGenerate, type LlmFallbackGenerateRequest } from './llm-fallback-provider';
import { DecisionError, type DecisionErrorCode, type DecisionRequest } from '../types';

// D4 (b) — the LLM fallback (D2 §5.4): the app's text provider (`llmEngine.generate`, injected) answers JSON; strict parse; any missing /
// extra key or a cut text → invalid-answer (P11); the chosen answer gets probability 1.0; never calibrated (the engine's table says so).

const STATE = 'PRIVATE STATE: the script line the text model must judge';

const REQUEST: DecisionRequest = {
  state: STATE,
  questions: {
    route: { type: 'choice', instructions: 'Which ONE tool family must act on this request?', criteria: { cut: 'remove parts', audio: 'add sound', none: 'no tool' } },
    match: { type: 'noul', instructions: 'Does the clip do what the request asks?' },
    level: { type: 'score', instructions: 'How urgent is it?', criteria: ['low', 'medium', 'high'] },
  },
  featureSource: 'flows',
};

function llm(text: string): { generate: LlmFallbackGenerate; seen: LlmFallbackGenerateRequest[] } {
  const seen: LlmFallbackGenerateRequest[] = [];
  const generate: LlmFallbackGenerate = async (req) => {
    seen.push(req);
    return { text, model: 'claude-sonnet-5-5', usage: { inputTokens: 321, costUsd: 0.0012 } };
  };
  return { generate, seen };
}

async function failure(promise: Promise<unknown>, code: DecisionErrorCode): Promise<DecisionError> {
  let err: unknown;
  try {
    await promise;
  } catch (e) {
    err = e;
  }
  if (!(err instanceof DecisionError)) throw new Error(`expected a DecisionError, got ${String(err)}`);
  expect(err.code).toBe(code);
  expect(err.provider).toBe('llm');
  expect(err.message).not.toContain('PRIVATE STATE');
  return err;
}

const signal = (): AbortSignal => new AbortController().signal;

describe('LlmFallbackProvider', () => {
  it('is the llm rung, ready by default, with the ceiling limits', async () => {
    const p = new LlmFallbackProvider({ generate: llm('{}').generate });
    expect(p.id).toBe('llm');
    expect(await p.checkReady()).toEqual({ ready: true });
    expect(p.limits().maxOptions).toBe(255);
    const off = new LlmFallbackProvider({ generate: llm('{}').generate, isReady: async () => false });
    expect(await off.checkReady()).toEqual({ ready: false, reason: 'no text provider' });
  });

  it('one prompt listing every question and its allowed answers; the state once; the signal passed on', async () => {
    const { generate, seen } = llm('{"route":"cut","match":true,"level":"high"}');
    const s = signal();
    await new LlmFallbackProvider({ generate }).decide(REQUEST, s);
    expect(seen).toHaveLength(1);
    const prompt = `${seen[0].systemPrompt ?? ''}\n${seen[0].prompt}`;
    expect(prompt.split(STATE)).toHaveLength(2);
    for (const text of ['route', 'cut', 'audio', 'none', 'match', 'true', 'false', 'level', 'low', 'medium', 'high']) expect(prompt).toContain(text);
    expect(seen[0].signal).toBe(s);
  });

  it('maps the JSON to answers with the chosen answer at probability 1.0', async () => {
    const out = await new LlmFallbackProvider({ generate: llm('{"route":"audio","match":false,"level":"medium"}').generate }).decide(REQUEST, signal());
    expect(out.answers).toEqual({
      route: { type: 'choice', choice: 'audio', probabilities: { cut: 0, audio: 1, none: 0 }, confidence: 1 },
      match: { type: 'noul', p: 0 },
      level: { type: 'score', score: 1, probabilities: { low: 0, medium: 1, high: 0 }, confidence: 1 },
    });
    expect(out.model).toBe('claude-sonnet-5-5');
    expect(out.usage).toEqual({ inputTokens: 321, costUsd: 0.0012 });
  });

  it('accepts one fenced JSON object (```json … ```), nothing looser', async () => {
    const fenced = '```json\n{"route":"cut","match":true,"level":"low"}\n```';
    const out = await new LlmFallbackProvider({ generate: llm(fenced).generate }).decide(REQUEST, signal());
    expect(out.answers.match).toEqual({ type: 'noul', p: 1 });
    await failure(new LlmFallbackProvider({ generate: llm('Sure! {"route":"cut","match":true,"level":"low"}').generate }).decide(REQUEST, signal()), 'invalid-answer');
  });

  it('a cut text, a missing key, an extra key or an off-list answer → invalid-answer', async () => {
    for (const text of [
      '{"route":"cut","match":tr',
      '{"route":"cut","match":true}',
      '{"route":"cut","match":true,"level":"low","extra":1}',
      '{"route":"render","match":true,"level":"low"}',
      '{"route":"cut","match":"maybe","level":"low"}',
      '{"route":"cut","match":true,"level":"extreme"}',
      '[]',
      '',
    ]) {
      await failure(new LlmFallbackProvider({ generate: llm(text).generate }).decide(REQUEST, signal()), 'invalid-answer');
    }
  });

  it('a text-provider failure is a provider-error scrubbed of the state; an abort is cancelled', async () => {
    const throwing: LlmFallbackGenerate = async () => {
      throw new Error(`model overloaded while reading ${STATE}`);
    };
    await failure(new LlmFallbackProvider({ generate: throwing }).decide(REQUEST, signal()), 'provider-error');
    const controller = new AbortController();
    controller.abort();
    await failure(new LlmFallbackProvider({ generate: llm('{}').generate }).decide(REQUEST, controller.signal), 'cancelled');
  });
});
