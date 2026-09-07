// Stage 1's second "done when": `generate_composition` yields a `composition`
// artifact with a served module URL. The pipeline and the transpiler are stubbed
// — this is about what the tool does with their output, not about esbuild.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { makeToolContext } from './test-context';

const generateTsxPipeline = vi.fn();
const editTsxPipeline = vi.fn();
const transpileTsxSource = vi.fn();
const storeTranspileResult = vi.fn();

vi.mock('../../../../shared/tsx-engine', () => ({
  generateTsxPipeline: (o: unknown, d: unknown) => generateTsxPipeline(o, d),
  editTsxPipeline: (o: unknown, d: unknown) => editTsxPipeline(o, d),
}));
vi.mock('../tsx-deps', () => ({ buildAgentTsxDeps: () => ({}) }));
vi.mock('../../module-server', () => ({
  ensureModuleServer: async () => 4001,
  getModuleServerBaseUrl: () => 'http://localhost:4001',
  storeTranspileResult: (r: unknown) => storeTranspileResult(r),
}));
vi.mock('../../tsx-transpiler', () => ({
  transpileTsxSource: (code: string, name: string, base: string) =>
    transpileTsxSource(code, name, base),
}));

const { generateCompositionTool } = await import('./generate-composition');
const { editCompositionTool } = await import('./edit-composition');

const CODE = "import {AbsoluteFill} from 'remotion';\nexport const compositionConfig = {};";
const CONFIG = { id: 'main', durationInFrames: 180, fps: 30, width: 1080, height: 1920 };

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-composition-'));
  generateTsxPipeline.mockReset();
  editTsxPipeline.mockReset();
  transpileTsxSource.mockReset();
  storeTranspileResult.mockReset();
  generateTsxPipeline.mockResolvedValue({ text: CODE, transpileValid: true, fixAttempts: 0 });
  editTsxPipeline.mockResolvedValue({ text: CODE, transpileValid: true, fixAttempts: 0 });
  transpileTsxSource.mockResolvedValue({ success: true, code: 'js', hash: 'h1', config: CONFIG, componentName: 'Main' });
  storeTranspileResult.mockReturnValue('http://localhost:4001/modules/h1.js');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('generate_composition', () => {
  it('writes the TSX, serves it, and returns a composition artifact', async () => {
    const res = await generateCompositionTool.handler(
      { title: 'Promo loop', brief: 'a 6s promo', width: 1080, height: 1920 },
      makeToolContext({ workspaceDir: dir }),
    );
    expect(res.isError).toBeUndefined();
    expect(res.artifact).toEqual({
      kind: 'composition',
      title: 'Promo loop',
      payload: {
        relPath: 'compositions/promo-loop.tsx',
        moduleUrl: 'http://localhost:4001/modules/h1.js',
        config: CONFIG,
      },
    });
    const onDisk = await fs.readFile(path.join(dir, 'compositions', 'promo-loop.tsx'), 'utf-8');
    expect(onDisk).toBe(CODE);
  });

  it('passes the requested size and duration into the prompt context', async () => {
    await generateCompositionTool.handler(
      { title: 'X', brief: 'b', width: 1920, height: 1080, fps: 60, durationSeconds: 12, styleNotes: 'bold type' },
      makeToolContext({ workspaceDir: dir }),
    );
    expect(generateTsxPipeline.mock.calls[0][0]).toMatchObject({
      prompt: 'b',
      promptContext: {
        videoWidth: 1920,
        videoHeight: 1080,
        fps: 60,
        durationSeconds: 12,
        extraInstructions: 'bold type',
      },
    });
  });

  it('reports a gate failure as a tool error and files nothing', async () => {
    generateTsxPipeline.mockResolvedValue({ text: CODE, transpileValid: false, fixAttempts: 3 });
    const res = await generateCompositionTool.handler(
      { title: 'X', brief: 'b' },
      makeToolContext({ workspaceDir: dir }),
    );
    expect(res.isError).toBe(true);
    expect(res.artifact).toBeUndefined();
    expect(res.content[0].text).toContain('3 fix attempt');
  });
});

describe('edit_composition', () => {
  const prior = {
    id: 'composition-1',
    kind: 'composition' as const,
    title: 'Promo loop',
    createdAt: new Date().toISOString(),
    producer: { tool: 'generate_composition', callId: 'c0' },
    version: 1,
    payload: { relPath: 'compositions/promo-loop.tsx', config: CONFIG },
  };

  it('reads the prior version, writes a new file and supersedes it', async () => {
    await fs.mkdir(path.join(dir, 'compositions'), { recursive: true });
    await fs.writeFile(path.join(dir, 'compositions', 'promo-loop.tsx'), CODE, 'utf-8');

    const res = await editCompositionTool.handler(
      { artifactId: 'composition-1', instruction: 'slow the outro' },
      makeToolContext({ workspaceDir: dir, artifacts: [prior] }),
    );
    expect(res.isError).toBeUndefined();
    expect(res.supersedes).toBe('composition-1');
    expect(res.artifact?.payload).toMatchObject({ relPath: 'compositions/promo-loop-2.tsx' });
    expect(editTsxPipeline.mock.calls[0][0]).toMatchObject({
      currentCode: CODE,
      editInstruction: 'slow the outro',
    });
    // The prior file is untouched, so the filmstrip can still show it.
    expect(await fs.readFile(path.join(dir, 'compositions', 'promo-loop.tsx'), 'utf-8')).toBe(CODE);
  });

  it('refuses an id that is not a composition', async () => {
    const doc = {
      id: 'document-1',
      kind: 'document' as const,
      title: 'Script',
      createdAt: new Date().toISOString(),
      producer: { tool: 'write_document', callId: 'c0' },
      payload: { relPath: 'documents/script.md' },
    };
    const res = await editCompositionTool.handler(
      { artifactId: 'document-1', instruction: 'x' },
      makeToolContext({ workspaceDir: dir, artifacts: [doc] }),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('is a document, not a composition');
    expect(editTsxPipeline).not.toHaveBeenCalled();
  });
});
