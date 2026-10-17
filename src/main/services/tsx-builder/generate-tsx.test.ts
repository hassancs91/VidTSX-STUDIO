import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'os';

// The dispatcher with the builder faked (P3 part 8: the builder, or a
// refusal): what the builder receives, how its outcome becomes the one
// result shape, and who is refused before anything runs (no tools; an
// OpenRouter model the builder cannot use).

const resolveToolSupport = vi.fn();
const resolveProviderInfo = vi.fn();
const checkBuilderModel = vi.fn();
const buildComposition = vi.fn();
vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir(), isPackaged: false } }));
vi.mock('../agents/tool-support', () => ({
  resolveToolSupport: (...a: unknown[]) => resolveToolSupport(...a),
  resolveProviderInfo: (...a: unknown[]) => resolveProviderInfo(...a),
}));
vi.mock('./openrouter-model-check', () => ({ checkBuilderModel: (...a: unknown[]) => checkBuilderModel(...a) }));
vi.mock('./tsx-builder', () => ({ buildComposition: (...a: unknown[]) => buildComposition(...a) }));

import { chooseTsxEngine, generateTsx, NEEDS_TOOLS_MESSAGE } from './generate-tsx';
import type { GenerateTsxRequest } from './types';

const CODE = [
  "import React from 'react';",
  'export const compositionConfig = { id: "Bounce", width: 1080, height: 1350, fps: 30, durationInFrames: 60 };',
  'export default function Bounce() { return null; }',
].join('\n');

function request(over: Partial<GenerateTsxRequest> = {}): GenerateTsxRequest {
  return {
    intent: 'A red ball bounces once.',
    format: { width: 1080, height: 1350, fps: 30, durationInFrames: 60, loop: true },
    budget: 'quick',
    providerId: 'claude-subscription',
    model: 'claude-sonnet-5-5',
    ...over,
  };
}

beforeEach(() => {
  resolveToolSupport.mockReset();
  resolveProviderInfo.mockReset();
  checkBuilderModel.mockReset();
  buildComposition.mockReset();
  resolveToolSupport.mockResolvedValue(true);
  resolveProviderInfo.mockResolvedValue({ id: 'claude-subscription', type: 'agent-sdk' });
  checkBuilderModel.mockResolvedValue({ ok: true });
});

describe('chooseTsxEngine', () => {
  it('sends a tool provider to the builder and refuses any other, naming it', async () => {
    expect(await chooseTsxEngine({ providerId: 'claude-api' })).toEqual({ engine: 'builder', reason: 'tools' });
    expect(resolveToolSupport).toHaveBeenNthCalledWith(1, 'claude-api');

    resolveToolSupport.mockResolvedValueOnce(false);
    resolveProviderInfo.mockResolvedValueOnce({ id: 'my-openai', type: 'openai-compat' });
    const refused = await chooseTsxEngine({ providerId: 'my-openai' });
    expect(refused).toMatchObject({ engine: 'none', reason: 'no-tools' });
    expect(refused.engine === 'none' && refused.error).toBe(`${NEEDS_TOOLS_MESSAGE}: provider "my-openai" (openai-compat) cannot run tools.`);
  });

  it('words the refusal without a provider, and when settings cannot be read', async () => {
    resolveToolSupport.mockResolvedValue(false);
    resolveProviderInfo.mockResolvedValueOnce(null);
    expect(await chooseTsxEngine({})).toMatchObject({ engine: 'none', error: `${NEEDS_TOOLS_MESSAGE}: no LLM provider is set up.` });
    resolveProviderInfo.mockRejectedValueOnce(new Error('db locked'));
    expect(await chooseTsxEngine({ providerId: 'x' })).toMatchObject({ engine: 'none', error: `${NEEDS_TOOLS_MESSAGE}: provider "x" cannot run tools.` });
  });

});

describe('generateTsx → builder', () => {
  it('hands the builder the request as it came', async () => {
    const build = { ok: true, stopReason: 'finished', code: CODE, config: { id: 'Bounce' }, elapsedMs: 42 };
    buildComposition.mockResolvedValue(build);
    const req = request();
    const result = await generateTsx(req);
    expect(buildComposition).toHaveBeenCalledWith(req);
    expect(result).toMatchObject({ engine: 'builder', reason: 'tools', ok: true, stopReason: 'finished', code: CODE, elapsedMs: 42, build });
  });

  it('refuses a provider without tools before the builder starts', async () => {
    resolveToolSupport.mockResolvedValue(false);
    resolveProviderInfo.mockResolvedValue({ id: 'gemini', type: 'gemini' });
    const result = await generateTsx(request({ providerId: 'gemini' }));
    expect(result).toMatchObject({ engine: 'none', reason: 'no-tools', ok: false, stopReason: 'error', error: expect.stringContaining('"gemini" (gemini) cannot run tools') });
    expect(result.code).toBeUndefined();
    expect(buildComposition).not.toHaveBeenCalled();
    expect(checkBuilderModel).not.toHaveBeenCalled();
  });

  it('checks the model on the provider before the run and refuses one the builder cannot use', async () => {
    checkBuilderModel.mockResolvedValueOnce({ ok: false, error: 'The model "z-ai/glm-5.3" has no image input on OpenRouter...' });
    const abort = new AbortController();
    const result = await generateTsx(request({ providerId: 'openrouter', model: 'z-ai/glm-5.3', signal: abort.signal }));
    expect(checkBuilderModel).toHaveBeenCalledWith('openrouter', 'z-ai/glm-5.3', { signal: abort.signal });
    expect(result).toMatchObject({ engine: 'none', reason: 'unfit-model', ok: false, stopReason: 'error', error: expect.stringContaining('glm-5.3') });
    expect(buildComposition).not.toHaveBeenCalled();
  });

  it('runs when the model could not be checked', async () => {
    checkBuilderModel.mockResolvedValueOnce({ ok: true, unchecked: 'model list unavailable' });
    buildComposition.mockResolvedValue({ ok: true, stopReason: 'finished', code: CODE, elapsedMs: 1 });
    expect(await generateTsx(request({ providerId: 'openrouter' }))).toMatchObject({ engine: 'builder', ok: true });
  });

  it('gives no code from a run that kept nothing, and never throws', async () => {
    buildComposition.mockResolvedValueOnce({ ok: false, stopReason: 'cap-time', error: 'Stopped: 15 min', elapsedMs: 9 });
    const capped = await generateTsx(request());
    expect(capped).toMatchObject({ ok: false, stopReason: 'cap-time', error: 'Stopped: 15 min' });
    expect(capped.code).toBeUndefined();

    buildComposition.mockRejectedValueOnce(new Error('EPERM on the run folder'));
    const thrown = await generateTsx(request());
    expect(thrown).toMatchObject({ engine: 'builder', ok: false, stopReason: 'error', error: 'EPERM on the run folder' });
    expect(thrown.engine === 'builder' && thrown.build).toBeUndefined();
  });
});
