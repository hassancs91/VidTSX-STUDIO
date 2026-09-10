// `run_flow` (flows plan §1.5, W8 Stage 4) against a fake flow service:
// the listing rides the description, an unmet capability fails before any
// step (the runner's own message), the run's outputs come back as drafts —
// media records copied as they are, work files copied into the session
// workspace — and progress lines name the nodes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AgentArtifact, AgentRunEvent } from '../../../../shared/types/agents';
import type { FlowDoc, FlowRunDoc, FlowRunEvent } from '../../../../shared/types/flows';
import { makeToolContext } from './test-context';

const fake = vi.hoisted(() => ({
  start: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  listeners: [] as Array<(e: FlowRunEvent) => void>,
  runDir: '',
  doc: null as FlowDoc | null,
}));

vi.mock('../../flows/flow-service', () => ({
  flowService: {
    start: (req: unknown) => fake.start(req),
    wait: async () => {
      for (const l of fake.listeners) {
        l({ runId: 'run-1', kind: 'node-status', nodeId: 'n-clip', state: { status: 'running', attempts: 1 } });
        l({ runId: 'run-1', kind: 'node-status', nodeId: 'n-clip', state: { status: 'done', attempts: 1 } });
      }
    },
    get: (runId: string) => fake.get(runId),
    cancel: (runId: string) => fake.cancel(runId),
    onEvent: (l: (e: FlowRunEvent) => void) => {
      fake.listeners.push(l);
      return () => {
        fake.listeners = fake.listeners.filter((x) => x !== l);
      };
    },
  },
  loadFlowDoc: () => ({ doc: fake.doc, version: '1' }),
  resolveFlowRef: (ref: string) => (ref === 'missing' ? { error: `No flow "${ref}".` } : { id: 'flow-1', name: 'Add an effect' }),
  listFlowDocs: () => [],
}));
vi.mock('./flow-listing', () => ({
  installedFlowsListing: () => 'FLOW LISTING TEXT',
  pricedSummary: () => 'Priced steps: generate_video (kling, 5 s ≈ $0.40) — expect about $0.40.',
}));
vi.mock('../../flows/flow-run-store', () => ({
  flowRunStore: { runDir: () => fake.runDir },
  RUN_FILES_DIR: 'files',
}));

await import('./registry');
const { runFlowTool } = await import('./run-flow');

function doc(): FlowDoc {
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
        { id: 'n-doc', toolId: 'write_document', position: { x: 0, y: 0 }, config: {}, pause: false },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [
      { nodeId: 'n-clip', handle: 'video', label: 'Video' },
      { nodeId: 'n-doc', handle: 'document', label: 'Notes' },
      { nodeId: 'n-text', handle: 'text', label: 'Prompt' },
    ],
    origin: null,
  };
}

function run(status: FlowRunDoc['status'], error: string | null = null): FlowRunDoc {
  return {
    id: 'run-1',
    flowId: 'flow-1',
    flowVersion: '1',
    mode: 'unattended',
    params: {},
    status,
    startedAt: 1000,
    finishedAt: 4000,
    error,
    nodes: {
      'n-video': { status: 'done', attempts: 1 },
      'n-text': { status: 'done', attempts: 1, outputs: { text: { kind: 'text', value: 'watercolour' } } },
      'n-clip': status === 'success'
        ? { status: 'done', attempts: 1, outputs: { video: { kind: 'artifact', artifactId: 'video-1', artifactKind: 'video' } } }
        : { status: 'error', attempts: 1, error: error ?? 'boom' },
      'n-doc': { status: 'done', attempts: 1, outputs: { document: { kind: 'artifact', artifactId: 'document-2', artifactKind: 'document' } } },
    },
    pending: null,
  };
}

const artifacts: AgentArtifact[] = [
  { id: 'video-1', kind: 'video', title: 'clip', createdAt: 'now', producer: { tool: 'generate_video', callId: 'c' }, payload: { relPath: 'flows/add-an-effect/clip.mp4', durationSeconds: 5, width: 1280, height: 720 } },
  { id: 'document-2', kind: 'document', title: 'notes', createdAt: 'now', producer: { tool: 'write_document', callId: 'c' }, payload: { relPath: 'docs/notes.md' } },
];

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'run-flow-'));
  fake.runDir = path.join(tmp, 'run');
  await fs.mkdir(path.join(fake.runDir, 'files', 'docs'), { recursive: true });
  await fs.writeFile(path.join(fake.runDir, 'files', 'docs', 'notes.md'), '# notes', 'utf-8');
  fake.doc = doc();
  fake.listeners = [];
  fake.start.mockReset().mockResolvedValue({ runId: 'run-1' });
  fake.get.mockReset().mockResolvedValue({ run: run('success'), artifacts, assetUrls: {}, resumable: false });
  fake.cancel.mockReset();
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('run_flow', () => {
  it('carries the installed-flows listing and the name-the-cost rule in its description', () => {
    expect(runFlowTool.description).toContain('FLOW LISTING TEXT');
    expect(runFlowTool.description).toContain('what it will cost');
  });

  it('refuses an unknown flow and names missing required params', async () => {
    const ctx = makeToolContext();
    expect(await runFlowTool.handler({ flowId: 'missing' }, ctx)).toMatchObject({ isError: true, content: [{ text: 'No flow "missing".' }] });
    const missing = await runFlowTool.handler({ flowId: 'Add an effect', params: { video: 'C:/a.mp4' } }, ctx);
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain('effect (Effect)');
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('fails fast with the runner\'s own capability message, before any step runs', async () => {
    fake.start.mockRejectedValue(new Error('Generate Video needs a video provider — add one in AI → Providers.'));
    const result = await runFlowTool.handler({ flowId: 'flow-1', params: { video: 'C:/a.mp4', effect: 'x' } }, makeToolContext());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('"Add an effect" could not start: Generate Video needs a video provider — add one in AI → Providers.');
    expect(fake.get).not.toHaveBeenCalled();
  });

  it('starts unattended with the session brand, streams node progress, and returns the outputs as copied drafts', async () => {
    const events: AgentRunEvent[] = [];
    const progress: string[] = [];
    const session = path.join(tmp, 'session-work');
    const ctx = makeToolContext({ workspaceDir: session, brandId: 'acme-test', emit: (e) => events.push(e), emitProgress: (d) => progress.push(d) });
    const result = await runFlowTool.handler({ flowId: 'Add an effect', params: { video: 'C:/a.mp4', effect: 'watercolour' } }, ctx);

    expect(fake.start).toHaveBeenCalledWith({ flowId: 'flow-1', mode: 'unattended', params: { video: 'C:/a.mp4', effect: 'watercolour' }, brandId: 'acme-test' });
    expect(progress).toEqual(['Starting "Add an effect"', 'Generate Video: running', 'Generate Video: done']);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('"Add an effect" finished in 3 s (run run-1). Priced steps:');
    expect(result.content[0].text).toContain('Prompt: watercolour');
    // The video record is copied as is — the library file is the durable one.
    expect(result.artifact).toEqual({ kind: 'video', title: 'Add an effect — Video', payload: artifacts[0].payload });
    // The document is a run work file: copied into the session workspace.
    expect(result.extraArtifacts).toEqual([{ kind: 'document', title: 'Add an effect — Notes', payload: { relPath: 'flows/run-1/notes.md' } }]);
    expect(await fs.readFile(path.join(session, 'flows', 'run-1', 'notes.md'), 'utf-8')).toBe('# notes');
    expect(fake.listeners).toEqual([]);
  });

  it('a session without a brand runs the flow with none (null, never the library default)', async () => {
    await runFlowTool.handler({ flowId: 'flow-1', params: { video: 'C:/a.mp4', effect: 'x' } }, makeToolContext());
    expect(fake.start.mock.calls[0][0]).toMatchObject({ brandId: null });
  });

  it('reports a failed run with the node that failed', async () => {
    fake.get.mockResolvedValue({ run: run('error', 'Content Safety refused the prompt.'), artifacts: [], assetUrls: {}, resumable: true });
    const result = await runFlowTool.handler({ flowId: 'flow-1', params: { video: 'C:/a.mp4', effect: 'x' } }, makeToolContext());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('"Add an effect" failed at "Generate Video": Content Safety refused the prompt.');
  });
});
