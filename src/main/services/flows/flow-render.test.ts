// The runner over the five-node composition flow (flows plan §6): input_text
// → generate_text → generate_composition → render_composition →
// save_to_library, with the REAL registry and invokeTool, a fake LLM, a fake
// TSX pipeline, and a fake Remotion render standing in for the queue. What
// this proves: the render job settles in main (`flow-render.ts`), the MP4 is
// filed through the agents' reconciler and lands on the `video` port, the
// library copy happens, cancel reaches the render, and Resume reruns a
// failed render with a fresh job.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { FlowDoc, FlowRunDoc } from '../../../shared/types/flows';

let root = '';
let libraryRoot = '';
let renderBehaviour: 'ok' | 'fail' | 'hang' = 'ok';
const renders: Array<{ entryPath: string; outputPath: string; jobId?: string; compositionId?: string }> = [];

vi.mock('electron', () => ({
  app: { getPath: () => root, isPackaged: false, getAppPath: () => root, getVersion: () => '1.0.0' },
}));
vi.mock('../../utils/paths', () => ({
  getAssetsDir: () => root,
  getRemotionBinariesDir: () => null,
  getAppRoot: () => root,
  getProjectsDir: () => path.join(root, 'projects'),
}));
vi.mock('../library/library-paths', async () => {
  const actual = await vi.importActual<typeof import('../library/library-paths')>('../library/library-paths');
  return {
    ...actual,
    ensureLibraryRoot: async () => libraryRoot,
    getLibraryRoot: () => libraryRoot,
    resolveLibraryPath: (r: string, rel: string) => path.join(r, rel),
  };
});
vi.mock('../frame-extractor', () => ({ probeVideo: async () => ({ duration: 6, width: 1920, height: 1080, fps: 30 }) }));
vi.mock('../../ipc/llm-handlers', () => ({
  runLlmGenerate: async (req: { prompt: string }) => ({ success: true, text: `SCRIPT for ${req.prompt}` }),
}));
vi.mock('../../../shared/tsx-engine', () => ({
  generateTsxPipeline: async () => ({ text: "import {AbsoluteFill} from 'remotion';\nexport const compositionConfig = {};", transpileValid: true, fixAttempts: 0 }),
  editTsxPipeline: async () => ({ text: '', transpileValid: false, fixAttempts: 0 }),
}));
vi.mock('../agents/tsx-deps', () => ({ buildAgentTsxDeps: () => ({}) }));
vi.mock('../module-server', () => ({
  ensureModuleServer: async () => 4001,
  getModuleServerBaseUrl: () => 'http://localhost:4001',
  storeTranspileResult: () => 'http://localhost:4001/modules/h1.js',
}));
vi.mock('../tsx-transpiler', () => ({
  transpileTsxSource: async () => ({
    success: true, code: 'js', hash: 'h1', componentName: 'Main',
    config: { id: 'main', durationInFrames: 180, fps: 30, width: 1920, height: 1080 },
  }),
}));
vi.mock('../settings', async () => {
  const actual = await vi.importActual<typeof import('../settings')>('../settings');
  return {
    ...actual,
    getLlmProviders: async () => ({ providers: [], activeProvider: undefined }),
  };
});
vi.mock('../media/remotion-render', () => ({
  renderTsxToMp4: async (opts: { entryPath: string; outputPath: string; jobId?: string; compositionId?: string; signal?: AbortSignal; onProgress?: (p: string, n: number) => void }) => {
    renders.push({ entryPath: opts.entryPath, outputPath: opts.outputPath, jobId: opts.jobId, compositionId: opts.compositionId });
    if (renderBehaviour === 'fail') throw new Error('Chromium crashed');
    if (renderBehaviour === 'hang') {
      await new Promise<void>((resolve) => opts.signal?.addEventListener('abort', () => resolve(), { once: true }));
      throw new Error('renderMedia() got cancelled');
    }
    opts.onProgress?.('rendering', 50);
    await fs.mkdir(path.dirname(opts.outputPath), { recursive: true });
    await fs.writeFile(opts.outputPath, 'mp4');
    return { outputPath: opts.outputPath, fileSize: 3, width: 1920, height: 1080, fps: 30, durationInFrames: 180 };
  },
}));

const { getNode } = await import('../agents/tools/registry');
const { invokeTool } = await import('../agents/tools/invoke-tool');
const { openRunArtifacts, readRunDoc, writeRunDoc } = await import('./flow-run-store');
const { settleJob } = await import('./flow-jobs');
const { FlowRunner } = await import('./flow-runner');

const ALL = { imageProvider: true, videoProvider: true, audioProvider: true };

const doc: FlowDoc = {
  formatVersion: 2,
  id: '01J8Z3M9K2N4P5Q6R7S8T9V0EX',
  name: 'Explainer test',
  description: '',
  params: [{ id: 'topic', label: 'Topic', kind: 'prompt', bind: [{ nodeId: 'n-topic', key: 'prompt' }] }],
  graph: {
    nodes: [
      { id: 'n-topic', toolId: 'input_text', position: { x: 0, y: 0 }, config: { prompt: '' }, pause: false },
      { id: 'n-script', toolId: 'generate_text', position: { x: 1, y: 0 }, config: { promptPrefix: 'Script:', modelMode: 'default' }, pause: false },
      { id: 'n-compose', toolId: 'generate_composition', position: { x: 2, y: 0 }, config: { title: 'Explainer', durationSeconds: 6 }, pause: false },
      { id: 'n-render', toolId: 'render_composition', position: { x: 3, y: 0 }, config: { name: 'explainer' }, pause: false },
      { id: 'n-save', toolId: 'save_to_library', position: { x: 4, y: 0 }, config: { folder: 'generated/explainers' }, pause: false },
    ],
    edges: [
      { id: 'e1', source: 'n-topic', sourceHandle: 'text', target: 'n-script', targetHandle: 'prompt' },
      { id: 'e2', source: 'n-script', sourceHandle: 'text', target: 'n-compose', targetHandle: 'brief' },
      { id: 'e3', source: 'n-compose', sourceHandle: 'composition', target: 'n-render', targetHandle: 'composition' },
      { id: 'e4', source: 'n-render', sourceHandle: 'video', target: 'n-save', targetHandle: 'video' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
  outputs: [{ nodeId: 'n-render', handle: 'video', label: 'Video' }],
  origin: null,
};

function runner() {
  return new FlowRunner({
    registry: { getNode },
    capabilities: async () => ALL,
    invoke: invokeTool,
    store: {
      runDir: (flowId, runId) => path.join(root, 'flows', flowId, 'runs', runId),
      writeDoc: writeRunDoc,
      readDoc: readRunDoc,
      openArtifacts: openRunArtifacts,
      persistSummary: async () => {},
    },
    settleJob,
    emit: () => {},
  });
}

const base = { doc, mode: 'unattended' as const, params: { topic: 'flows' }, flowVersion: '1', libraryFolder: 'flows/explainer-test' };

async function run(runId: string): Promise<FlowRunDoc> {
  return (await readRunDoc(path.join(root, 'flows', doc.id, 'runs', runId))) as FlowRunDoc;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-render-'));
  libraryRoot = path.join(root, 'assets');
  await fs.mkdir(libraryRoot, { recursive: true });
  renders.length = 0;
  renderBehaviour = 'ok';
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('the five-node composition flow through a main-side render', () => {
  it('renders the composition in main, files the MP4 on the video port, and saves it to the library folder', async () => {
    const r = runner();
    const { runId } = await r.start(base);
    await r.wait(runId);
    const state = await run(runId);
    expect(state.status, state.error ?? '').toBe('success');
    expect(Object.values(state.nodes).map((n) => n.status)).toEqual(['done', 'done', 'done', 'done', 'done']);

    // The render was asked for the composition's TSX in the run's workspace, with the tool's job id.
    expect(renders).toHaveLength(1);
    expect(renders[0].entryPath).toBe(path.join(root, 'flows', doc.id, 'runs', runId, 'files', 'compositions', 'explainer.tsx'));
    expect(renders[0].outputPath).toBe(path.join(libraryRoot, 'flows', 'explainer-test', 'explainer.mp4'));
    expect(renders[0].compositionId).toBe('main');

    // The job artifact settled through the agents' reconciler; the video is on the port.
    const artifacts = await openRunArtifacts(path.join(root, 'flows', doc.id, 'runs', runId));
    const job = artifacts.list().find((a) => a.kind === 'job');
    expect(job?.kind === 'job' ? job.payload : null).toMatchObject({ job: 'render', status: 'completed', outputRelPath: 'flows/explainer-test/explainer.mp4', resultArtifactId: 'video-3' });
    expect(renders[0].jobId).toBe(job?.kind === 'job' ? job.payload.jobId : '');
    expect(state.nodes['n-render'].outputs).toEqual({ video: { kind: 'artifact', artifactId: 'video-3', artifactKind: 'video' } });
    const video = artifacts.get('video-3');
    expect(video?.kind === 'video' ? video.payload : null).toMatchObject({ relPath: 'flows/explainer-test/explainer.mp4', durationSeconds: 6, width: 1920 });
    expect(state.nodes['n-render'].notes).toEqual(expect.arrayContaining([expect.stringContaining('Rendering… 50%')]));

    // save_to_library copied it into the folder and put the copy on its video port only.
    expect(await fs.readFile(path.join(libraryRoot, 'generated', 'explainers', 'explainer.mp4'), 'utf-8')).toBe('mp4');
    expect(Object.keys(state.nodes['n-save'].outputs ?? {})).toEqual(['video']);
    expect(state.nodes['n-script'].outputs).toEqual({ text: { kind: 'text', value: 'SCRIPT for Script:\n\nflows' } });
  });

  it('a failed render marks the node error with the reason; Resume reruns it with a fresh job and succeeds', async () => {
    renderBehaviour = 'fail';
    const r = runner();
    const { runId } = await r.start(base);
    await r.wait(runId);
    let state = await run(runId);
    expect(state.status).toBe('error');
    expect(state.nodes['n-render']).toMatchObject({ status: 'error', error: expect.stringContaining('Chromium crashed') });
    expect(state.nodes['n-save'].status).toBe('skipped');

    renderBehaviour = 'ok';
    await r.resume({ ...base, runId });
    await r.wait(runId);
    state = await run(runId);
    expect(state.status).toBe('success');
    expect(state.nodes['n-render'].attempts).toBe(2);
    expect(renders).toHaveLength(2);
    expect(renders[1].jobId).not.toBe(renders[0].jobId);
    // The failed render left no file, so the same output name is free again.
    expect(renders[1].outputPath).toBe(path.join(libraryRoot, 'flows', 'explainer-test', 'explainer.mp4'));
    const artifacts = await openRunArtifacts(path.join(root, 'flows', doc.id, 'runs', runId));
    const jobs = artifacts.list().filter((a) => a.kind === 'job');
    expect(jobs.map((j) => (j.kind === 'job' ? j.payload.status : ''))).toEqual(['failed', 'completed']);
  });

  it('cancel reaches the render through the signal; the job is cancelled and the node skipped', async () => {
    renderBehaviour = 'hang';
    const r = runner();
    const { runId } = await r.start(base);
    while (renders.length === 0) await new Promise((res) => setTimeout(res, 10));
    expect(r.cancel(runId)).toBe(true);
    await r.wait(runId);
    const state = await run(runId);
    expect(state.status).toBe('cancelled');
    expect(state.nodes['n-render'].status).toBe('skipped');
    const artifacts = await openRunArtifacts(path.join(root, 'flows', doc.id, 'runs', runId));
    const job = artifacts.list().find((a) => a.kind === 'job');
    expect(job?.kind === 'job' ? job.payload.status : '').toBe('cancelled');
  });
});
