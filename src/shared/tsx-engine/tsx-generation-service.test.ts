import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LlmGenerateRequest, LlmGenerateResponse, TsxValidateResponse } from '../ipc/types';
import type { TsxEngineDeps } from './tsx-generation-service';
import { generateTsxPipeline, editTsxPipeline, generateProjectName } from './tsx-generation-service';

const CODE = 'import React from "react";\nexport default function Anim() { return null; }';
const FENCED = '```tsx\n' + CODE + '\n```';

function ok(text: string): LlmGenerateResponse {
  return { success: true, text, model: 'test-model', durationMs: 1, usage: { inputTokens: 5, outputTokens: 7 } };
}

interface FakeDeps extends TsxEngineDeps {
  calls: LlmGenerateRequest[];
  validateCalls: string[];
}

function makeDeps(overrides?: {
  llm?: (req: LlmGenerateRequest, call: number) => LlmGenerateResponse | Promise<LlmGenerateResponse>;
  validate?: (code: string, call: number) => TsxValidateResponse;
}): FakeDeps {
  const calls: LlmGenerateRequest[] = [];
  const validateCalls: string[] = [];
  return {
    calls,
    validateCalls,
    llmGenerate: async (req) => {
      calls.push(req);
      return overrides?.llm ? overrides.llm(req, calls.length) : ok(FENCED);
    },
    tsxValidate: async (req) => {
      validateCalls.push(req.code);
      return overrides?.validate ? overrides.validate(req.code, validateCalls.length) : { success: true };
    },
  };
}

const BASE_OPTIONS = { prompt: 'a bouncing ball', mode: '2d' as const, optimize: false };

describe('generateTsxPipeline', () => {
  it('extracts fenced code, verifies, and validates on the happy path', async () => {
    const deps = makeDeps();
    const result = await generateTsxPipeline(BASE_OPTIONS, deps);

    expect(result.text).toBe(CODE);
    expect(result.verified).toBe(true);
    expect(result.transpileValid).toBe(true);
    expect(result.fixAttempts).toBe(0);
    // mode forced + optimize off → no classify/plan call: generate + verify
    expect(deps.calls).toHaveLength(2);
    // all steps share one session scope for prompt-cache continuity
    const scopes = new Set(deps.calls.map((c) => c.sessionScope));
    expect(scopes.size).toBe(1);
    expect([...scopes][0]).toMatch(/^creator:pipeline:/);
  });

  it('reports verified: false when the verify step fails, keeping generated code', async () => {
    const deps = makeDeps({
      llm: (req) => {
        if (req.systemPrompt?.includes('Review') || req.prompt.startsWith('Review and fix')) {
          return { success: false, error: 'Rate limit reached. Please wait and try again.' };
        }
        return ok(FENCED);
      },
    });
    const result = await generateTsxPipeline(BASE_OPTIONS, deps);

    expect(result.verified).toBe(false);
    expect(result.text).toBe(CODE);
    expect(result.transpileValid).toBe(true);
  });

  it('runs the fix loop when validation fails, then succeeds', async () => {
    const fixed = CODE.replace('Anim', 'AnimFixed');
    const deps = makeDeps({
      llm: (req) => (req.prompt.includes('## Transpile Error') ? ok('```tsx\n' + fixed + '\n```') : ok(FENCED)),
      validate: (code) => (code.includes('AnimFixed')
        ? { success: true }
        : { success: false, error: 'Unexpected token', errorLocation: { line: 2, column: 1, file: 'validate.tsx' } }),
    });
    const result = await generateTsxPipeline({ ...BASE_OPTIONS, maxFixRetries: 3 }, deps);

    expect(result.fixAttempts).toBe(1);
    expect(result.transpileValid).toBe(true);
    expect(result.text).toBe(fixed);
  });

  it('returns transpileValid: false after exhausting fix retries', async () => {
    const deps = makeDeps({
      validate: () => ({ success: false, error: 'always broken' }),
    });
    const result = await generateTsxPipeline({ ...BASE_OPTIONS, maxFixRetries: 2 }, deps);

    expect(result.transpileValid).toBe(false);
    expect(result.fixAttempts).toBe(2);
  });

  it('throws when the generate step fails with a non-transient error', async () => {
    const deps = makeDeps({
      llm: () => ({ success: false, error: 'Invalid API key or expired session. Check your settings.' }),
    });
    await expect(generateTsxPipeline(BASE_OPTIONS, deps)).rejects.toThrow('Invalid API key');
    // No blind retries on a hard failure
    expect(deps.calls).toHaveLength(1);
  });

  it('retries the generate step on transient errors with backoff', async () => {
    vi.useFakeTimers();
    try {
      let generateAttempts = 0;
      const deps = makeDeps({
        llm: (req) => {
          if (req.prompt.startsWith('Review and fix')) return ok(FENCED);
          generateAttempts++;
          if (generateAttempts < 3) return { success: false, error: 'Rate limit reached. Please wait and try again.' };
          return ok(FENCED);
        },
      });
      const promise = generateTsxPipeline(BASE_OPTIONS, deps);
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await promise;

      expect(generateAttempts).toBe(3);
      expect(result.text).toBe(CODE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry when the user cancelled', async () => {
    let generateAttempts = 0;
    const deps = makeDeps({
      llm: (req) => {
        if (req.prompt.startsWith('Review and fix')) return ok(FENCED);
        generateAttempts++;
        return { success: false, error: 'Request cancelled' };
      },
    });
    await expect(generateTsxPipeline(BASE_OPTIONS, deps)).rejects.toThrow('Request cancelled');
    expect(generateAttempts).toBe(1);
  });
});

describe('editTsxPipeline', () => {
  const EDIT_OPTIONS = { currentCode: CODE, editInstruction: 'make it bigger' };

  it('edits, validates, and never sets verified', async () => {
    const deps = makeDeps();
    const result = await editTsxPipeline(EDIT_OPTIONS, deps);

    expect(result.text).toBe(CODE);
    expect(result.verified).toBe(false);
    expect(result.transpileValid).toBe(true);
    expect(deps.calls[0].prompt).toContain('make it bigger');
    expect(deps.calls[0].prompt).toContain(CODE);
  });

  it('threads chatHistory into the request messages with the edit as final turn', async () => {
    const deps = makeDeps();
    await editTsxPipeline({
      ...EDIT_OPTIONS,
      chatHistory: [
        { role: 'user', content: 'make the ball red' },
        { role: 'assistant', content: 'Applied edit — saved as v2.tsx.' },
      ],
    }, deps);

    const messages = deps.calls[0].messages!;
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('make the ball red');
    expect(messages.at(-1)!.content).toContain('make it bigger');
  });

  it('omits messages entirely when there is no history', async () => {
    const deps = makeDeps();
    await editTsxPipeline(EDIT_OPTIONS, deps);
    expect(deps.calls[0].messages).toBeUndefined();
  });
});

describe('generateProjectName', () => {
  it('kebab-cases and truncates the model output', async () => {
    const deps = makeDeps({ llm: () => ok('  Neon PULSE!! Intro  ') });
    expect(await generateProjectName('x', undefined, deps)).toBe('neon-pulse-intro');
  });

  it('falls back to a timestamped name when the call fails', async () => {
    const deps = makeDeps({ llm: () => ({ success: false, error: 'boom' }) });
    expect(await generateProjectName('x', undefined, deps)).toMatch(/^motion-\d+$/);
  });
});
