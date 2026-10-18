// generate_composition's P4 part 3 arguments (P4-6 (a)), through the fake job
// engine (test-build-engine.ts): what `packs`, the node's Kind + Style and
// `from` put in the job request, what is refused before a folder is
// reserved, and the agent's builder skills as the owner's packs.
// packs-through-tools.test.ts runs the same through the real engine and
// builder.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import type { AgentArtifact } from '../../../../shared/types/agents';
import { makeToolContext } from './test-context';
import { fakeBuildEngine, FAKE_BUILD_CODE, type FakeBuildEngine } from './test-build-engine';

// getAppPath: the real resources/packs, which the ids are checked against.
const REPO_ROOT = path.join(__dirname, '../../../../..');
vi.mock('electron', () => ({
  app: { getAppPath: () => REPO_ROOT, isPackaged: false, getPath: () => os.tmpdir() },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
}));
vi.mock('./session-brand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session-brand')>()),
  readSessionBrandInstructions: async (id?: string) => (id ? `Brand "${id}".` : undefined),
}));
vi.mock('../../module-server', () => ({
  ensureModuleServer: async () => 4001,
  getModuleServerBaseUrl: () => 'http://localhost:4001',
  storeTranspileResult: () => 'http://localhost:4001/modules/h1.js',
}));
const CONFIG = { id: 'main', durationInFrames: 240, fps: 30, width: 1080, height: 1350 };
vi.mock('../../tsx-transpiler', () => ({
  transpileTsxSource: async () => ({ success: true, code: 'js', hash: 'h1', config: CONFIG, componentName: 'Main' }),
}));

const { generateCompositionTool } = await import('./generate-composition');
const { setBuildEngineForTests } = await import('./composition-build');

let dir: string;
let engine: FakeBuildEngine;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-composition-packs-'));
  engine = fakeBuildEngine();
  setBuildEngineForTests(engine);
});

afterEach(async () => {
  setBuildEngineForTests(null);
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('generate_composition: craft packs', () => {
  it('sends the ids an agent names; style notes stay a note unless the style is your own', async () => {
    await generateCompositionTool.handler(
      { title: 'A', brief: 'b', packs: ['core/infographic-loop', 'core/style-flat-bold'], styleNotes: 'big type' },
      makeToolContext({ workspaceDir: dir }),
    );
    expect(engine.builds[0].request.build?.packs).toEqual(['core/infographic-loop', 'core/style-flat-bold']);
    expect(engine.builds[0].request.build).not.toHaveProperty('style');
    expect(engine.builds[0].request.prompt).toBe('b\n\nStyle notes: big type');

    await generateCompositionTool.handler(
      { title: 'B', brief: 'b', packs: ['core/style-custom'], styleNotes: 'Chalkboard, wobbly lines' },
      makeToolContext({ workspaceDir: dir }),
    );
    expect(engine.builds[1].request.build).toMatchObject({ packs: ['core/style-custom'], style: 'Chalkboard, wobbly lines' });
    expect(engine.builds[1].request.prompt).toBe('b');
  });

  it("the node's Kind and Style become ids; their 'none' defaults send no packs", async () => {
    const flows = makeToolContext({ workspaceDir: dir, featureSource: 'flows' });
    await generateCompositionTool.handler({ title: 'A', brief: 'b', kindPack: 'core/infographic-loop', stylePack: 'core/style-blueprint' }, flows);
    await generateCompositionTool.handler({ ...generateCompositionTool.ports!.defaultConfig, title: 'B', brief: 'b' } as never, flows);
    expect(engine.builds[0].request.build?.packs).toEqual(['core/infographic-loop', 'core/style-blueprint']);
    expect(engine.builds[1].request.build).not.toHaveProperty('packs');
  });

  it('refuses an unknown id, two styles or your own style without words before reserving a folder', async () => {
    const ctx = makeToolContext({ workspaceDir: dir });
    const unknown = await generateCompositionTool.handler({ title: 'A', brief: 'b', packs: ['core/style-chalk'] }, ctx);
    const two = await generateCompositionTool.handler({ title: 'A', brief: 'b', packs: ['core/style-blueprint', 'core/style-editorial'] }, ctx);
    const wordless = await generateCompositionTool.handler({ title: 'A', brief: 'b', packs: ['core/style-custom'] }, ctx);
    expect([unknown, two, wordless].map((r) => r.isError)).toEqual([true, true, true]);
    expect(unknown.content[0].text).toContain('Unknown craft pack "core/style-chalk"');
    expect(two.content[0].text).toContain('One style pack at most');
    expect(wordless.content[0].text).toContain('needs the user\'s own words');
    expect(engine.builds).toEqual([]);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('a call with neither a brief nor `from` is refused', async () => {
    const res = await generateCompositionTool.handler({ title: 'A' }, makeToolContext({ workspaceDir: dir }));
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('A brief is needed');
    expect(engine.builds).toEqual([]);
  });

  it("the agent's builder skills go to the builder as the owner's packs; a flow has none", async () => {
    const house = { name: 'House rules', body: '# House rules' };
    await generateCompositionTool.handler({ title: 'A', brief: 'b' }, makeToolContext({ workspaceDir: dir, builderPacks: [house] }));
    await generateCompositionTool.handler({ title: 'B', brief: 'b' }, makeToolContext({ workspaceDir: dir, featureSource: 'flows' }));
    expect(engine.builds[0].owner?.packs).toEqual([house]);
    expect(engine.builds[1].owner).not.toHaveProperty('packs');
  });

  it("the node's new fields take the schema, and the Packs sit before Style notes", () => {
    const ports = generateCompositionTool.ports!;
    expect(z.object(generateCompositionTool.schema).partial().safeParse(ports.defaultConfig).success).toBe(true);
    const keys = ports.configSchema.map((f) => f.key);
    expect(keys.indexOf('kindPack')).toBe(keys.indexOf('loop') + 1);
    expect(keys.slice(keys.indexOf('kindPack'), keys.indexOf('kindPack') + 3)).toEqual(['kindPack', 'stylePack', 'styleNotes']);
  });
});

describe('generate_composition: from', () => {
  const composition = (id: string, relPath: string): AgentArtifact => ({
    id,
    kind: 'composition',
    title: 'Two piles',
    createdAt: new Date().toISOString(),
    producer: { tool: 'generate_composition', callId: 'c0' },
    version: 1,
    payload: { relPath, config: CONFIG },
  });
  const FORMAT = { width: 1080, height: 1350, fps: 30, durationInFrames: 240, loop: true };

  async function record(version: number, prompt: string, request: Record<string, unknown>): Promise<void> {
    const folder = path.join(dir, 'compositions', 'two-piles');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, `v${version}.tsx`), FAKE_BUILD_CODE, 'utf-8');
    await fs.writeFile(path.join(folder, `v${version}.debug.json`), JSON.stringify({ kind: 'tsx-builder', prompt, request }), 'utf-8');
  }
  const V1 = {
    budget: 'standard', format: FORMAT, packs: ['Infographic loop', 'Concept to picture', 'Flat bold'],
    craftPacks: ['core/infographic-loop', 'core/concept-to-picture', 'core/style-flat-bold'], brand: 'Brand "acme".',
    referenceImages: 0, maxGeneratedImages: 0,
  };

  it("builds the version's request again into a new folder, only the budget changed, and says so", async () => {
    await record(1, 'Two piles of coins.\n\nStyle notes: big type', V1);
    const res = await generateCompositionTool.handler(
      { title: 'Two piles craft', from: 'composition-1', budget: 'craft' },
      makeToolContext({ workspaceDir: dir, artifacts: [composition('composition-1', 'compositions/two-piles/v1.tsx')], model: 'claude-sonnet-5-5' }),
    );
    expect(res.isError).toBeUndefined();
    expect(engine.builds[0].request).toEqual({
      kind: 'build',
      prompt: 'Two piles of coins.\n\nStyle notes: big type',
      options: { model: 'claude-sonnet-5-5' },
      build: { format: FORMAT, budget: 'craft', packs: V1.craftPacks, brand: 'Brand "acme".', maxGeneratedImages: 0 },
    });
    expect(engine.builds[0].owner?.into).toBe(path.join(dir, 'compositions', 'two-piles-craft'));
    expect(res.content[0].text.split('\n')[0]).toBe(
      "Rebuilt from composition-1's request, unchanged (its brief, packs, style, format and loop), at the Craft budget.",
    );
  });

  it('an absent budget keeps the recorded one; images stay allowed when the build allowed them', async () => {
    await record(1, 'Piles.', { ...V1, maxGeneratedImages: 4, style: 'Chalk', craftPacks: ['core/style-custom'] });
    await generateCompositionTool.handler(
      { title: 'Again', from: 'composition-1' },
      makeToolContext({ workspaceDir: dir, artifacts: [composition('composition-1', 'compositions/two-piles/v1.tsx')] }),
    );
    expect(engine.builds[0].request.build).toMatchObject({ budget: 'standard', packs: ['core/style-custom'], style: 'Chalk' });
    expect(engine.builds[0].request.build).not.toHaveProperty('maxGeneratedImages');
  });

  it('an edit goes back to the request that started the folder', async () => {
    await record(1, 'Piles.', V1);
    await record(2, 'Bigger label.', { ...V1, editOf: { folderPath: 'elsewhere', version: 1 } });
    await record(3, 'Slower.', { ...V1, editOf: { folderPath: 'elsewhere', version: 2 } });
    const res = await generateCompositionTool.handler(
      { title: 'Again', from: 'composition-3', budget: 'quick' },
      makeToolContext({ workspaceDir: dir, artifacts: [composition('composition-3', 'compositions/two-piles/v3.tsx')] }),
    );
    expect(engine.builds[0].request.prompt).toBe('Piles.');
    expect(res.content[0].text).toContain("That is v1's request: the edits up to v3 are not in this build.");
  });

  it('refuses anything that would change the request, before reserving a folder', async () => {
    await record(1, 'Piles.', V1);
    const res = await generateCompositionTool.handler(
      { title: 'Again', from: 'composition-1', brief: 'new words', packs: [], kindPack: 'none' },
      makeToolContext({ workspaceDir: dir, artifacts: [composition('composition-1', 'compositions/two-piles/v1.tsx')] }),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("`from` builds composition-1's own request again, unchanged; only title and budget go with it. Leave out: brief, packs.");
    expect(engine.builds).toEqual([]);
  });

  it('refuses a build made from session media, a version with no record, and an id that is not a composition', async () => {
    const doc: AgentArtifact = {
      id: 'document-1', kind: 'document', title: 'Script', createdAt: new Date().toISOString(),
      producer: { tool: 'write_document', callId: 'c0' }, payload: { relPath: 'documents/script.md' },
    };
    await record(1, 'Ad.', { ...V1, referenceImages: 2, assets: ['hero.png'] });
    const artifacts = [composition('composition-1', 'compositions/two-piles/v1.tsx'), composition('composition-9', 'compositions/old.tsx'), doc];
    const ctx = makeToolContext({ workspaceDir: dir, artifacts });
    const media = await generateCompositionTool.handler({ title: 'A', from: 'composition-1' }, ctx);
    const flat = await generateCompositionTool.handler({ title: 'A', from: 'composition-9' }, ctx);
    const notComposition = await generateCompositionTool.handler({ title: 'A', from: 'document-1' }, ctx);
    expect(media.content[0].text).toContain('built from session media');
    expect(flat.content[0].text).toContain('has no build request to start from');
    expect(notComposition.content[0].text).toContain('is a document, not a composition');
    expect(engine.builds).toEqual([]);
  });
});
