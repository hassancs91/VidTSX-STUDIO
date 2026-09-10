// The runner over a fake registry and a temp folder (flows plan §4 steps):
// order, argument building, persistence after every node, cancel mid-node,
// resume from the first non-done node, and the four refusals (unknown tool,
// unmet needs, unbound required input, cycle).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import type { FlowDoc, FlowRunDoc, FlowRunEvent } from '../../../shared/types/flows';
import type { RegisteredTool } from '../agents/tools/registry';
import { invokeTool } from '../agents/tools/invoke-tool';
import { toolText } from '../agents/tools/types';
import { openRunArtifacts, readRunDoc, writeRunDoc, type FlowRunStore } from './flow-run-store';
import { FlowRunner } from './flow-runner';
import { validateFlowForRun } from './flow-validate';

const ALL = { imageProvider: true, videoProvider: true, audioProvider: true };
const NONE = { imageProvider: false, videoProvider: false, audioProvider: false };

let root = '';
let calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
let events: FlowRunEvent[] = [];
let summaries: FlowRunDoc['status'][] = [];
/** Lets a test hold the "slow" tool open until it decides. */
let release: (() => void) | null = null;
let failOn: string | null = null;

const tools: Record<string, RegisteredTool> = {
  input_text: {
    id: 'input_text',
    description: 'text in',
    schema: { text: z.string() },
    ports: { label: 'Text', category: 'input', inputs: [], outputs: [{ id: 'text', label: 'T', dataType: 'text', from: 'field:text' }], configSchema: [], defaultConfig: {} },
    handler: async (args) => ({ ...toolText(String(args.text)), fields: { text: String(args.text) } }),
  },
  make_image: {
    id: 'make_image',
    description: 'image out',
    schema: { prompt: z.string(), refs: z.array(z.string()).optional() },
    needs: 'image-provider',
    ports: {
      label: 'Image',
      category: 'image',
      inputs: [
        { id: 'prompt', label: 'P', dataType: 'text', required: true, argKey: 'prompt' },
        { id: 'refs', label: 'R', dataType: 'images', argKey: 'refs' },
      ],
      outputs: [{ id: 'image', label: 'I', dataType: 'image', from: 'artifact' }],
      configSchema: [],
      defaultConfig: {},
    },
    handler: async (args) => {
      if (release) await new Promise<void>((r) => (release = r));
      if (failOn === 'make_image') return toolText('provider said no', true);
      return {
        ...toolText('made'),
        artifact: { kind: 'image-set', title: String(args.prompt), payload: { items: [{ relPath: 'flows/x/a.png', width: 1, height: 1 }] } },
      };
    },
  },
  slow: {
    id: 'slow',
    description: 'waits for the test',
    schema: { prompt: z.string() },
    ports: {
      label: 'Slow',
      category: 'text',
      inputs: [{ id: 'prompt', label: 'P', dataType: 'text', required: true, argKey: 'prompt' }],
      outputs: [{ id: 'text', label: 'T', dataType: 'text', from: 'field:text' }],
      configSchema: [],
      defaultConfig: {},
    },
    handler: async (args, ctx) => {
      await new Promise<void>((r) => {
        release = r;
        ctx.signal.addEventListener('abort', () => r(), { once: true });
      });
      return { ...toolText('slow done'), fields: { text: `slow:${String(args.prompt)}` } };
    },
  },
};

const registry = { getNode: (id: string) => (tools[id]?.ports ? tools[id] : undefined) };

function store(): FlowRunStore {
  return {
    runDir: (flowId, runId) => path.join(root, flowId, runId),
    writeDoc: writeRunDoc,
    readDoc: readRunDoc,
    openArtifacts: openRunArtifacts,
    persistSummary: async (doc) => {
      summaries.push(doc.status);
    },
  };
}

function runner(capabilities = ALL): FlowRunner {
  return new FlowRunner({
    registry,
    capabilities: async () => capabilities,
    invoke: async (def, args, ctx, options) => {
      calls.push({ tool: def.id, args: args as Record<string, unknown> });
      return invokeTool(def, args, ctx, options);
    },
    store: store(),
    settleJob: async (job) => job,
    emit: (e) => events.push(e),
  });
}

function doc(over: Partial<FlowDoc> = {}): FlowDoc {
  return {
    formatVersion: 2,
    id: '01J8Z3M9K2N4P5Q6R7S8T9V0WX',
    name: 'Fox',
    description: '',
    params: [{ id: 'topic', label: 'Topic', kind: 'prompt', bind: [{ nodeId: 'n-text', key: 'text' }] }],
    graph: {
      nodes: [
        { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: { text: 'a fox' }, pause: false },
        { id: 'n-ref', toolId: 'input_text', position: { x: 0, y: 1 }, config: { text: 'ref' }, pause: false },
        { id: 'n-img', toolId: 'make_image', position: { x: 1, y: 0 }, config: {}, pause: false },
      ],
      edges: [
        { id: 'e1', source: 'n-text', sourceHandle: 'text', target: 'n-img', targetHandle: 'prompt' },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [{ nodeId: 'n-img', handle: 'image', label: 'Image' }],
    origin: null,
    ...over,
  };
}

const base = { mode: 'unattended' as const, params: {}, flowVersion: '1', libraryFolder: 'flows/fox' };

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-runner-'));
  calls = [];
  events = [];
  summaries = [];
  release = null;
  failOn = null;
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

describe('FlowRunner', () => {
  it('runs in topological order, builds args from ports and params, files artifacts, persists after each node', async () => {
    const r = runner();
    const { runId } = await r.start({ ...base, doc: doc(), params: { topic: 'a red fox' } });
    await r.wait(runId);

    expect(calls.map((c) => c.tool)).toEqual(['input_text', 'input_text', 'make_image']);
    expect(calls[0].args).toEqual({ text: 'a red fox' }); // the param won over config
    expect(calls[2].args).toEqual({ prompt: 'a red fox' }); // the edge fed the port

    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('success');
    expect(run?.nodes['n-img']).toMatchObject({
      status: 'done',
      attempts: 1,
      outputs: { image: { kind: 'artifact', artifactId: 'image-set-1', artifactKind: 'image-set' } },
    });
    expect(run?.nodes['n-text'].outputs).toEqual({ text: { kind: 'text', value: 'a red fox' } });
    expect(run?.params).toEqual({ topic: 'a red fox' });
    // Written at start, on running, twice per node (running/done), and at the end.
    expect(summaries[0]).toBe('queued');
    expect(summaries.filter((s) => s === 'running').length).toBeGreaterThanOrEqual(7);
    expect(summaries.at(-1)).toBe('success');
    const statuses = events.filter((e) => e.kind === 'run-status').map((e) => (e.kind === 'run-status' ? e.status : ''));
    expect(statuses).toEqual(['running', 'success']);
    const artifacts = JSON.parse(await fs.readFile(path.join(root, doc().id, runId, 'artifacts.json'), 'utf-8'));
    expect(artifacts.artifacts).toHaveLength(1);
  });

  it('a failing node marks the rest skipped and the run error, with the tool text as the message', async () => {
    failOn = 'make_image';
    const r = runner();
    const { runId } = await r.start({ ...base, doc: doc() });
    await r.wait(runId);
    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('error');
    expect(run?.error).toBe('provider said no');
    expect(run?.nodes['n-img']).toMatchObject({ status: 'error', error: 'provider said no' });
    expect(run?.nodes['n-text'].status).toBe('done');
  });

  it('cancels mid-node: the in-flight node is skipped, the run cancelled, and the flow is free again', async () => {
    const d = doc({
      graph: {
        nodes: [
          { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: { text: 'a' }, pause: false },
          { id: 'n-slow', toolId: 'slow', position: { x: 1, y: 0 }, config: {}, pause: false },
          { id: 'n-img', toolId: 'make_image', position: { x: 2, y: 0 }, config: {}, pause: false },
        ],
        edges: [
          { id: 'e1', source: 'n-text', sourceHandle: 'text', target: 'n-slow', targetHandle: 'prompt' },
          { id: 'e2', source: 'n-slow', sourceHandle: 'text', target: 'n-img', targetHandle: 'prompt' },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });
    const r = runner();
    const { runId } = await r.start({ ...base, doc: d });
    expect(r.runningRunForFlow(d.id)).toBe(runId);
    await expect(r.start({ ...base, doc: d })).rejects.toThrow(/already running/);
    // Wait until the slow node holds.
    while (!release) await new Promise((res) => setTimeout(res, 5));
    expect(r.cancel(runId)).toBe(true);
    await r.wait(runId);
    const run = await readRunDoc(path.join(root, d.id, runId));
    expect(run?.status).toBe('cancelled');
    expect(run?.nodes['n-text'].status).toBe('done');
    expect(run?.nodes['n-slow'].status).toBe('skipped');
    expect(run?.nodes['n-img'].status).toBe('skipped');
    expect(calls.map((c) => c.tool)).toEqual(['input_text', 'slow']);
    expect(r.runningRunForFlow(d.id)).toBeUndefined();
    expect(r.cancel(runId)).toBe(false);
  });

  it('resumes from the first node that is not done, keeping earlier outputs', async () => {
    failOn = 'make_image';
    const r = runner();
    const { runId } = await r.start({ ...base, doc: doc(), params: { topic: 'kept' } });
    await r.wait(runId);
    failOn = null;
    calls = [];
    await r.resume({ ...base, doc: doc(), runId, params: { topic: 'kept' } });
    await r.wait(runId);
    // Only the failed node reran; its prompt came from the persisted outputs.
    expect(calls.map((c) => c.tool)).toEqual(['make_image']);
    expect(calls[0].args).toEqual({ prompt: 'kept' });
    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('success');
    expect(run?.nodes['n-img']).toMatchObject({ status: 'done', attempts: 2 });
    expect(run?.error).toBeNull();
  });

  it('refuses an unknown tool, an unmet gate, an unbound required input and a cycle', async () => {
    const unknown = doc();
    unknown.graph.nodes[2].toolId = 'launch_missiles';
    await expect(runner().start({ ...base, doc: unknown })).rejects.toThrow(/Unknown node "launch_missiles"/);

    await expect(runner(NONE).start({ ...base, doc: doc() })).rejects.toThrow(/needs an image provider/);

    const unbound = doc();
    unbound.graph.edges = [];
    await expect(runner().start({ ...base, doc: unbound })).rejects.toThrow(/missing its required input "P"/);

    const cyclic = doc();
    cyclic.graph.edges.push({ id: 'e2', source: 'n-img', sourceHandle: 'image', target: 'n-text', targetHandle: 'text' });
    expect(validateFlowForRun(cyclic, registry, ALL)).toMatchObject({ ok: false });

    const badHandle = doc();
    badHandle.graph.edges[0].targetHandle = 'nope';
    expect(validateFlowForRun(badHandle, registry, ALL)).toMatchObject({ ok: false, error: expect.stringContaining('"nope"') });

    const wrongType = doc();
    wrongType.graph.edges[0] = { id: 'e1', source: 'n-text', sourceHandle: 'text', target: 'n-img', targetHandle: 'refs' };
    expect(validateFlowForRun(wrongType, registry, ALL)).toMatchObject({ ok: false, error: expect.stringContaining('text to images') });
    expect(calls).toEqual([]);
  });

  it('a required input satisfied by config or a bound param passes validation', () => {
    const viaConfig = doc();
    viaConfig.graph.edges = [];
    viaConfig.graph.nodes[2].config = { prompt: 'fixed' };
    expect(validateFlowForRun(viaConfig, registry, ALL)).toMatchObject({ ok: true, order: ['n-text', 'n-ref', 'n-img'] });
    const viaParam = doc();
    viaParam.graph.edges = [];
    // A bind target must be a config key of the node (structural rule); the
    // value may be empty — the run param fills it.
    viaParam.graph.nodes[2].config = { prompt: '' };
    viaParam.params = [{ id: 'p', label: 'P', kind: 'prompt', bind: [{ nodeId: 'n-img', key: 'prompt' }] }];
    expect(validateFlowForRun(viaParam, registry, ALL).ok).toBe(true);
  });
});
