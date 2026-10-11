import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// The dispatcher with both engines faked: which one runs, what each receives,
// and how its outcome becomes the one result shape.

const resolveToolSupport = vi.fn();
const buildComposition = vi.fn();
const generateTsxPipeline = vi.fn();
const editTsxPipeline = vi.fn();
vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir(), isPackaged: false } }));
vi.mock('../agents/tool-support', () => ({ resolveToolSupport: (...a: unknown[]) => resolveToolSupport(...a) }));
vi.mock('./tsx-builder', () => ({ buildComposition: (...a: unknown[]) => buildComposition(...a) }));
vi.mock('../../../shared/tsx-engine', () => ({
  generateTsxPipeline: (...a: unknown[]) => generateTsxPipeline(...a),
  editTsxPipeline: (...a: unknown[]) => editTsxPipeline(...a),
}));

import { chooseTsxEngine, generateTsx } from './generate-tsx';
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
  buildComposition.mockReset();
  generateTsxPipeline.mockReset();
  editTsxPipeline.mockReset();
});

describe('chooseTsxEngine', () => {
  it('sends a tool provider to the builder and any other to the pipeline', async () => {
    resolveToolSupport.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await chooseTsxEngine({ providerId: 'claude-api' })).toEqual({ engine: 'builder', reason: 'tools' });
    expect(await chooseTsxEngine({ providerId: 'openai' })).toEqual({ engine: 'pipeline', reason: 'no-tools' });
    expect(resolveToolSupport).toHaveBeenNthCalledWith(1, 'claude-api');
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
    resolveToolSupport.mockResolvedValue(true);
    const build = { ok: true, stopReason: 'finished', code: CODE, config: { id: 'Bounce' }, elapsedMs: 42 };
    buildComposition.mockResolvedValue(build);
    const req = request({ mode: '2d' });
    const result = await generateTsx(req);
    const { engine: _e, mode: _m, fallback: _f, ...expected } = req;
    expect(buildComposition).toHaveBeenCalledWith(expected);
    expect(generateTsxPipeline).not.toHaveBeenCalled();
    expect(result).toMatchObject({ engine: 'builder', reason: 'tools', ok: true, stopReason: 'finished', code: CODE, elapsedMs: 42, build });
  });

  it('gives no code from a run that kept nothing, and never throws', async () => {
    resolveToolSupport.mockResolvedValue(true);
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

describe('generateTsx → pipeline (new piece)', () => {
  it('maps format, brand, loop and images onto the pipeline, with the caller deps', async () => {
    resolveToolSupport.mockResolvedValue(false);
    generateTsxPipeline.mockResolvedValue(pipelineResult());
    const onProgress = vi.fn();
    const images = [{ data: 'AAA', mediaType: 'image/png' }];
    await generateTsx(
      request({
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
  });

  it('leaves the length and the mode to the pipeline when the request does', async () => {
    resolveToolSupport.mockResolvedValue(false);
    generateTsxPipeline.mockResolvedValue(pipelineResult());
    await generateTsx(request({ format: { width: 1920, height: 1080, fps: 30 } }));
    const [options] = generateTsxPipeline.mock.calls[0];
    expect(options.promptContext).toEqual({ videoWidth: 1920, videoHeight: 1080, fps: 30 });
    expect(options.mode).toBeUndefined();
  });

  it('runs 3D on the pipeline with the mode passed through', async () => {
    generateTsxPipeline.mockResolvedValue(pipelineResult({ mode: '3d' }));
    const result = await generateTsx(request({ mode: '3d' }));
    expect(result).toMatchObject({ engine: 'pipeline', reason: 'mode-3d', ok: true });
    expect(generateTsxPipeline.mock.calls[0][0].mode).toBe('3d');
  });

  it('returns the code and its parsed config when the gate passed', async () => {
    resolveToolSupport.mockResolvedValue(false);
    const pipeline = pipelineResult();
    generateTsxPipeline.mockResolvedValue(pipeline);
    const result = await generateTsx(request());
    expect(result).toMatchObject({ engine: 'pipeline', reason: 'no-tools', ok: true, stopReason: 'finished', code: CODE, pipeline });
    expect(result.config).toMatchObject({ width: 1080, height: 1350, fps: 30, durationInFrames: 60 });
  });

  it('keeps the raw text but gives no code when the gate never passed', async () => {
    resolveToolSupport.mockResolvedValue(false);
    generateTsxPipeline.mockResolvedValue(pipelineResult({ transpileValid: false, fixAttempts: 3 }));
    const result = await generateTsx(request());
    expect(result).toMatchObject({ ok: false, stopReason: 'error', error: expect.stringContaining('after 3 fix attempt(s)') });
    expect(result.code).toBeUndefined();
    expect(result.engine === 'pipeline' && result.pipeline?.text).toBe(CODE);
  });

  it('turns a throw into an error, or a cancel when the signal fired', async () => {
    resolveToolSupport.mockResolvedValue(false);
    generateTsxPipeline.mockRejectedValueOnce(new Error('Generation failed'));
    expect(await generateTsx(request())).toMatchObject({ ok: false, stopReason: 'error', error: 'Generation failed' });

    const abort = new AbortController();
    generateTsxPipeline.mockImplementationOnce(async () => {
      abort.abort();
      throw new Error('Request cancelled');
    });
    expect(await generateTsx(request({ signal: abort.signal }))).toMatchObject({ ok: false, stopReason: 'cancelled' });
  });

  it('does not start when the signal already fired', async () => {
    resolveToolSupport.mockResolvedValue(false);
    const abort = new AbortController();
    abort.abort();
    expect(await generateTsx(request({ signal: abort.signal }))).toMatchObject({ ok: false, stopReason: 'cancelled' });
    expect(generateTsxPipeline).not.toHaveBeenCalled();
  });
});

describe('generateTsx → pipeline (edit)', () => {
  let folder = '';
  beforeEach(async () => {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-tsx-'));
    await fs.writeFile(path.join(folder, 'v1.tsx'), 'ONE', 'utf-8');
    await fs.writeFile(path.join(folder, 'v2.tsx'), 'TWO', 'utf-8');
    resolveToolSupport.mockResolvedValue(false);
    editTsxPipeline.mockResolvedValue(pipelineResult());
  });
  afterEach(async () => {
    await fs.rm(folder, { recursive: true, force: true });
  });

  it('edits the latest version with the change and the chat so far', async () => {
    const chatHistory = [{ role: 'user' as const, content: 'make it red' }];
    const result = await generateTsx(
      request({ intent: 'Slower bounce.', editOf: { folderPath: folder }, fallback: { deps, chatHistory } }),
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
    await generateTsx(request({ editOf: { folderPath: folder, version: 1 } }));
    expect(editTsxPipeline.mock.calls[0][0].currentCode).toBe('ONE');

    const missing = await generateTsx(request({ editOf: { folderPath: folder, version: 7 } }));
    expect(missing).toMatchObject({ ok: false, stopReason: 'error', error: expect.stringContaining('v7.tsx not found') });
    expect(editTsxPipeline).toHaveBeenCalledTimes(1);
  });
});
