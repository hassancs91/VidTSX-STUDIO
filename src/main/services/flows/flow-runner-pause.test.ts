// The runner's checkpoint paths (flows plan §1.3, decision 4, Stage 2) with
// a fake registry and a temp store: accept substitutes the chosen image,
// reject reruns once with the note, a second reject cancels, unattended runs
// never pause, a paused run survives a "restart" as expired and Resume asks
// again without rerunning, a tool's own `ctx.ask` gets the answer, and a
// cancel while paused ends the run.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import type { FlowDoc, FlowRunEvent, FlowRunMode } from '../../../shared/types/flows';
import { FLOW_PAUSE_TEXT_FIELD, rejectReply } from '../../../shared/flows/pause-reply';
import type { RegisteredTool } from '../agents/tools/registry';
import { invokeTool } from '../agents/tools/invoke-tool';
import { toolText } from '../agents/tools/types';
import { openRunArtifacts, readRunDoc, writeRunDoc, type FlowRunStore } from './flow-run-store';
import { FlowRunner } from './flow-runner';

const ALL = { imageProvider: true, videoProvider: true, audioProvider: true };

let root = '';
let calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
let events: FlowRunEvent[] = [];
let askSeen: unknown = null;

const tools: Record<string, RegisteredTool> = {
  input_text: {
    id: 'input_text',
    description: 'text in',
    schema: { text: z.string() },
    ports: { label: 'Text', category: 'input', inputs: [], outputs: [{ id: 'text', label: 'T', dataType: 'text', from: 'field:text' }], configSchema: [], defaultConfig: {} },
    handler: async (args) => ({ ...toolText(String(args.text)), fields: { text: String(args.text) } }),
  },
  make_images: {
    id: 'make_images',
    description: 'two variations',
    schema: { prompt: z.string() },
    ports: {
      label: 'Images',
      category: 'image',
      inputs: [{ id: 'prompt', label: 'P', dataType: 'text', required: true, argKey: 'prompt' }],
      outputs: [{ id: 'image', label: 'I', dataType: 'image', from: 'artifact' }],
      configSchema: [{ kind: 'prompt', key: 'prompt', label: 'Prompt' }],
      defaultConfig: {},
    },
    handler: async (args) => ({
      ...toolText('made two'),
      artifact: {
        kind: 'image-set',
        title: String(args.prompt),
        payload: { items: [{ relPath: 'flows/x/a.png', width: 1, height: 1 }, { relPath: 'flows/x/b.png', width: 2, height: 2 }] },
      },
    }),
  },
  use_image: {
    id: 'use_image',
    description: 'records what it was given',
    schema: { image: z.string() },
    ports: {
      label: 'Use',
      category: 'image',
      inputs: [{ id: 'image', label: 'I', dataType: 'image', required: true, argKey: 'image' }],
      outputs: [{ id: 'text', label: 'T', dataType: 'text', from: 'field:text' }],
      configSchema: [],
      defaultConfig: {},
    },
    handler: async (args) => ({ ...toolText('used'), fields: { text: `used:${String(args.image)}` } }),
  },
  asker: {
    id: 'asker',
    description: 'asks the user',
    schema: { prompt: z.string() },
    ports: {
      label: 'Asker',
      category: 'text',
      inputs: [{ id: 'prompt', label: 'P', dataType: 'text', required: true, argKey: 'prompt' }],
      outputs: [{ id: 'text', label: 'T', dataType: 'text', from: 'field:text' }],
      configSchema: [],
      defaultConfig: {},
    },
    handler: async (_args, ctx) => {
      askSeen = await ctx.ask({ kind: 'form', title: 'Name?', fields: [{ id: 'name', label: 'Name', kind: 'text' }] });
      return { ...toolText('asked'), fields: { text: JSON.stringify(askSeen) } };
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
    persistSummary: async () => {},
  };
}

function runner(): FlowRunner {
  return new FlowRunner({
    registry,
    capabilities: async () => ALL,
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
    name: 'Pick',
    description: '',
    params: [],
    graph: {
      nodes: [
        { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: { text: 'a fox' }, pause: false },
        { id: 'n-imgs', toolId: 'make_images', position: { x: 1, y: 0 }, config: {}, pause: true },
        { id: 'n-use', toolId: 'use_image', position: { x: 2, y: 0 }, config: {}, pause: false },
      ],
      edges: [
        { id: 'e1', source: 'n-text', sourceHandle: 'text', target: 'n-imgs', targetHandle: 'prompt' },
        { id: 'e2', source: 'n-imgs', sourceHandle: 'image', target: 'n-use', targetHandle: 'image' },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [{ nodeId: 'n-use', handle: 'text', label: 'Text' }],
    origin: null,
    ...over,
  };
}

const base = (mode: FlowRunMode) => ({ mode, params: {}, flowVersion: '1', libraryFolder: 'flows/pick' });

async function nextPauseRequest(after = 0) {
  for (let i = 0; i < 400; i += 1) {
    const found = events.filter((e) => e.kind === 'pause-request');
    if (found.length > after) return found[after] as Extract<FlowRunEvent, { kind: 'pause-request' }>;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('no pause request');
}

function pickCandidateIds(request: Extract<FlowRunEvent, { kind: 'pause-request' }>): string[] {
  const payload = request.request.payload;
  if (payload.kind !== 'pick') throw new Error(`expected a pick, got ${payload.kind}`);
  return payload.candidates.map((c) => c.id);
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-pause-run-'));
  calls = [];
  events = [];
  askSeen = null;
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('FlowRunner checkpoints', () => {
  it('accept: pauses with a pick card and continues with the chosen image on the port', async () => {
    const r = runner();
    const { runId } = await r.start({ ...base('attended'), doc: doc() });
    const pause = await nextPauseRequest();
    expect(pause.nodeId).toBe('n-imgs');
    const ids = pickCandidateIds(pause);
    expect(ids).toHaveLength(2);

    const mid = await readRunDoc(path.join(root, doc().id, runId));
    expect(mid?.status).toBe('paused');
    expect(mid?.pending).toMatchObject({ nodeId: 'n-imgs', requestId: pause.request.id, request: { id: pause.request.id } });
    expect(mid?.nodes['n-imgs']).toMatchObject({ status: 'paused', attempts: 1 });
    expect(calls.map((c) => c.tool)).toEqual(['input_text', 'make_images']);

    expect(await r.reply(runId, { requestId: 'stale', status: 'answered', values: {} })).toBe(false);
    expect(await r.reply(runId, { requestId: pause.request.id, status: 'answered', values: { [ids[1]]: ['Option 2'] } })).toBe(true);
    await r.wait(runId);

    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('success');
    expect(run?.pending).toBeNull();
    expect(run?.nodes['n-imgs']).toMatchObject({ status: 'done', outputs: { image: { artifactId: ids[1] } } });
    expect(calls[2]).toEqual({ tool: 'use_image', args: { image: ids[1] } });
    expect(run?.nodes['n-use'].outputs).toEqual({ text: { kind: 'text', value: `used:${ids[1]}` } });
    const statuses = events.filter((e) => e.kind === 'run-status').map((e) => (e.kind === 'run-status' ? e.status : ''));
    expect(statuses).toEqual(['running', 'paused', 'running', 'success']);
    expect(events.some((e) => e.kind === 'pause-cleared' && e.requestId === pause.request.id)).toBe(true);
  });

  it('reject once: reruns the node with the note appended to its prompt, then asks again', async () => {
    const r = runner();
    const { runId } = await r.start({ ...base('attended'), doc: doc() });
    const first = await nextPauseRequest();
    expect(await r.reply(runId, rejectReply(first.request.id, 'more fur'))).toBe(true);
    const second = await nextPauseRequest(1);
    expect(second.request.id).not.toBe(first.request.id);
    expect(calls.filter((c) => c.tool === 'make_images').map((c) => c.args.prompt)).toEqual(['a fox', 'a fox\n\nmore fur']);
    const ids = pickCandidateIds(second);
    await r.reply(runId, { requestId: second.request.id, status: 'answered', values: { [ids[0]]: ['Option 1'] } });
    await r.wait(runId);
    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('success');
    expect(run?.nodes['n-imgs']).toMatchObject({ status: 'done', attempts: 2, rejections: 1 });
  });

  it('a second reject stops the run as cancelled with the rest skipped', async () => {
    const r = runner();
    const { runId } = await r.start({ ...base('attended'), doc: doc() });
    const first = await nextPauseRequest();
    await r.reply(runId, rejectReply(first.request.id, 'no'));
    const second = await nextPauseRequest(1);
    await r.reply(runId, rejectReply(second.request.id, 'still no'));
    await r.wait(runId);
    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('cancelled');
    expect(run?.error).toMatch(/Rejected twice/);
    expect(run?.nodes['n-imgs']).toMatchObject({ status: 'skipped', rejections: 2 });
    expect(run?.nodes['n-use'].status).toBe('skipped');
    expect(calls.filter((c) => c.tool === 'make_images')).toHaveLength(2);
  });

  it('unattended: never pauses, the downstream node gets the whole set', async () => {
    const r = runner();
    const { runId } = await r.start({ ...base('unattended'), doc: doc() });
    await r.wait(runId);
    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('success');
    expect(events.some((e) => e.kind === 'pause-request')).toBe(false);
    expect(calls.map((c) => c.tool)).toEqual(['input_text', 'make_images', 'use_image']);
    expect(calls[2].args).toEqual({ image: 'image-set-1' });
  });

  it('a pending checkpoint survives a restart: Resume asks again without rerunning the node', async () => {
    const r1 = runner();
    const { runId } = await r1.start({ ...base('attended'), doc: doc() });
    const first = await nextPauseRequest();
    // "Restart": a fresh runner over the same folder; the old one is never answered.
    const r2 = runner();
    const onDisk = await readRunDoc(path.join(root, doc().id, runId));
    expect(onDisk?.status).toBe('paused');
    expect(onDisk?.pending?.request?.id).toBe(first.request.id);
    await r2.resume({ ...base('attended'), doc: doc(), runId });
    const again = await nextPauseRequest(1);
    expect(again.request.id).not.toBe(first.request.id);
    expect(calls.filter((c) => c.tool === 'make_images')).toHaveLength(1);
    const ids = pickCandidateIds(again);
    await r2.reply(runId, { requestId: again.request.id, status: 'answered', values: { [ids[0]]: ['Option 1'] } });
    await r2.wait(runId);
    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('success');
    expect(run?.nodes['n-imgs']).toMatchObject({ status: 'done', attempts: 1 });
    r1.cancel(runId);
  });

  it('a tool that asks gets the answer in an attended run and a refusal in an unattended one', async () => {
    const asking = doc({
      graph: {
        nodes: [
          { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: { text: 'hi' }, pause: false },
          { id: 'n-ask', toolId: 'asker', position: { x: 1, y: 0 }, config: {}, pause: false },
        ],
        edges: [{ id: 'e1', source: 'n-text', sourceHandle: 'text', target: 'n-ask', targetHandle: 'prompt' }],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      outputs: [{ nodeId: 'n-ask', handle: 'text', label: 'Text' }],
    });
    const r = runner();
    const { runId } = await r.start({ ...base('attended'), doc: asking });
    const q = await nextPauseRequest();
    expect(q.request.payload).toMatchObject({ kind: 'form', title: 'Name?' });
    await r.reply(runId, { requestId: q.request.id, status: 'answered', values: { name: ['Hasan'] } });
    await r.wait(runId);
    expect(askSeen).toEqual({ status: 'answered', requestId: q.request.id, values: { name: ['Hasan'] } });
    expect((await readRunDoc(path.join(root, asking.id, runId)))?.status).toBe('success');

    events = [];
    const { runId: runId2 } = await r.start({ ...base('unattended'), doc: asking });
    await r.wait(runId2);
    expect(askSeen).toMatchObject({ status: 'rejected' });
    expect(events.some((e) => e.kind === 'pause-request')).toBe(false);
  });

  it('cancel while paused ends the run cancelled and drops the card', async () => {
    const r = runner();
    const { runId } = await r.start({ ...base('attended'), doc: doc() });
    const pause = await nextPauseRequest();
    expect(r.cancel(runId)).toBe(true);
    await r.wait(runId);
    const run = await readRunDoc(path.join(root, doc().id, runId));
    expect(run?.status).toBe('cancelled');
    expect(run?.pending).toBeNull();
    expect(run?.nodes['n-imgs'].status).toBe('skipped');
    expect(events.some((e) => e.kind === 'pause-cleared' && e.requestId === pause.request.id)).toBe(true);
  });

  it('text output → an editable form whose text replaces the port value', async () => {
    const textFlow = doc({
      graph: {
        nodes: [
          { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: { text: 'draft' }, pause: true },
          { id: 'n-imgs', toolId: 'make_images', position: { x: 1, y: 0 }, config: {}, pause: false },
        ],
        edges: [{ id: 'e1', source: 'n-text', sourceHandle: 'text', target: 'n-imgs', targetHandle: 'prompt' }],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      outputs: [{ nodeId: 'n-imgs', handle: 'image', label: 'Image' }],
    });
    const r = runner();
    const { runId } = await r.start({ ...base('attended'), doc: textFlow });
    const q = await nextPauseRequest();
    expect(q.request.payload.kind).toBe('form');
    await r.reply(runId, { requestId: q.request.id, status: 'answered', values: { [FLOW_PAUSE_TEXT_FIELD]: ['final copy'] } });
    await r.wait(runId);
    expect(calls.find((c) => c.tool === 'make_images')?.args).toEqual({ prompt: 'final copy' });
  });
});
