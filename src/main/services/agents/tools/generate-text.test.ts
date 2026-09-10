// `generate_text` (flows plan §1.2, decision 12) with a fake `runLlmGenerate`:
// the three model modes, the brand prefix, the field the port reads, and the
// usage source the runner stamped.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToolContext } from './test-context';

const runLlmGenerate = vi.fn();
const getLlmProviders = vi.fn();
const readBrand = vi.fn();

vi.mock('../../../ipc/llm-handlers', () => ({
  runLlmGenerate: (...args: unknown[]) => runLlmGenerate(...args),
}));
vi.mock('../../settings', () => ({ getLlmProviders: () => getLlmProviders() }));
vi.mock('../../library/brand-store', () => ({ readBrand: (...args: unknown[]) => readBrand(...args) }));
vi.mock('../../library/brand-summary', () => ({
  formatBrandSummary: (brand: { name: string }) => `BRAND ${brand.name}`,
}));
vi.mock('../../library/library-paths', () => ({ getLibraryRoot: () => '/lib' }));

const { generateTextTool, extractText } = await import('./generate-text');
const { resolveLlmModelBinding } = await import('./llm-model-binding');

const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', type: 'openai-compat', authMode: 'api-key', apiKey: 'k', defaultModel: 'x', enabled: true },
  { id: 'claude-subscription', name: 'Claude', type: 'agent-sdk', authMode: 'subscription', defaultModel: 'c', enabled: true },
  { id: 'gemini', name: 'Gemini', type: 'gemini', authMode: 'api-key', defaultModel: 'g', enabled: false },
];

beforeEach(() => {
  runLlmGenerate.mockReset();
  getLlmProviders.mockReset();
  readBrand.mockReset();
  getLlmProviders.mockResolvedValue({ providers: PROVIDERS, activeProvider: 'claude-subscription' });
  runLlmGenerate.mockResolvedValue({ success: true, text: 'Two hooks.' });
  readBrand.mockResolvedValue({ id: 'acme', name: 'Acme' });
});

describe('generate_text', () => {
  it('runs on the app default and returns the text on the field the port reads', async () => {
    const res = await generateTextTool.handler(
      { prompt: 'Write two hooks', systemPrompt: 'Be brief' },
      makeToolContext({ featureSource: 'flows' }),
    );
    expect(res.isError).toBeUndefined();
    expect(res.fields).toEqual({ text: 'Two hooks.' });
    expect(res.content[0].text).toBe('Two hooks.');
    const [req, , , extras] = runLlmGenerate.mock.calls[0] as [Record<string, unknown>, unknown, unknown, unknown];
    expect(req).toMatchObject({ prompt: 'Write two hooks', systemPrompt: 'Be brief', featureSource: 'flows' });
    expect(req.providerId).toBeUndefined();
    expect(extras).toBeUndefined();
  });

  it('as an agent tool it attributes to the agent and inherits the session provider', async () => {
    await generateTextTool.handler(
      { prompt: 'hi' },
      makeToolContext({ agentId: 'vidtsx/motion-post', providerId: 'openrouter' }),
    );
    const [req, , , extras] = runLlmGenerate.mock.calls[0] as [Record<string, unknown>, unknown, unknown, unknown];
    expect(req).toMatchObject({ providerId: 'openrouter', featureSource: 'agent' });
    expect(extras).toEqual({ agentId: 'vidtsx/motion-post' });
  });

  it('required: refuses clearly when the provider is not usable, and pins it when it is', async () => {
    const refused = await generateTextTool.handler(
      { prompt: 'hi', providerId: 'gemini', model: 'gemini-pro', modelMode: 'required' },
      makeToolContext(),
    );
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain('gemini-pro on gemini');
    expect(runLlmGenerate).not.toHaveBeenCalled();

    const ok = await generateTextTool.handler(
      { prompt: 'hi', providerId: 'openrouter', model: 'anthropic/claude-fable-5.1', modelMode: 'required' },
      makeToolContext(),
    );
    expect(ok.isError).toBeUndefined();
    expect(runLlmGenerate.mock.calls[0][0]).toMatchObject({
      providerId: 'openrouter',
      model: 'anthropic/claude-fable-5.1',
    });
  });

  it('preferred: falls back to the app default and says so in the run log', async () => {
    const notes: string[] = [];
    const res = await generateTextTool.handler(
      { prompt: 'hi', providerId: 'gemini', model: 'gemini-pro', modelMode: 'preferred' },
      makeToolContext({ emitProgress: (d) => notes.push(d), providerId: 'openrouter' }),
    );
    expect(res.isError).toBeUndefined();
    expect(notes[0]).toContain('Preferred model gemini-pro on gemini is unavailable');
    const req = runLlmGenerate.mock.calls[0][0] as Record<string, unknown>;
    expect(req.providerId).toBeUndefined();
    expect(req.model).toBeUndefined();
  });

  it('useBrand prepends the brand summary before the system prompt', async () => {
    await generateTextTool.handler(
      { prompt: 'hi', systemPrompt: 'Be brief', useBrand: 'on' },
      makeToolContext({ brandId: 'acme' }),
    );
    expect(runLlmGenerate.mock.calls[0][0]).toMatchObject({ systemPrompt: 'BRAND Acme\n\nBe brief' });
    // No brand on the run: the system prompt stands alone.
    await generateTextTool.handler({ prompt: 'hi', systemPrompt: 'Be brief', useBrand: true }, makeToolContext());
    expect(runLlmGenerate.mock.calls[1][0]).toMatchObject({ systemPrompt: 'Be brief' });
  });

  it('reports a failed generation as an error result', async () => {
    runLlmGenerate.mockResolvedValue({ success: false, error: 'rate limited' });
    const res = await generateTextTool.handler({ prompt: 'hi' }, makeToolContext());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('rate limited');
  });
});

describe('resolveLlmModelBinding', () => {
  const deps = { usableProviderIds: async () => ['openrouter'] };
  it('default ignores the binding; required without a provider refuses', async () => {
    expect(await resolveLlmModelBinding({ providerId: 'gemini', modelMode: 'default' }, deps)).toEqual({ ok: true });
    expect((await resolveLlmModelBinding({ modelMode: 'required' }, deps)).ok).toBe(false);
  });
  it('preferred keeps a usable provider and notes an unusable one', async () => {
    expect(await resolveLlmModelBinding({ providerId: 'openrouter', model: 'm', modelMode: 'preferred' }, deps)).toEqual({
      ok: true,
      providerId: 'openrouter',
      model: 'm',
    });
    const fallback = await resolveLlmModelBinding({ providerId: 'gemini', modelMode: 'preferred' }, deps);
    expect(fallback).toMatchObject({ ok: true, note: expect.stringContaining('gemini') });
  });
});

describe('generate_text as a node (W8 Stage 3): prefix and extract', () => {
  it('puts the prefix before the port text and returns the first item of a JSON-array reply', async () => {
    runLlmGenerate.mockResolvedValue({ success: true, text: '```json\n["a bold fox", "a quiet fox"]\n```' });
    const res = await generateTextTool.handler(
      { prompt: 'foxes', promptPrefix: 'Generate 1 prompt for:', extract: 'first-json-item' },
      makeToolContext({ featureSource: 'flows' }),
    );
    expect((runLlmGenerate.mock.calls[0][0] as { prompt: string }).prompt).toBe('Generate 1 prompt for:\n\nfoxes');
    expect(res.fields).toEqual({ text: 'a bold fox' });
    expect(res.content[0].text).toBe('a bold fox');
  });

  it('strip-fences drops the fences, none keeps the reply, a non-array reply passes through first-json-item', () => {
    expect(extractText('```\nline one\nline two\n```', 'strip-fences')).toBe('line one\nline two');
    expect(extractText('plain', 'none')).toBe('plain');
    expect(extractText('not json [', 'first-json-item')).toBe('not json [');
    expect(extractText('Here: ["", "  second  "] done', 'first-json-item')).toBe('second');
  });
});
