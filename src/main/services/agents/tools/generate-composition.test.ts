// `generate_composition` on the TSX builder (P3 part 4): one `build` job
// through a fake job engine (test-build-engine.ts), into a reserved
// `compositions/<slug>/`, and back as a `composition` artifact with the frames
// the builder last looked at. Part 7: the node's budget / loop / images
// fields and the revise path. The transpiler and the module server are
// stubbed — this is about what the tool asks for and what it does with the
// job's result, not about esbuild or the builder. `edit_composition`'s tests
// are in edit-composition.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { makeToolContext } from './test-context';
import { fakeBuildEngine, FAKE_BUILD_CODE, type FakeBuildEngine } from './test-build-engine';

const transpileTsxSource = vi.fn();
const storeTranspileResult = vi.fn();

vi.mock('electron', () => ({
  nativeImage: {
    createFromPath: (p: string) => ({
      isEmpty: () => p.endsWith('.svg'),
      getSize: () => ({ width: 2048, height: 1024 }),
      resize: (size: { width: number; height: number }) => ({ toJPEG: () => Buffer.from(`jpeg ${size.width}x${size.height}`) }),
      toJPEG: () => Buffer.from('jpeg full'),
    }),
  },
}));
// W7: the session brand block; the test decides what the library holds.
const readSessionBrandInstructions = vi.fn();
vi.mock('./session-brand', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session-brand')>()),
  readSessionBrandInstructions: (id?: string) => readSessionBrandInstructions(id),
}));
vi.mock('../../module-server', () => ({
  ensureModuleServer: async () => 4001,
  getModuleServerBaseUrl: () => 'http://localhost:4001',
  storeTranspileResult: (r: unknown) => storeTranspileResult(r),
}));
vi.mock('../../tsx-transpiler', () => ({
  transpileTsxSource: (code: string, name: string, base: string) => transpileTsxSource(code, name, base),
}));
// W8 Stage 3: port media resolve in the library, and the node's model binding
// asks which providers are usable.
let libraryRoot = '/lib';
vi.mock('../../library/library-paths', () => ({
  ensureLibraryRoot: async () => libraryRoot,
  getLibraryRoot: () => libraryRoot,
  resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
}));
vi.mock('../../settings', () => ({
  getLlmProviders: async () => ({
    providers: [
      { id: 'openrouter', name: 'OpenRouter', type: 'openai-compat', authMode: 'api-key', apiKey: 'k', defaultModel: 'x', enabled: true },
      { id: 'claude-subscription', name: 'Claude', type: 'agent-sdk', authMode: 'subscription', defaultModel: 'c', enabled: true },
    ],
    activeProvider: 'claude-subscription',
  }),
}));

const { generateCompositionTool } = await import('./generate-composition');
const { setBuildEngineForTests } = await import('./composition-build');

const CONFIG = { id: 'main', durationInFrames: 120, fps: 30, width: 1080, height: 1920 };

let dir: string;
let engine: FakeBuildEngine;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-composition-'));
  engine = fakeBuildEngine();
  setBuildEngineForTests(engine);
  transpileTsxSource.mockReset();
  storeTranspileResult.mockReset();
  readSessionBrandInstructions.mockReset();
  readSessionBrandInstructions.mockResolvedValue(undefined);
  transpileTsxSource.mockResolvedValue({ success: true, code: 'js', hash: 'h1', config: CONFIG, componentName: 'Main' });
  storeTranspileResult.mockReturnValue('http://localhost:4001/modules/h1.js');
});

afterEach(async () => {
  setBuildEngineForTests(null);
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('generate_composition', () => {
  it('builds into a reserved compositions/<slug>/ and files v1 with the last look\'s frames', async () => {
    const res = await generateCompositionTool.handler(
      { title: 'Promo loop', brief: 'a 4s promo', width: 1080, height: 1920 },
      makeToolContext({ workspaceDir: dir, agentId: 'vidtsx/motion-post' }),
    );
    expect(res.isError).toBeUndefined();
    const folder = path.join(dir, 'compositions', 'promo-loop');
    expect(engine.builds).toHaveLength(1);
    expect(engine.builds[0].owner).toEqual({
      origin: 'agent',
      into: folder,
      usage: { featureSource: 'agent', agentId: 'vidtsx/motion-post' },
    });
    expect(engine.builds[0].request).toMatchObject({
      kind: 'build',
      prompt: 'a 4s promo',
      build: { budget: 'standard', format: { width: 1080, height: 1920, fps: 30 } },
    });
    // No seconds given: the builder picks the length.
    expect(engine.builds[0].request.build?.format).not.toHaveProperty('durationInFrames');
    expect(res.artifact).toEqual({
      kind: 'composition',
      title: 'Promo loop',
      payload: {
        relPath: 'compositions/promo-loop/v1.tsx',
        moduleUrl: 'http://localhost:4001/modules/h1.js',
        config: CONFIG,
      },
    });
    expect(await fs.readFile(path.join(folder, 'v1.tsx'), 'utf-8')).toBe(FAKE_BUILD_CODE);
    // Three of the five model frames, spread; the phone view left out.
    expect(res.images?.map((i) => Buffer.from(i.data, 'base64').toString())).toEqual(['jpeg-0', 'jpeg-60', 'jpeg-119']);
    const text = res.content[0].text;
    expect(text).toContain('Composition ready: compositions/promo-loop/v1.tsx — 1080x1920, 4.0s at 30fps.');
    expect(text).toContain('Built on Standard: 2 looks, 4 checks, finished.');
    expect(text).toContain('frames 0, 60 and 119 from its last look (round 2)');
  });

  it('puts the brief, style notes and media in the prompt, the brand in `brand`, the model in options (W7)', async () => {
    readSessionBrandInstructions.mockResolvedValue('Brand "Acme" (MANDATORY styling): use the brand.');
    await generateCompositionTool.handler(
      { title: 'Sting', brief: 'a logo sting', styleNotes: 'big type' },
      makeToolContext({ workspaceDir: dir, brandId: 'acme', model: 'claude-opus-5' }),
    );
    expect(readSessionBrandInstructions).toHaveBeenCalledWith('acme');
    expect(engine.builds[0].request).toMatchObject({
      prompt: 'a logo sting\n\nStyle notes: big type',
      options: { model: 'claude-opus-5' },
      build: { brand: 'Brand "Acme" (MANDATORY styling): use the brand.' },
    });
  });

  it('turns seconds into frames and passes budget and loop through', async () => {
    await generateCompositionTool.handler(
      { title: 'X', brief: 'b', fps: 60, durationSeconds: 2.5, budget: 'craft', loop: true },
      makeToolContext({ workspaceDir: dir }),
    );
    expect(engine.builds[0].request.build).toMatchObject({
      budget: 'craft',
      format: { width: 1920, height: 1080, fps: 60, durationInFrames: 150, loop: true },
    });
  });

  it('a second build of the same title gets its own folder', async () => {
    const ctx = makeToolContext({ workspaceDir: dir });
    await generateCompositionTool.handler({ title: 'Promo', brief: 'b' }, ctx);
    const res = await generateCompositionTool.handler({ title: 'Promo', brief: 'b' }, ctx);
    expect(engine.builds[1].owner?.into).toBe(path.join(dir, 'compositions', 'promo-2'));
    expect(res.artifact?.payload).toMatchObject({ relPath: 'compositions/promo-2/v1.tsx' });
  });

  it('reports one progress line per change; queued says builds run one at a time', async () => {
    const progress: string[] = [];
    await generateCompositionTool.handler(
      { title: 'Promo', brief: 'b' },
      makeToolContext({ workspaceDir: dir, emitProgress: (d) => progress.push(d) }),
    );
    expect(progress).toEqual([
      'Promo',
      'Promo: queued (one build runs at a time)',
      'Promo: Round 1/3 · Rendering frames',
      'Promo: Complete',
    ]);
  });

  it('a failed build is a tool error, files nothing, and frees the folder', async () => {
    engine.options.outcome = 'error';
    engine.options.error = 'TSX generation needs Claude or OpenRouter';
    const res = await generateCompositionTool.handler({ title: 'X', brief: 'b' }, makeToolContext({ workspaceDir: dir }));
    expect(res.isError).toBe(true);
    expect(res.artifact).toBeUndefined();
    expect(res.content[0].text).toBe('The composition build failed: TSX generation needs Claude or OpenRouter');
    expect(await fs.readdir(path.join(dir, 'compositions'))).toEqual([]);
  });

  it('the run\'s signal cancels the job', async () => {
    engine.options.outcome = 'hang';
    const abort = new AbortController();
    const pending = generateCompositionTool.handler(
      { title: 'X', brief: 'b' },
      makeToolContext({ workspaceDir: dir, signal: abort.signal }),
    );
    await vi.waitFor(() => expect(engine.events.some((e) => e.status === 'generating')).toBe(true));
    abort.abort();
    const res = await pending;
    expect(engine.cancelled).toEqual(['job-1']);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe('The composition build was cancelled.');
  });
});

describe('generate_composition as a node (W8 Stage 3)', () => {
  const image = {
    id: 'image-set-1',
    kind: 'image-set' as const,
    title: 'Hero',
    createdAt: new Date().toISOString(),
    producer: { tool: 'generate_image', callId: 'c0' },
    payload: {
      items: [
        { relPath: 'flows/ad/hero.png', width: 1280, height: 720 },
        { relPath: 'flows/ad/alt.png', width: 1280, height: 720 },
      ],
    },
  };
  const clip = {
    id: 'video-1',
    kind: 'video' as const,
    title: 'Hero clip',
    createdAt: new Date().toISOString(),
    producer: { tool: 'generate_video', callId: 'c1' },
    payload: { relPath: 'flows/ad/hero.mp4', durationSeconds: 6 },
  };

  it('a flow build runs as origin flow, gets no images back, and puts port media in assets/', async () => {
    libraryRoot = path.join(dir, 'lib');
    const res = await generateCompositionTool.handler(
      { title: 'Ad', brief: 'sell it', referenceImage: 'image-set-1', referenceVideo: 'video-1' },
      makeToolContext({ workspaceDir: dir, artifacts: [image, clip], featureSource: 'flows', agentId: 'flow:f1' }),
    );
    const { request, owner } = engine.builds[0];
    expect(owner).toMatchObject({ origin: 'flow', usage: { featureSource: 'flows' } });
    expect(owner?.usage).not.toHaveProperty('agentId');
    expect(request.build?.assets).toEqual([
      { path: path.join(libraryRoot, 'flows/ad/hero.png'), name: 'hero.png' },
      // Same stem as the image: one lookup key would clash, so the video is renamed.
      { path: path.join(libraryRoot, 'flows/ad/hero.mp4'), name: 'hero-video.mp4' },
    ]);
    // Every image of the set (≤4), downscaled to the builder's 1024 px long side.
    expect(request.build?.referenceImages?.map((i) => Buffer.from(i.data, 'base64').toString())).toEqual([
      'jpeg 1024x512',
      'jpeg 1024x512',
    ]);
    expect(request.prompt).toContain("<Img src={staticFile('hero.png')} />");
    expect(request.prompt).toContain("<OffthreadVideo src={staticFile('hero-video.mp4')} />");
    expect(request.prompt).toContain('6.0 s');
    expect(res.images).toBeUndefined();
    expect(res.content[0].text).not.toContain('picture');
  });

  it('refuses a port artifact of the wrong kind before starting a build', async () => {
    const res = await generateCompositionTool.handler(
      { title: 'Ad', brief: 'sell it', referenceImage: 'video-1' },
      makeToolContext({ workspaceDir: dir, artifacts: [image, clip] }),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('is a video, not an image');
    expect(engine.builds).toEqual([]);
  });

  it("binds the build to the node's provider and model (required), and refuses an unusable one", async () => {
    await generateCompositionTool.handler(
      { title: 'X', brief: 'b', providerId: 'openrouter', model: 'anthropic/claude-sonnet-4.5', modelMode: 'required' },
      makeToolContext({ workspaceDir: dir, providerId: 'claude-subscription' }),
    );
    expect(engine.builds[0].request).toMatchObject({ providerId: 'openrouter', options: { model: 'anthropic/claude-sonnet-4.5' } });
    const res = await generateCompositionTool.handler(
      { title: 'X', brief: 'b', providerId: 'gemini', modelMode: 'required' },
      makeToolContext({ workspaceDir: dir }),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('requires gemini');
  });

  it('a per-node brand overrides the run brand, an empty field inherits it, null opts out', async () => {
    const ctx = makeToolContext({ workspaceDir: dir, brandId: 'run-brand' });
    await generateCompositionTool.handler({ title: 'X', brief: 'b', brandId: 'node-brand' }, ctx);
    await generateCompositionTool.handler({ title: 'X', brief: 'b', brandId: '' }, ctx);
    await generateCompositionTool.handler({ title: 'X', brief: 'b', brandId: null }, ctx);
    expect(readSessionBrandInstructions.mock.calls.map((c) => c[0])).toEqual(['node-brand', 'run-brand', undefined]);
  });
});

describe('generate_composition: budget, loop, images and the revise path (P3 part 7)', () => {
  const rejected = {
    id: 'composition-1',
    kind: 'composition' as const,
    title: 'Explainer',
    createdAt: new Date().toISOString(),
    producer: { tool: 'generate_composition', callId: 'c0' },
    version: 1,
    payload: { relPath: 'compositions/explainer/v1.tsx', config: CONFIG },
  };

  it("the node's select strings pass zod and reach the build: loop 'on' / 'off', 0 s = the builder picks", async () => {
    const parsed = z.object(generateCompositionTool.schema).safeParse({ title: 'X', brief: 'b', loop: 'on', generatedImages: 'off', durationSeconds: 0 });
    expect(parsed.success).toBe(true);
    await generateCompositionTool.handler({ title: 'X', brief: 'b', loop: 'on', durationSeconds: 0, budget: 'quick' }, makeToolContext({ workspaceDir: dir }));
    await generateCompositionTool.handler({ title: 'Y', brief: 'b', loop: 'off' }, makeToolContext({ workspaceDir: dir }));
    expect(engine.builds[0].request.build).toMatchObject({ budget: 'quick', format: { width: 1920, height: 1080, fps: 30, loop: true } });
    expect(engine.builds[0].request.build?.format).not.toHaveProperty('durationInFrames');
    expect(engine.builds[1].request.build?.format).not.toHaveProperty('loop');
  });

  it('generated images: a flow node is Off unless it says On; an agent keeps the builder default unless it says off', async () => {
    const flows = makeToolContext({ workspaceDir: dir, featureSource: 'flows' });
    const agent = makeToolContext({ workspaceDir: dir });
    await generateCompositionTool.handler({ title: 'A', brief: 'b' }, flows);
    await generateCompositionTool.handler({ title: 'B', brief: 'b', generatedImages: 'on' }, flows);
    await generateCompositionTool.handler({ title: 'C', brief: 'b' }, agent);
    await generateCompositionTool.handler({ title: 'D', brief: 'b', generatedImages: false }, agent);
    expect(engine.builds.map((b) => b.request.build?.maxGeneratedImages)).toEqual([0, undefined, undefined, 0]);
  });

  it('a revision edits the rejected version at the node budget and model, superseding it, in no new folder', async () => {
    const folder = path.join(dir, 'compositions', 'explainer');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'v1.tsx'), FAKE_BUILD_CODE, 'utf-8');
    const res = await generateCompositionTool.handler(
      {
        title: 'Explainer', brief: 'the script', budget: 'quick', styleNotes: 'Clean', reviseOf: 'composition-1', revision: '  bigger title  ',
        providerId: 'openrouter', model: 'anthropic/claude-sonnet-4.5', modelMode: 'required',
      },
      makeToolContext({ workspaceDir: dir, artifacts: [rejected], featureSource: 'flows' }),
    );
    expect(res.isError).toBeUndefined();
    expect(engine.builds).toHaveLength(1);
    expect(engine.builds[0].request).toEqual({
      kind: 'build',
      prompt: 'bigger title',
      providerId: 'openrouter',
      options: { model: 'anthropic/claude-sonnet-4.5' },
      build: { budget: 'quick', editOf: { folderPath: folder, version: 1 }, maxGeneratedImages: 0 },
    });
    expect(engine.builds[0].owner?.into).toBeUndefined();
    expect(res.supersedes).toBe('composition-1');
    expect(res.artifact?.payload).toMatchObject({ relPath: 'compositions/explainer/v2.tsx' });
    expect(await fs.readdir(path.join(dir, 'compositions'))).toEqual(['explainer']);
  });

  it('a blank revision builds anew', async () => {
    await generateCompositionTool.handler(
      { title: 'X', brief: 'b', reviseOf: 'composition-1', revision: '  ' },
      makeToolContext({ workspaceDir: dir, artifacts: [rejected] }),
    );
    expect(engine.builds[0].request.build).not.toHaveProperty('editOf');
    expect(engine.builds[0].owner?.into).toBe(path.join(dir, 'compositions', 'x'));
  });

  it("the node's fields: defaults the schema takes, each select's default among its options, revise on retry", () => {
    const ports = generateCompositionTool.ports!;
    expect(ports.defaultConfig).toMatchObject({ budget: 'standard', loop: 'off', generatedImages: 'off' });
    expect(z.object(generateCompositionTool.schema).partial().safeParse(ports.defaultConfig).success).toBe(true);
    for (const field of ports.configSchema) {
      if (field.kind === 'select') expect(field.options.map((o) => o.value), field.key).toContain(ports.defaultConfig[field.key]);
    }
    expect(ports.configSchema.find((f) => f.key === 'durationSeconds')).toMatchObject({ min: 0 });
    expect(ports.reviseOnRetry).toEqual({ artifactKey: 'reviseOf', noteKey: 'revision' });
  });
});
