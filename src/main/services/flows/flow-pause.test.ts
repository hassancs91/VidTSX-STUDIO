// The checkpoint planner and its two pure halves (flows plan §1.3, Stage 2):
// which card a node's primary output raises, what an accept substitutes, and
// where a rejection's note lands.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { FlowNode, PortDef } from '../../../shared/types/flows';
import { AgentArtifactStore } from '../agents/artifact-store';
import { acceptedOutputs, planPause, withRetryNote, type PausePlan } from './flow-pause';

let root = '';
let store: AgentArtifactStore;

const node: FlowNode = { id: 'n-img', toolId: 'generate_image', position: { x: 0, y: 0 }, config: {}, pause: true };
const imagePort: PortDef[] = [{ id: 'image', label: 'Image', dataType: 'image', from: 'artifact' }];
const textPort: PortDef[] = [{ id: 'text', label: 'Text', dataType: 'text', from: 'field:text' }];

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-pause-'));
  store = await AgentArtifactStore.open(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('planPause', () => {
  it('several images → a pick, each option filed as its own one-item image-set', async () => {
    const set = await store.add(
      { kind: 'image-set', title: 'Fox', payload: { items: [{ relPath: 'a.png', width: 1, height: 1 }, { relPath: 'b.png', width: 2, height: 2 }] } },
      { tool: 'generate_image', callId: 'c1' },
    );
    const plan = await planPause({
      node, label: 'Generate Image', outputs: imagePort, store, callId: 'c1',
      values: { image: { kind: 'artifact', artifactId: set.id, artifactKind: 'image-set' } },
    });
    expect(plan?.payload.kind).toBe('pick');
    if (plan?.payload.kind !== 'pick') throw new Error('not a pick');
    expect(plan.payload.select).toBe('one');
    expect(plan.payload.candidates.map((c) => c.label)).toEqual(['Option 1', 'Option 2']);
    const ids = plan.payload.candidates.map((c) => c.artifactId ?? '');
    expect(store.list()).toHaveLength(3);
    const second = store.get(ids[1]);
    expect(second?.kind === 'image-set' && second.payload.items).toEqual([{ relPath: 'b.png', width: 2, height: 2 }]);
    expect(plan.candidates[ids[1]]).toEqual({ kind: 'artifact', artifactId: ids[1], artifactKind: 'image-set' });
  });

  it('one artifact → an approve with a single item naming it', async () => {
    const set = await store.add(
      { kind: 'image-set', title: 'Fox', payload: { items: [{ relPath: 'a.png', width: 640, height: 480 }] } },
      { tool: 'generate_image', callId: 'c1' },
    );
    const plan = await planPause({
      node, label: 'Generate Image', outputs: imagePort, store, callId: 'c1',
      values: { image: { kind: 'artifact', artifactId: set.id, artifactKind: 'image-set' } },
    });
    expect(plan?.payload).toMatchObject({ kind: 'approve', items: [{ id: set.id, label: 'Fox', detail: '640×480', artifactId: set.id }] });
    expect(store.list()).toHaveLength(1);
  });

  it('text → an editable form with the one text field; nothing to review → null', async () => {
    const plan = await planPause({
      node, label: 'Text', outputs: textPort, store, callId: 'c1', values: { text: { kind: 'text', value: 'hello' } },
    });
    expect(plan?.payload).toMatchObject({ kind: 'form', fields: [{ id: 'text', kind: 'multiline', required: true }] });
    expect(await planPause({ node, label: 'Text', outputs: textPort, store, callId: 'c1', values: {} })).toBeNull();
  });
});

describe('acceptedOutputs', () => {
  it('a pick puts the chosen one-item set on the port; a form the edited text; else unchanged', () => {
    const pickPlan: PausePlan = {
      portId: 'image',
      candidates: { 'image-set-2': { kind: 'artifact', artifactId: 'image-set-2', artifactKind: 'image-set' } },
      payload: { kind: 'pick', title: 't', select: 'one', candidates: [{ id: 'image-set-2', label: 'Option 1' }] },
    };
    const outputs = { image: { kind: 'artifact' as const, artifactId: 'image-set-1', artifactKind: 'image-set' as const } };
    expect(acceptedOutputs(pickPlan, outputs, { kind: 'accept', chosenIds: ['image-set-2'] }).image).toMatchObject({ artifactId: 'image-set-2' });
    expect(acceptedOutputs(pickPlan, outputs, { kind: 'accept', chosenIds: ['nope'] })).toBe(outputs);

    const formPlan: PausePlan = { portId: 'text', candidates: {}, payload: { kind: 'form', title: 't', fields: [] } };
    expect(acceptedOutputs(formPlan, { text: { kind: 'text', value: 'a' } }, { kind: 'accept', chosenIds: [], text: 'b' })).toEqual({
      text: { kind: 'text', value: 'b' },
    });
    expect(acceptedOutputs(formPlan, { text: { kind: 'number', value: 1 } }, { kind: 'accept', chosenIds: [], text: '42' })).toEqual({
      text: { kind: 'number', value: 42 },
    });
  });
});

describe('withRetryNote', () => {
  it('appends to the first prompt field, else to `prompt`, else leaves the args alone', () => {
    const schema = [{ kind: 'prompt' as const, key: 'systemPrompt', label: 'System' }];
    expect(withRetryNote({ systemPrompt: 'be terse', prompt: 'x' }, schema, 'and blue')).toEqual({ systemPrompt: 'be terse\n\nand blue', prompt: 'x' });
    expect(withRetryNote({ prompt: 'a fox' }, [], ' more fur ')).toEqual({ prompt: 'a fox\n\nmore fur' });
    expect(withRetryNote({ prompt: '' }, [], 'note')).toEqual({ prompt: 'note' });
    expect(withRetryNote({ width: 1 }, [], 'note')).toEqual({ width: 1 });
    expect(withRetryNote({ prompt: 'a' }, [], '   ')).toEqual({ prompt: 'a' });
  });
});
