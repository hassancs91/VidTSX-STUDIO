// The shot generator on the TSX builder (P3 part 5), against the fake job
// engine (agents/tools/test-build-engine.ts) and real shot folders on disk:
// what each op asks the builder for, the events the renderer folds, and
// cancel for every op.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import type { StudioMediaAsset } from '../../../shared/types/studio';
import type { StudioShotJobEvent } from '../../../shared/ipc/types';

let tmpDir = '';
let projectDir = '';
const project = {
  id: 'p1',
  settings: { width: 1920, height: 1080, fps: 30, agent: {} } as Record<string, unknown>,
  assets: [] as StudioMediaAsset[],
  shots: [] as Array<Record<string, unknown>>,
};

vi.mock('electron', () => ({ app: { getPath: () => tmpDir, isPackaged: false, getAppPath: () => tmpDir } }));
vi.mock('../../ipc/llm-handlers', () => ({ runLlmGenerate: vi.fn() }));
vi.mock('../../ipc/tsx-handlers', () => ({ validateTsxCode: vi.fn() }));
vi.mock('./project-store', () => ({ loadProject: async () => structuredClone(project) }));
vi.mock('./studio-paths', () => ({
  getProjectDir: async () => projectDir,
  getProjectCacheDir: async () => path.join(projectDir, 'cache'),
  getShotVersionPath: async (_p: string, shotId: string, version: number) => path.join(projectDir, 'shots', shotId, `v${version}.tsx`),
}));
vi.mock('./asset-transcriber', () => ({
  readTranscriptFile: async () => ({
    words: [
      { text: 'Welcome', start: 1.0, end: 1.4 },
      { text: 'back', start: 1.5, end: 1.8 },
    ],
  }),
}));
vi.mock('./project-brand', () => ({ resolveProjectBrand: async () => null }));
vi.mock('./agent-memory', () => ({ listMemories: async () => [] }));
vi.mock('./shot-kit', () => ({ getShotKitPromptInfo: async () => ({ version: '1.0.0', manifest: '# KIT MANIFEST' }) }));
const importMediaFiles = vi.fn(async (_projectId: string, paths: string[]) => ({
  assets: paths.map((p, i) => ({ id: `new-${i + 1}`, kind: 'image', path: p, probe: { duration: 0 } })),
  errors: [],
}));
vi.mock('./media-import', async (original) => ({
  ...(await original<typeof import('./media-import')>()),
  importMediaFiles: (projectId: string, paths: string[]) => importMediaFiles(projectId, paths),
}));

import { fakeBuildEngine, type FakeBuildEngine } from '../agents/tools/test-build-engine';
import { setBuildEngineForTests } from '../tsx-jobs/build-engine';
import { shotDefaults, shotGenerator, ShotCancelledError, WAITING_MESSAGE } from './shot-generator';

const CODE = "export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 150 };\nexport default () => null;";
let engine: FakeBuildEngine;
let events: StudioShotJobEvent[];
let off: () => void;

/** Wait until the fake engine holds the build. A new shot reserves its folder
 *  on real disk before the run is tracked, so one timer tick is not enough
 *  under a loaded full suite: the cancel would miss, and the hung run would
 *  outlive its test (later tests then read "already building"). */
const buildStarted = (count = 1) =>
  vi.waitFor(() => expect(engine.builds.length).toBeGreaterThanOrEqual(count), { timeout: 4000, interval: 5 });

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-generator-'));
  projectDir = path.join(tmpDir, 'project');
  await fs.mkdir(path.join(projectDir, 'shots'), { recursive: true });
  await fs.mkdir(path.join(projectDir, 'cache', 'proxies'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'cache', 'proxies', 'talk.mp4'), 'proxy');
  await fs.writeFile(path.join(tmpDir, 'logo.png'), 'png');
  project.assets = [
    {
      id: 'talk',
      kind: 'video',
      path: path.join(tmpDir, 'talk.mp4'),
      probe: { duration: 39.4, width: 640, height: 360 },
      proxy: { path: 'proxies/talk.mp4', status: 'ready' },
    } as StudioMediaAsset,
    { id: 'logo', kind: 'image', path: path.join(tmpDir, 'logo.png'), probe: { duration: 0, width: 512, height: 512 } } as StudioMediaAsset,
  ];
  project.shots = [];
  engine = fakeBuildEngine({ code: CODE });
  setBuildEngineForTests(engine);
  events = [];
  off = shotGenerator.onEvent((e) => events.push(e));
  importMediaFiles.mockClear();
});

afterEach(async () => {
  off();
  setBuildEngineForTests(null);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('generate', () => {
  it('builds a new overlay into its reserved folder, looked at over the footage under the playhead', async () => {
    let reserved = '';
    const { shot, build } = await shotGenerator.generate({
      projectId: 'p1',
      kind: 'overlay',
      brief: 'A badge that says LIVE.',
      name: 'Live badge',
      durationSeconds: 5,
      assetRefs: { logo: 'logo' },
      footage: { assetId: 'talk', sourceSeconds: 12.5 },
      origin: { by: 'user' },
      onReserved: (id) => (reserved = id),
    });
    const folder = path.join(projectDir, 'shots', 'live-badge');
    expect(reserved).toBe('live-badge');
    const { request, owner } = engine.builds[0];
    const { packs, ...rest } = owner!;
    expect(rest).toEqual({
      origin: 'studio',
      into: folder,
      usage: { featureSource: 'studio-tsx-shot' },
      studioShot: {
        transparent: true,
        backdrop: { file: path.join(projectDir, 'cache', 'proxies', 'talk.mp4'), startSeconds: 12.5, label: 'talk.mp4 from 12.5 s' },
      },
    });
    expect(request.build).toMatchObject({
      budget: 'standard',
      format: { width: 1920, height: 1080, fps: 30, durationInFrames: 150 },
      assets: [{ path: path.join(tmpDir, 'logo.png'), name: 'logo.png' }],
      threadText: 'A badge that says LIVE.',
    });
    // Composed in code, so it rides the main-only owner; the IPC request names no craft packs.
    expect(packs![0].name).toBe('studio-shot');
    expect(packs![0].body).toContain('# KIT MANIFEST');
    expect(request.build!.packs).toBeUndefined();
    expect(request.prompt).toMatch(/^STUDIO SHOT, 5\.0 s: An OVERLAY/);
    expect(request.prompt).toContain("logo.png (image, 512x512). <Img src={staticFile('logo.png')} />");

    expect(shot).toMatchObject({ id: 'live-badge', name: 'Live badge', kind: 'overlay', status: 'ready', activeVersion: 1, assetRefs: { logo: 'logo' } });
    expect(shot.config).toEqual({ durationInFrames: 150, fps: 30, width: 1920, height: 1080 });
    expect(build?.stills.length).toBeGreaterThan(0);
    // The pool shows it from the first event; a queued build says it waits.
    expect(events[0]).toMatchObject({ op: 'generate', status: 'generating', message: 'Starting…', shot: { status: 'generating' } });
    expect(events.some((e) => e.message === WAITING_MESSAGE)).toBe(true);
    expect(events.some((e) => e.message === 'Round 1/3 · Rendering frames' && e.percent === 30 && e.shot)).toBe(true);
    expect(events.at(-1)).toMatchObject({ op: 'generate', status: 'ready', shot: { activeVersion: 1, status: 'ready' } });
  });

  it('registers the files the version loads as project media, keeping the ids the shot already had', async () => {
    engine.options.code = `${CODE}\nconst a = __vidtsxAsset('logo.png'); const b = __vidtsxAsset('chart.png');`;
    const { shot } = await shotGenerator.generate({
      projectId: 'p1',
      kind: 'cutaway',
      brief: 'A chart.',
      name: 'Chart',
      assetRefs: { logo: 'logo' },
      origin: { by: 'agent' },
      onReserved: (id) => {
        // What the builder would save beside v1 — written synchronously, so the
        // files are there before the build ends (and before afterEach removes the dir).
        const dir = path.join(projectDir, 'shots', id, 'v1.assets');
        fsSync.mkdirSync(dir, { recursive: true });
        fsSync.writeFileSync(path.join(dir, 'logo.png'), 'png');
        fsSync.writeFileSync(path.join(dir, 'chart.png'), 'png');
      },
    });
    expect(engine.builds[0].owner?.studioShot).toEqual({ transparent: false });
    expect(importMediaFiles).toHaveBeenCalledTimes(1);
    expect(importMediaFiles.mock.calls[0][1]).toEqual([path.join(projectDir, 'shots', 'chart', 'v1.assets', 'chart.png')]);
    expect(shot.assetRefs).toEqual({ logo: 'logo', chart: 'new-1' });
    expect(events.at(-1)?.importedAssets?.map((a) => a.id)).toEqual(['new-1']);
  });

  it('an anchored title bakes its words and is looked at over the anchor footage', async () => {
    await shotGenerator.generate({
      projectId: 'p1',
      kind: 'title',
      brief: 'Welcome back, word by word.',
      anchor: { assetId: 'talk', sourceStart: 0.9, sourceEnd: 2.0 },
      origin: { by: 'agent' },
    });
    const { request, owner } = engine.builds[0];
    expect(owner?.studioShot?.backdrop).toMatchObject({ startSeconds: 0.9 });
    expect(request.build!.format).toMatchObject({ durationInFrames: 33 });
    expect(request.prompt).toContain('{ text: "Welcome", start: 0.1, end: 0.5 },');
  });

  it('a transparent shot with no footage under it is looked at over a checkerboard', async () => {
    await shotGenerator.generate({ projectId: 'p1', kind: 'overlay', brief: 'Arrow.', origin: { by: 'agent' } });
    expect(engine.builds[0].owner?.studioShot).toEqual({ transparent: true });
  });

  it('a cancelled new shot leaves no folder and says canceled, not error', async () => {
    engine.options.outcome = 'hang';
    let id = '';
    const run = shotGenerator.generate({
      projectId: 'p1',
      kind: 'cutaway',
      brief: 'Stats.',
      name: 'Stats',
      origin: { by: 'user' },
      onReserved: (shotId) => (id = shotId),
    });
    await buildStarted();
    expect(shotGenerator.isRunning('p1', id)).toBe(true);
    expect(shotGenerator.cancel('p1', id)).toBe(true);
    await expect(run).rejects.toBeInstanceOf(ShotCancelledError);
    expect(engine.cancelled).toEqual(['job-1']);
    expect(events.at(-1)).toEqual({ projectId: 'p1', shotId: 'stats', op: 'generate', status: 'canceled' });
    await expect(fs.stat(path.join(projectDir, 'shots', 'stats'))).rejects.toThrow();
    expect(shotGenerator.isRunning('p1', id)).toBe(false);
    expect(shotGenerator.cancel('p1', id)).toBe(false);
  });

  it("the caller's signal (an assistant turn) cancels the build too", async () => {
    engine.options.outcome = 'hang';
    const turn = new AbortController();
    const run = shotGenerator.generate({ projectId: 'p1', kind: 'cutaway', brief: 'Stats.', origin: { by: 'agent' }, signal: turn.signal });
    await buildStarted();
    turn.abort();
    await expect(run).rejects.toBeInstanceOf(ShotCancelledError);
  });

  it('a failed new shot stays as an error shot with its empty folder', async () => {
    engine.options.outcome = 'error';
    engine.options.error = 'No build passed check.';
    await expect(
      shotGenerator.generate({ projectId: 'p1', kind: 'cutaway', brief: 'Stats.', name: 'Stats', origin: { by: 'user' } }),
    ).rejects.toThrow('No build passed check.');
    expect(events.at(-1)).toMatchObject({ status: 'error', error: 'No build passed check.', shot: { status: 'error', error: 'No build passed check.' } });
    expect((await fs.stat(path.join(projectDir, 'shots', 'stats'))).isDirectory()).toBe(true);
  });
});

describe('regenerate', () => {
  it('is a fresh build saved as the next version, and leaves the registry alone until it is ready', async () => {
    const folder = path.join(projectDir, 'shots', 'badge');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'v1.tsx'), CODE);
    const { shot } = await shotGenerator.generate(
      { projectId: 'p1', kind: 'cutaway', brief: 'Badge.', budget: 'craft', origin: { by: 'user' } },
      'badge',
    );
    expect(engine.builds[0].owner).toMatchObject({ into: folder, retake: true });
    expect(engine.builds[0].request.build).toMatchObject({ budget: 'craft' });
    expect(engine.builds[0].request.build).not.toHaveProperty('editOf');
    expect(shot.activeVersion).toBe(2);
    expect(events.filter((e) => e.status === 'generating').every((e) => e.shot === undefined)).toBe(true);
    expect(events.at(-1)).toMatchObject({ op: 'regenerate', status: 'ready', shot: { activeVersion: 2 } });
  });

  it('a cancelled or failed retake leaves the shot as it was', async () => {
    const folder = path.join(projectDir, 'shots', 'badge');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'v1.tsx'), CODE);
    engine.options.outcome = 'error';
    await expect(shotGenerator.generate({ projectId: 'p1', kind: 'cutaway', brief: 'Badge.', origin: { by: 'user' } }, 'badge')).rejects.toThrow();
    expect(events.at(-1)).toMatchObject({ op: 'regenerate', status: 'error' });
    expect(events.at(-1)).not.toHaveProperty('shot');

    engine.options.outcome = 'hang';
    const run = shotGenerator.generate({ projectId: 'p1', kind: 'cutaway', brief: 'Badge.', origin: { by: 'user' } }, 'badge');
    await buildStarted(2);
    shotGenerator.cancel('p1', 'badge');
    await expect(run).rejects.toBeInstanceOf(ShotCancelledError);
    expect(engine.cancelled).toEqual(['job-2']);
    expect(events.at(-1)).toEqual({ projectId: 'p1', shotId: 'badge', op: 'regenerate', status: 'canceled' });
    expect(await fs.readdir(folder)).toEqual(['v1.tsx']);
  });
});

describe('edit and refine', () => {
  const folder = () => path.join(projectDir, 'shots', 'badge');
  beforeEach(async () => {
    await fs.mkdir(folder(), { recursive: true });
    await fs.writeFile(path.join(folder(), 'v1.tsx'), CODE);
  });

  it('an edit is a builder edit of the active version at the picked budget, with the shot media it lacks', async () => {
    const { shot } = await shotGenerator.edit({
      projectId: 'p1',
      shotId: 'badge',
      activeVersion: 1,
      instruction: 'Make it amber.',
      budget: 'quick',
      kind: 'overlay',
      assetRefs: { logo: 'logo' },
      footage: { assetId: 'talk', sourceSeconds: 3 },
    });
    const { request, owner } = engine.builds[0];
    expect(request.build).toMatchObject({ budget: 'quick', editOf: { folderPath: folder(), version: 1 }, threadText: 'Make it amber.' });
    expect(request.build!.assets).toEqual([{ path: path.join(tmpDir, 'logo.png'), name: 'logo.png' }]);
    expect(request.prompt.split('\n')[0]).toBe('Make it amber.');
    expect(owner).toMatchObject({ origin: 'studio', studioShot: { transparent: true, backdrop: { startSeconds: 3 } } });
    expect(owner).not.toHaveProperty('into');
    expect(shot).toMatchObject({ id: 'badge', activeVersion: 2, status: 'ready' });
    expect(events[0]).toMatchObject({ op: 'edit', status: 'generating', message: 'Editing…' });
    expect(events.at(-1)).toMatchObject({ op: 'edit', status: 'ready' });
  });

  it('does not copy media the versions already carry; Standard is the default budget', async () => {
    await fs.mkdir(path.join(folder(), 'v1.assets'), { recursive: true });
    await fs.writeFile(path.join(folder(), 'v1.assets', 'logo.png'), 'png');
    await shotGenerator.edit({ projectId: 'p1', shotId: 'badge', activeVersion: 1, instruction: 'x', kind: 'cutaway', assetRefs: { logo: 'logo' } });
    expect(engine.builds[0].request.build).toMatchObject({ budget: 'standard' });
    expect(engine.builds[0].request.build).not.toHaveProperty('assets');
  });

  it('a refine is a Quick builder edit that keeps the contract and fixes only what its frames show', async () => {
    await shotGenerator.refine({ projectId: 'p1', shotId: 'badge', activeVersion: 1, kind: 'cutaway', brief: 'Three stats.' });
    const { request } = engine.builds[0];
    expect(request.build).toMatchObject({ budget: 'quick', editOf: { folderPath: folder(), version: 1 }, threadText: 'Refine v1' });
    expect(request.prompt).toMatch(/^REFINE: /);
    expect(request.prompt).toContain('Three stats.');
  });

  it('one run per shot: a second op is refused while the first builds, and a cancel leaves the version', async () => {
    engine.options.outcome = 'hang';
    const first = shotGenerator.refine({ projectId: 'p1', shotId: 'badge', activeVersion: 1, kind: 'cutaway' });
    await expect(shotGenerator.edit({ projectId: 'p1', shotId: 'badge', activeVersion: 1, instruction: 'x' })).rejects.toThrow(/already building/);
    await buildStarted();
    shotGenerator.cancel('p1', 'badge');
    await expect(first).rejects.toBeInstanceOf(ShotCancelledError);
    expect(events.at(-1)).toEqual({ projectId: 'p1', shotId: 'badge', op: 'refine', status: 'canceled' });
    expect(await fs.readdir(folder())).toEqual(['v1.tsx']);
  });

  it('a missing version is an error event, not a silent end', async () => {
    await expect(shotGenerator.edit({ projectId: 'p1', shotId: 'badge', activeVersion: 7, instruction: 'x' })).rejects.toThrow(/v7/);
    expect(events.at(-1)).toMatchObject({ op: 'edit', status: 'error' });
    expect(engine.builds).toEqual([]);
  });
});

describe('convert (P3 part 8)', () => {
  const folder = () => path.join(projectDir, 'shots', 'tone-beat');
  beforeEach(async () => {
    await fs.mkdir(folder(), { recursive: true });
    await fs.writeFile(path.join(folder(), 'v1.tsx'), CODE);
  });

  it('is a Quick builder edit of the version that names the problems, with op "import" events', async () => {
    const { shot } = await shotGenerator.convert({
      projectId: 'p1',
      shotId: 'tone-beat',
      activeVersion: 1,
      kind: 'cutaway',
      problems: ['Import "tone" is not allowed', 'Bundling it into one Studio shot did not work: Package "tone" is not available to shots'],
      providerId: 'claude-subscription',
      model: 'claude-sonnet-5-5',
    });
    const { request, owner } = engine.builds[0];
    expect(request).toMatchObject({ providerId: 'claude-subscription', options: { model: 'claude-sonnet-5-5' } });
    expect(request.build).toMatchObject({ budget: 'quick', editOf: { folderPath: folder(), version: 1 }, threadText: 'Convert v1 for Studio' });
    expect(request.prompt).toMatch(/^CONVERT FOR STUDIO: /);
    expect(request.prompt).toContain('- Import "tone" is not allowed');
    expect(request.prompt).toContain('Package "tone" is not available to shots');
    expect(request.prompt).toContain('fewest changes');
    expect(request.prompt).toContain('no synthesized audio');
    expect(owner).toMatchObject({ origin: 'studio', studioShot: { transparent: false } });
    expect(shot).toMatchObject({ id: 'tone-beat', activeVersion: 2, status: 'ready' });
    expect(events[0]).toMatchObject({ op: 'import', status: 'generating', message: 'Converting…' });
    expect(events.at(-1)).toMatchObject({ op: 'import', status: 'ready', shot: { activeVersion: 2 } });
  });

  it('its ready snapshot carries every ref the shot keeps (the renderer adopts an import snapshot whole)', async () => {
    await shotGenerator.convert({ projectId: 'p1', shotId: 'tone-beat', activeVersion: 1, kind: 'cutaway', assetRefs: { logo: 'logo' }, problems: ['x'] });
    expect(events.at(-1)).toMatchObject({ op: 'import', status: 'ready', shot: { assetRefs: { logo: 'logo' } } });
  });

  it('a cancel stops it like any other op: a canceled event, the version left as it was', async () => {
    engine.options.outcome = 'hang';
    const run = shotGenerator.convert({ projectId: 'p1', shotId: 'tone-beat', activeVersion: 1, kind: 'cutaway', problems: ['x'] });
    await buildStarted();
    expect(shotGenerator.isRunning('p1', 'tone-beat')).toBe(true);
    shotGenerator.cancel('p1', 'tone-beat');
    await expect(run).rejects.toBeInstanceOf(ShotCancelledError);
    expect(events.at(-1)).toEqual({ projectId: 'p1', shotId: 'tone-beat', op: 'import', status: 'canceled' });
    expect(await fs.readdir(folder())).toEqual(['v1.tsx']);
  });
});

describe('shotDefaults', () => {
  it('is the project provider with its shot model, else its model, else nothing', () => {
    expect(shotDefaults({ providerId: 'openrouter', model: 'a', shotModel: 'b' })).toEqual({ providerId: 'openrouter', model: 'b' });
    expect(shotDefaults({ model: 'a' })).toEqual({ model: 'a' });
    expect(shotDefaults({})).toEqual({});
    expect(shotDefaults(undefined)).toEqual({});
  });
});
