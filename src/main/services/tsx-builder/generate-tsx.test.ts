import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// The dispatcher with both engines faked: which one runs, what each receives,
// how its outcome becomes the one result shape — and, since Rev 2, who is
// refused before anything runs (no tools; an OpenRouter model the builder
// cannot use).

const resolveToolSupport = vi.fn();
const resolveProviderInfo = vi.fn();
const checkBuilderModel = vi.fn();
const buildComposition = vi.fn();
const generateTsxPipeline = vi.fn();
const editTsxPipeline = vi.fn();
vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir(), isPackaged: false } }));
vi.mock('../agents/tool-support', () => ({
  resolveToolSupport: (...a: unknown[]) => resolveToolSupport(...a),
  resolveProviderInfo: (...a: unknown[]) => resolveProviderInfo(...a),
}));
vi.mock('./openrouter-model-check', () => ({ checkBuilderModel: (...a: unknown[]) => checkBuilderModel(...a) }));
vi.mock('./tsx-builder', () => ({ buildComposition: (...a: unknown[]) => buildComposition(...a) }));
vi.mock('../../../shared/tsx-engine', () => ({
  generateTsxPipeline: (...a: unknown[]) => generateTsxPipeline(...a),
  editTsxPipeline: (...a: unknown[]) => editTsxPipeline(...a),
}));

import { chooseTsxEngine, generateTsx, NEEDS_TOOLS_MESSAGE } from './generate-tsx';
import { LOOP_INSTRUCTION } from './pipeline-fallback';
import type { GenerateTsxRequest } from './types';

const CODE = [
  "import React from 'react';",
  'export const compositionConfig = { id: "Bounce", width: 1080, height: 1350, fps: 30, durationInFrames: 60 };',
  'export default function Bounce() { return null; }',
].join('\n');

const deps = { llmGenerate: vi.fn(), tsxValidate: vi.fn() };

function request(over: Partial<GenerateTsxRequest> = {}): GenerateTsxRequest {
  return {
    intent: 'A red ball bounces once.',
    format: { width: 1080, height: 1350, fps: 30, durationInFrames: 60, loop: true },
    budget: 'quick',
    providerId: 'claude-subscription',
    model: 'claude-sonnet-5-5',
    fallback: { deps },
    ...over,
  };
}

function pipelineResult(over: Record<string, unknown> = {}) {
  return { text: CODE, model: 'm', durationMs: 5, steps: [], mode: '2d', verified: true, transpileValid: true, fixAttempts: 0, ...over };
}

beforeEach(() => {
  resolveToolSupport.mockReset();
  resolveProviderInfo.mockReset();
  checkBuilderModel.mockReset();
  buildComposition.mockReset();
  generateTsxPipeline.mockReset();
  editTsxPipeline.mockReset();
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

  it('sends 3D to the pipeline before asking the provider', async () => {
    expect(await chooseTsxEngine({ providerId: 'claude-api', mode: '3d' })).toEqual({ engine: 'pipeline', reason: 'mode-3d' });
    expect(resolveToolSupport).not.toHaveBeenCalled();
  });

  it('lets a forced engine win over mode and provider', async () => {
    expect(await chooseTsxEngine({ engine: 'builder', mode: '3d' })).toEqual({ engine: 'builder', reason: 'forced' });
    expect(await chooseTsxEngine({ engine: 'pipeline' })).toEqual({ engine: 'pipeline', reason: 'forced' });
    expect(resolveToolSupport).not.toHaveBeenCalled();
  });
});

describe('generateTsx → builder', () => {
  it('hands the builder the request without the dispatcher fields', async () => {
    const build = { ok: true, stopReason: 'finished', code: CODE, config: { id: 'Bounce' }, elapsedMs: 42 };
    buildComposition.mockResolvedValue(build);
    const req = request({ mode: '2d' });
    const result = await generateTsx(req);
    const { engine: _e, mode: _m, fallback: _f, ...expected } = req;
    expect(buildComposition).toHaveBeenCalledWith(expected);
    expect(generateTsxPipeline).not.toHaveBeenCalled();
    expect(result).toMatchObject({ engine: 'builder', reason: 'tools', ok: true, stopReason: 'finished', code: CODE, elapsedMs: 42, build });
  });

  it('needs no fallback block: the builder runs without one', async () => {
    buildComposition.mockResolvedValue({ ok: true, stopReason: 'finished', code: CODE, elapsedMs: 1 });
    const result = await generateTsx(request({ fallback: undefined }));
    expect(result).toMatchObject({ engine: 'builder', ok: true });
    expect(buildComposition).toHaveBeenCalledTimes(1);
  });

  it('refuses a provider without tools before the builder starts', async () => {
    resolveToolSupport.mockResolvedValue(false);
    resolveProviderInfo.mockResolvedValue({ id: 'gemini', type: 'gemini' });
    const result = await generateTsx(request({ providerId: 'gemini' }));
    expect(result).toMatchObject({ engine: 'none', reason: 'no-tools', ok: false, stopReason: 'error', error: expect.stringContaining('"gemini" (gemini) cannot run tools') });
    expect(result.code).toBeUndefined();
    expect(buildComposition).not.toHaveBeenCalled();
    expect(generateTsxPipeline).not.toHaveBeenCalled();
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

describe('generateTsx → pipeline (forced or 3D)', () => {
  it('maps format, brand, loop and images onto the pipeline, with the caller deps', async () => {
    generateTsxPipeline.mockResolvedValue(pipelineResult());
    const onProgress = vi.fn();
    const images = [{ data: 'AAA', mediaType: 'image/png' }];
    await generateTsx(
      request({
        engine: 'pipeline',
        brand: '  Colours: navy, coral.  ',
        referenceImages: images as GenerateTsxRequest['referenceImages'],
        packs: [{ name: 'infographic-loop', body: 'BUILDER-ONLY METHOD' }],
        fallback: {
          deps,
          promptContext: { imports: 'strict', category: 'loop', extraInstructions: 'Show it with <Img src={x} />.' },
          thinkingLevel: 'low',
          maxTurns: 2,
          optimize: true,
          maxFixRetries: 1,
          onProgress,
        },
      }),
    );
    const [options, passedDeps] = generateTsxPipeline.mock.calls[0];
    expect(passedDeps).toBe(deps);
    expect(options).toEqual({
      prompt: 'A red ball bounces once.',
      providerId: 'claude-subscription',
      model: 'claude-sonnet-5-5',
      images,
      thinkingLevel: 'low',
      maxTurns: 2,
      optimize: true,
      maxFixRetries: 1,
      onProgress,
      promptContext: {
        imports: 'strict',
        category: 'loop',
        videoWidth: 1080,
        videoHeight: 1350,
        fps: 30,
        durationSeconds: 2,
        extraInstructions: `Colours: navy, coral.\n\n${LOOP_INSTRUCTION}\n\nShow it with <Img src={x} />.`,
      },
    });
    expect(JSON.stringify(options)).not.toContain('BUILDER-ONLY');
    expect(buildComposition).not.toHaveBeenCalled();
  });

  it('leaves the length and the mode to the pipeline when the request does', async () => {
    generateTsxPipeline.mockResolvedValue(pipelineResult());
    await generateTsx(request({ engine: 'pipeline', format: { width: 1920, height: 1080, fps: 30 } }));
    const [options] = generateTsxPipeline.mock.calls[0];
    expect(options.promptContext).toEqual({ videoWidth: 1920, videoHeight: 1080, fps: 30 });
    expect(options.mode).toBeUndefined();
  });

  it('runs 3D on the pipeline with the mode passed through', async () => {
    generateTsxPipeline.mockResolvedValue(pipelineResult({ mode: '3d' }));
    const result = await generateTsx(request({ mode: '3d' }));
    expect(result).toMatchObject({ engine: 'pipeline', reason: 'mode-3d', ok: true });
    expect(generateTsxPipeline.mock.calls[0][0].mode).toBe('3d');
    expect(checkBuilderModel).not.toHaveBeenCalled();
  });

  it('is an error when the pipeline is chosen without fallback deps', async () => {
    const result = await generateTsx(request({ mode: '3d', fallback: undefined }));
    expect(result).toMatchObject({ engine: 'pipeline', reason: 'mode-3d', ok: false, stopReason: 'error', error: expect.stringContaining('fallback deps') });
    expect(generateTsxPipeline).not.toHaveBeenCalled();
  });

  it('returns the code and its parsed config when the gate passed', async () => {
    const pipeline = pipelineResult();
    generateTsxPipeline.mockResolvedValue(pipeline);
    const result = await generateTsx(request({ engine: 'pipeline' }));
    expect(result).toMatchObject({ engine: 'pipeline', reason: 'forced', ok: true, stopReason: 'finished', code: CODE, pipeline });
    expect(result.config).toMatchObject({ width: 1080, height: 1350, fps: 30, durationInFrames: 60 });
  });

  it('keeps the raw text but gives no code when the gate never passed', async () => {
    generateTsxPipeline.mockResolvedValue(pipelineResult({ transpileValid: false, fixAttempts: 3 }));
    const result = await generateTsx(request({ engine: 'pipeline' }));
    expect(result).toMatchObject({ ok: false, stopReason: 'error', error: expect.stringContaining('after 3 fix attempt(s)') });
    expect(result.code).toBeUndefined();
    expect(result.engine === 'pipeline' && result.pipeline?.text).toBe(CODE);
  });

  it('turns a throw into an error, or a cancel when the signal fired', async () => {
    generateTsxPipeline.mockRejectedValueOnce(new Error('Generation failed'));
    expect(await generateTsx(request({ engine: 'pipeline' }))).toMatchObject({ ok: false, stopReason: 'error', error: 'Generation failed' });

    const abort = new AbortController();
    generateTsxPipeline.mockImplementationOnce(async () => {
      abort.abort();
      throw new Error('Request cancelled');
    });
    expect(await generateTsx(request({ engine: 'pipeline', signal: abort.signal }))).toMatchObject({ ok: false, stopReason: 'cancelled' });
  });

  it('does not start when the signal already fired', async () => {
    const abort = new AbortController();
    abort.abort();
    expect(await generateTsx(request({ engine: 'pipeline', signal: abort.signal }))).toMatchObject({ ok: false, stopReason: 'cancelled' });
    expect(generateTsxPipeline).not.toHaveBeenCalled();
  });
});

describe('generateTsx → pipeline (edit)', () => {
  let folder = '';
  beforeEach(async () => {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-tsx-'));
    await fs.writeFile(path.join(folder, 'v1.tsx'), 'ONE', 'utf-8');
    await fs.writeFile(path.join(folder, 'v2.tsx'), 'TWO', 'utf-8');
    editTsxPipeline.mockResolvedValue(pipelineResult());
  });
  afterEach(async () => {
    await fs.rm(folder, { recursive: true, force: true });
  });

  it('edits the latest version with the change and the chat so far', async () => {
    const chatHistory = [{ role: 'user' as const, content: 'make it red' }];
    const result = await generateTsx(
      request({ engine: 'pipeline', intent: 'Slower bounce.', editOf: { folderPath: folder }, fallback: { deps, chatHistory } }),
    );
    expect(generateTsxPipeline).not.toHaveBeenCalled();
    const [options, passedDeps] = editTsxPipeline.mock.calls[0];
    expect(passedDeps).toBe(deps);
    expect(options).toEqual({
      currentCode: 'TWO',
      editInstruction: 'Slower bounce.',
      chatHistory,
      providerId: 'claude-subscription',
      model: 'claude-sonnet-5-5',
    });
    expect(result).toMatchObject({ engine: 'pipeline', ok: true, code: CODE });
  });

  it('edits the version asked for, and fails cleanly on one that is missing', async () => {
    await generateTsx(request({ engine: 'pipeline', editOf: { folderPath: folder, version: 1 } }));
    expect(editTsxPipeline.mock.calls[0][0].currentCode).toBe('ONE');

    const missing = await generateTsx(request({ engine: 'pipeline', editOf: { folderPath: folder, version: 7 } }));
    expect(missing).toMatchObject({ ok: false, stopReason: 'error', error: expect.stringContaining('v7.tsx not found') });
    expect(editTsxPipeline).toHaveBeenCalledTimes(1);
  });
});
