// `edit_composition` on the TSX builder (P3 part 4; moved out of
// generate-composition.test.ts in part 7): one `build` job through a fake job
// engine (test-build-engine.ts) that continues the version (`editOf`) and
// files vN+1 superseding it. Part 7: the node's Budget and Loop (Keep / On /
// Off) and its `reviseOnRetry` ports. The transpiler and the module server are
// stubbed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { makeToolContext } from './test-context';
import { fakeBuildEngine, FAKE_BUILD_CODE, type FakeBuildEngine } from './test-build-engine';

const transpileTsxSource = vi.fn();

vi.mock('electron', () => ({
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
}));
vi.mock('../../module-server', () => ({
  ensureModuleServer: async () => 4001,
  getModuleServerBaseUrl: () => 'http://localhost:4001',
  storeTranspileResult: () => 'http://localhost:4001/modules/h1.js',
}));
vi.mock('../../tsx-transpiler', () => ({
  transpileTsxSource: (code: string, name: string, base: string) => transpileTsxSource(code, name, base),
}));
vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => '/lib',
  getLibraryRoot: () => '/lib',
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('../../settings', () => ({
  getLlmProviders: async () => ({ providers: [], activeProvider: undefined }),
}));

const { editCompositionTool } = await import('./edit-composition');
const { setBuildEngineForTests } = await import('./composition-build');

const CONFIG = { id: 'main', durationInFrames: 120, fps: 30, width: 1080, height: 1920 };

let dir: string;
let engine: FakeBuildEngine;

const prior = (relPath: string) => ({
  id: 'composition-1',
  kind: 'composition' as const,
  title: 'Promo loop',
  createdAt: new Date().toISOString(),
  producer: { tool: 'generate_composition', callId: 'c0' },
  version: 1,
  payload: { relPath, config: CONFIG },
});

async function seedV1(): Promise<string> {
  const folder = path.join(dir, 'compositions', 'promo-loop');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'v1.tsx'), FAKE_BUILD_CODE, 'utf-8');
  return folder;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-composition-edit-'));
  engine = fakeBuildEngine();
  setBuildEngineForTests(engine);
  transpileTsxSource.mockReset();
  transpileTsxSource.mockResolvedValue({ success: true, code: 'js', hash: 'h1', config: CONFIG, componentName: 'Main' });
});

afterEach(async () => {
  setBuildEngineForTests(null);
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('edit_composition', () => {
  it('continues the version (editOf) and files vN+1 from the same folder, superseding it', async () => {
    const folder = await seedV1();
    const res = await editCompositionTool.handler(
      { artifactId: 'composition-1', instruction: 'slow the outro' },
      makeToolContext({ workspaceDir: dir, artifacts: [prior('compositions/promo-loop/v1.tsx')], model: 'claude-sonnet-5-5' }),
    );
    expect(res.isError).toBeUndefined();
    expect(engine.builds[0].request).toEqual({
      kind: 'build',
      prompt: 'slow the outro',
      options: { model: 'claude-sonnet-5-5' },
      build: { budget: 'standard', editOf: { folderPath: folder, version: 1 } },
    });
    // An edit builds onto the version; it reserves no folder.
    expect(engine.builds[0].owner?.into).toBeUndefined();
    expect(res.supersedes).toBe('composition-1');
    expect(res.artifact?.payload).toMatchObject({ relPath: 'compositions/promo-loop/v2.tsx' });
    expect(res.content[0].text).toContain('Edited Promo loop: compositions/promo-loop/v2.tsx');
    expect(res.images).toHaveLength(3);
  });

  it('copies a flat legacy file in as <slug>/v1.tsx first', async () => {
    await fs.mkdir(path.join(dir, 'compositions'), { recursive: true });
    await fs.writeFile(path.join(dir, 'compositions', 'promo-loop.tsx'), 'old code', 'utf-8');
    const res = await editCompositionTool.handler(
      { artifactId: 'composition-1', instruction: 'x', budget: 'quick' },
      makeToolContext({ workspaceDir: dir, artifacts: [prior('compositions/promo-loop.tsx')] }),
    );
    const folder = path.join(dir, 'compositions', 'promo-loop');
    expect(engine.builds[0].request.build).toMatchObject({ budget: 'quick', editOf: { folderPath: folder, version: 1 } });
    expect(await fs.readFile(path.join(folder, 'v1.tsx'), 'utf-8')).toBe('old code');
    expect(res.artifact?.payload).toMatchObject({ relPath: 'compositions/promo-loop/v2.tsx' });
    // The flat file stays where the earlier artifact points.
    expect(await fs.readFile(path.join(dir, 'compositions', 'promo-loop.tsx'), 'utf-8')).toBe('old code');
  });

  it('`loop` sends the version\'s size and fps with the loop flag, never a length', async () => {
    await seedV1();
    await editCompositionTool.handler(
      { artifactId: 'composition-1', instruction: 'x', loop: true },
      makeToolContext({ workspaceDir: dir, artifacts: [prior('compositions/promo-loop/v1.tsx')] }),
    );
    expect(engine.builds[0].request.build?.format).toEqual({ width: 1080, height: 1920, fps: 30, loop: true });
  });

  it('the node\'s Loop select: keep sends no format, on / off set the flag (part 7)', async () => {
    await seedV1();
    const ctx = makeToolContext({ workspaceDir: dir, artifacts: [prior('compositions/promo-loop/v1.tsx')], featureSource: 'flows' });
    await editCompositionTool.handler({ artifactId: 'composition-1', instruction: 'x', loop: 'keep', budget: 'quick' }, ctx);
    await editCompositionTool.handler({ artifactId: 'composition-1', instruction: 'x', loop: 'on' }, ctx);
    await editCompositionTool.handler({ artifactId: 'composition-1', instruction: 'x', loop: 'off' }, ctx);
    expect(engine.builds.map((b) => b.request.build?.format?.loop)).toEqual([undefined, true, false]);
    expect(engine.builds[0].request.build).not.toHaveProperty('format');
    expect(engine.builds[0].request.build?.budget).toBe('quick');
  });

  it('a failed edit leaves the composition unchanged', async () => {
    engine.options.outcome = 'error';
    engine.options.error = 'cap';
    await seedV1();
    const res = await editCompositionTool.handler(
      { artifactId: 'composition-1', instruction: 'x' },
      makeToolContext({ workspaceDir: dir, artifacts: [prior('compositions/promo-loop/v1.tsx')] }),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('The edit failed; the composition is unchanged: cap');
    expect(res.artifact).toBeUndefined();
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
    expect(engine.builds).toEqual([]);
  });
});

describe('edit_composition as a node (P3 part 7)', () => {
  it('declares Budget + Loop with defaults the schema takes, and revises the rejected output on a retry', () => {
    const ports = editCompositionTool.ports!;
    expect(ports.configSchema.map((f) => f.key)).toEqual(['budget', 'loop']);
    expect(ports.defaultConfig).toEqual({ budget: 'standard', loop: 'keep' });
    expect(z.object(editCompositionTool.schema).partial().safeParse(ports.defaultConfig).success).toBe(true);
    for (const field of ports.configSchema) {
      if (field.kind === 'select') expect(field.options.map((o) => o.value)).toContain(ports.defaultConfig[field.key]);
    }
    // The retry edits the version the user rejected, with the note as the instruction.
    expect(ports.reviseOnRetry).toEqual({ artifactKey: 'artifactId', noteKey: 'instruction' });
  });
});
