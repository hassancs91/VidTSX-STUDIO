// The Studio `run_flow` (W8 Stage 4) with a fake runner: the range becomes a
// clip that fills the flow's video param, the run starts unattended with the
// PROJECT's brand, the video output is imported on use and the answer names
// the asset id and the insert_asset call; a flow without a video param
// refuses a range; a failed run is reported with the node.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FlowDoc, FlowRunDoc } from '../../../../shared/types/flows';
import type { StudioToolContext } from './types';
import { setRenderRangeDepsForTests } from './flow-range';

const fake = vi.hoisted(() => ({ start: vi.fn(), get: vi.fn(), doc: null as FlowDoc | null, imported: vi.fn() }));

vi.mock('../../flows/flow-service', () => ({
  flowService: {
    start: (req: unknown) => fake.start(req),
    wait: async () => {},
    get: (runId: string) => fake.get(runId),
    cancel: () => true,
    onEvent: () => () => {},
  },
  loadFlowDoc: () => ({ doc: fake.doc, version: '1' }),
  resolveFlowRef: (ref: string) => (ref === 'nope' ? { error: `No flow "${ref}".` } : { id: 'flow-1', name: fake.doc?.name ?? 'x' }),
  listFlowDocs: () => [],
}));
vi.mock('../../agents/tools/flow-listing', () => ({
  installedFlowsListing: () => 'LISTING',
  pricedSummary: () => 'Priced steps: generate_video (kling-2.5-turbo-pro, 5 s ≈ $0.40) — expect about $0.40.',
}));
vi.mock('../../agents/tools/registry-core', () => ({ getNode: () => undefined }));
vi.mock('../../../utils/paths', () => ({ getTempDir: () => 'C:/tmp/vidtsx' }));
vi.mock('fs/promises', () => ({ default: { mkdir: async () => undefined } }));
vi.mock('../project-store', () => ({
  loadProject: async () => ({
    settings: { brandId: 'acme-test' },
    assets: [{ id: 'a1', kind: 'video', path: 'C:/clips/talk.mp4', probe: { duration: 60 } }],
    timeline: {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips: Array.from({ length: 20 }, (_, i) => ({ id: `c${i + 1}`, kind: 'video', assetId: 'a1', timelineStart: i * 3, duration: 3, sourceIn: i * 3 })) },
      ],
    },
  }),
}));
vi.mock('./library-import', () => ({
  importLibraryFile: (ctx: unknown, relPath: string) => fake.imported(ctx, relPath),
}));

const { buildFlowTools } = await import('./flow-tools');

interface ToolLike {
  name: string;
  description: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

function makeCtx(): { ctx: StudioToolContext; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: (e: Record<string, unknown>) => events.push(e),
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return { ctx, events };
}

function addEffect(): FlowDoc {
  return {
    formatVersion: 2,
    id: 'flow-1',
    name: 'Add an effect',
    description: '',
    params: [
      { id: 'video', label: 'Video', kind: 'video', required: true, bind: [{ nodeId: 'n-video', key: 'filePath' }] },
      { id: 'effect', label: 'Effect', kind: 'prompt', required: true, bind: [{ nodeId: 'n-text', key: 'prompt' }] },
    ],
    graph: {
      nodes: [
        { id: 'n-video', toolId: 'input_video_file', position: { x: 0, y: 0 }, config: { filePath: '' }, pause: false },
        { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: { prompt: '' }, pause: false },
        { id: 'n-clip', toolId: 'generate_video', position: { x: 0, y: 0 }, config: {}, pause: false },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [{ nodeId: 'n-clip', handle: 'video', label: 'Video' }],
    origin: null,
  };
}

function run(status: FlowRunDoc['status']): FlowRunDoc {
  return {
    id: 'run-1', flowId: 'flow-1', flowVersion: '1', mode: 'unattended', params: {}, status, startedAt: 0, finishedAt: 10, error: status === 'error' ? 'Kling refused' : null,
    nodes: { 'n-clip': status === 'success' ? { status: 'done', attempts: 1, outputs: { video: { kind: 'artifact', artifactId: 'video-1', artifactKind: 'video' } } } : { status: 'error', attempts: 1, error: 'Kling refused' } },
    pending: null,
  };
}

const trims: Array<{ start: number; end: number; output: string }> = [];

beforeEach(() => {
  trims.length = 0;
  fake.doc = addEffect();
  fake.start.mockReset().mockResolvedValue({ runId: 'run-1' });
  fake.get.mockReset().mockResolvedValue({
    run: run('success'),
    artifacts: [{ id: 'video-1', kind: 'video', title: 'clip', createdAt: 'now', producer: { tool: 'generate_video', callId: 'c' }, payload: { relPath: 'flows/add-an-effect/clip.mp4', durationSeconds: 5 } }],
    assetUrls: {},
    resumable: false,
  });
  fake.imported.mockReset().mockResolvedValue({ id: 'asset-9', kind: 'video', path: 'C:/lib/flows/add-an-effect/clip.mp4', probe: { duration: 5 } });
  setRenderRangeDepsForTests({
    trim: async (o) => {
      trims.push({ start: o.startSeconds, end: o.endSeconds, output: o.output });
      return { duration: o.endSeconds - o.startSeconds, width: 1920, height: 1080, fps: 30, hasVideo: true, hasAudio: true };
    },
    concat: async () => ({ duration: 0, width: 0, height: 0, fps: 0, hasVideo: true, hasAudio: true }),
  });
});
afterEach(() => setRenderRangeDepsForTests(null));

function toolOf(ctx: StudioToolContext): ToolLike {
  return (buildFlowTools(ctx) as unknown as ToolLike[])[0];
}

describe('Studio run_flow', () => {
  it('carries the listing and the shot-range rule in its description', () => {
    const t = toolOf(makeCtx().ctx);
    expect(t.name).toBe('run_flow');
    expect(t.description).toContain('LISTING');
    expect(t.description).toContain('counts the media clips on the master video track from 1');
  });

  it('renders shots 7–9 to a clip, feeds the video param, runs with the project brand, imports the result and hints insert_asset', async () => {
    const { ctx, events } = makeCtx();
    const result = await toolOf(ctx).handler({ flowId: 'Add an effect', params: { effect: 'watercolour' }, range: { fromShot: 7, toShot: 9 } }, {});
    expect(trims).toEqual([{ start: 18, end: 27, output: expect.stringMatching(/flow-range[\\/]p1-[a-z0-9]+\.mp4$/) }]);
    expect(fake.start).toHaveBeenCalledWith({ flowId: 'flow-1', mode: 'unattended', params: { effect: 'watercolour', video: trims[0].output }, brandId: 'acme-test' });
    expect(fake.imported).toHaveBeenCalledWith(ctx, 'flows/add-an-effect/clip.mp4');
    expect(result.isError).toBeUndefined();
    const textOut = result.content[0].text;
    expect(textOut).toContain('"Add an effect" finished (run run-1). Priced steps:');
    expect(textOut).toContain('project asset id "asset-9"');
    expect(textOut).toContain('insert_asset(assetId: "asset-9", lane: "broll", at: 18, note: "Add an effect on shots 7–9")');
    expect(events.some((e) => e.kind === 'progress' && String(e.message).includes('Rendering shots 7–9'))).toBe(true);
  });

  it('refuses a range on a flow without a video param, and names a missing video without a range', async () => {
    fake.doc = { ...addEffect(), params: [addEffect().params[1]] };
    const noVideo = await toolOf(makeCtx().ctx).handler({ flowId: 'x', range: { fromShot: 1, toShot: 2 } }, {});
    expect(noVideo.isError).toBe(true);
    expect(noVideo.content[0].text).toContain('has no video param');
    fake.doc = addEffect();
    const missing = await toolOf(makeCtx().ctx).handler({ flowId: 'x', params: { effect: 'x' } }, {});
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain('pass `range` for the video');
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('reports a failed run at its node; an unknown flow is refused', async () => {
    fake.get.mockResolvedValue({ run: run('error'), artifacts: [], assetUrls: {}, resumable: true });
    const failed = await toolOf(makeCtx().ctx).handler({ flowId: 'x', params: { effect: 'x' }, range: { fromSec: 0, toSec: 6 } }, {});
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toBe('"Add an effect" failed at "generate_video": Kling refused');
    expect((await toolOf(makeCtx().ctx).handler({ flowId: 'nope' }, {})).content[0].text).toBe('No flow "nope".');
  });
});
