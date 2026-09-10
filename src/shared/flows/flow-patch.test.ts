import { describe, it, expect } from 'vitest';
import type { FlowDoc } from '../types/flows';
import { applyFlowPatch } from './flow-patch';
import { diffFlowDocs, nodeChangeMap } from './flow-diff';

function base(): FlowDoc {
  return {
    formatVersion: 2,
    id: '01HZZZZZZZZZZZZZZZZZZZZZZZ',
    name: 'Captions',
    description: '',
    params: [],
    graph: {
      nodes: [
        { id: 'n-video', toolId: 'input_video_file', position: { x: 80, y: 80 }, config: { filePath: '', entryId: '' }, pause: false },
        { id: 'n-stt', toolId: 'transcribe', position: { x: 480, y: 80 }, config: { sttModelId: 'assemblyai/universal' }, pause: false },
      ],
      edges: [{ id: 'e1', source: 'n-video', sourceHandle: 'video', target: 'n-stt', targetHandle: 'video' }],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [{ nodeId: 'n-stt', handle: 'transcript', label: 'Transcript' }],
    origin: null,
  };
}

describe('applyFlowPatch', () => {
  it('adds a node right of the last one, wires it, sets config and pause, and leaves the input untouched', () => {
    const before = base();
    const result = applyFlowPatch(before, [
      { op: 'add-node', id: 'n-cap', toolId: 'caption_video', config: { style: 'karaoke' } },
      { op: 'add-edge', source: 'n-video', sourceHandle: 'video', target: 'n-cap', targetHandle: 'video' },
      { op: 'add-edge', source: 'n-stt', sourceHandle: 'transcript', target: 'n-cap', targetHandle: 'transcript' },
      { op: 'set-config', id: 'n-cap', config: { style: 'bold-pop' } },
      { op: 'set-pause', id: 'n-cap', pause: true },
      { op: 'set-outputs', outputs: [{ nodeId: 'n-cap', handle: 'video', label: '' }] },
      { op: 'rename', name: 'Captions v2' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cap = result.doc.graph.nodes.find((n) => n.id === 'n-cap');
    expect(cap).toMatchObject({ position: { x: 880, y: 80 }, config: { style: 'bold-pop' }, pause: true });
    expect(result.doc.graph.edges.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(result.doc.outputs).toEqual([{ nodeId: 'n-cap', handle: 'video', label: 'video' }]);
    expect(result.doc.name).toBe('Captions v2');
    expect(before.graph.nodes).toHaveLength(2);
  });

  it('removing a node drops its edges, binds and outputs; a bad op names its index', () => {
    const doc = base();
    const removed = applyFlowPatch(doc, [{ op: 'remove-node', id: 'n-stt' }]);
    expect(removed.ok && removed.doc.graph.edges).toEqual([]);
    expect(removed.ok && removed.doc.outputs).toEqual([]);
    const bad = applyFlowPatch(doc, [{ op: 'set-pause', id: 'n-video', pause: true }, { op: 'remove-edge', source: 'n-x', target: 'n-y' }]);
    expect(bad).toMatchObject({ ok: false, index: 1 });
  });

  it('expose makes a param of the asked kind bound to the config key; unexpose removes it', () => {
    const exposed = applyFlowPatch(base(), [{ op: 'expose', nodeId: 'n-video', key: 'filePath', kind: 'video', label: 'Video', required: true }]);
    expect(exposed.ok && exposed.doc.params).toEqual([
      { id: 'filepath', label: 'Video', kind: 'video', required: true, bind: [{ nodeId: 'n-video', key: 'filePath' }] },
    ]);
    if (!exposed.ok) return;
    const gone = applyFlowPatch(exposed.doc, [{ op: 'unexpose', nodeId: 'n-video', key: 'filePath' }]);
    expect(gone.ok && gone.doc.params).toEqual([]);
  });
});

describe('diffFlowDocs', () => {
  it('reports added, removed and changed nodes, edge and output changes, and ignores moves', () => {
    const before = base();
    const after = structuredClone(before);
    after.graph.nodes[0].position = { x: 999, y: 999 };
    after.graph.nodes[1].config = { sttModelId: 'whisper/base' };
    after.graph.nodes.push({ id: 'n-cap', toolId: 'caption_video', position: { x: 0, y: 0 }, config: {}, pause: false });
    after.graph.edges.push({ id: 'e2', source: 'n-stt', sourceHandle: 'transcript', target: 'n-cap', targetHandle: 'transcript' });
    after.outputs = [{ nodeId: 'n-cap', handle: 'video', label: 'Video' }];
    const diff = diffFlowDocs(before, after);
    expect(nodeChangeMap(diff)).toEqual({ 'n-stt': 'changed', 'n-cap': 'added' });
    expect(diff.nodes.find((n) => n.id === 'n-stt')?.keys).toEqual(['sttModelId']);
    expect(diff.edges).toEqual([{ edge: after.graph.edges[1], change: 'added' }]);
    expect(diff.outputs).toEqual([
      { nodeId: 'n-cap', handle: 'video', change: 'added' },
      { nodeId: 'n-stt', handle: 'transcript', change: 'removed' },
    ]);
    expect(diff.empty).toBe(false);
    expect(diffFlowDocs(before, structuredClone(before)).empty).toBe(true);
  });
});
