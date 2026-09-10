import { describe, it, expect } from 'vitest';
import type { FlowDoc } from '../types/flows';
import {
  bindTargetFor,
  boundParam,
  exposeParam,
  hasPauseNode,
  initialParamValues,
  lockedKeys,
  missingRequiredParams,
  paramIdFor,
  setNodePause,
  unexposeParam,
} from './params';

function doc(): FlowDoc {
  return {
    formatVersion: 2,
    id: '01J8Z3M9K2N4P5Q6R7S8T9V0WX',
    name: 'F',
    description: '',
    params: [],
    graph: {
      nodes: [
        { id: 'n-text', toolId: 'input_text', position: { x: 0, y: 0 }, config: { prompt: 'a fox' }, pause: false },
        { id: 'n-file', toolId: 'input_image_file', position: { x: 0, y: 1 }, config: { base64: '', fileName: '' }, pause: false },
        { id: 'n-img', toolId: 'generate_image', position: { x: 1, y: 0 }, config: { width: 1024, count: 1 }, pause: false },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [],
    origin: null,
  };
}

describe('bindTargetFor', () => {
  it('maps the field kinds to a bound key and a form kind', () => {
    expect(bindTargetFor({ kind: 'prompt', key: 'prompt', label: 'Text' })).toEqual({ key: 'prompt', kind: 'prompt' });
    expect(bindTargetFor({ kind: 'image-upload', key: 'base64', label: 'Image' })).toEqual({ key: 'filePath', kind: 'image' });
    expect(bindTargetFor({ kind: 'gallery-image-picker', key: 'entryId', label: 'Image' })).toEqual({ key: 'entryId', kind: 'image' });
    expect(bindTargetFor({ kind: 'text', key: 'filePath', label: 'Video' }, 'video')).toEqual({ key: 'filePath', kind: 'video' });
    expect(bindTargetFor({ kind: 'text', key: 'filePath', label: 'Path' }, 'image')).toEqual({ key: 'filePath', kind: 'text' });
    expect(bindTargetFor({ kind: 'number', key: 'width', label: 'W' })).toEqual({ key: 'width', kind: 'number' });
  });
});

describe('exposeParam / unexposeParam', () => {
  it('creates a param bound to the key, seeded with the field hints and the current value as default', () => {
    const next = exposeParam(doc(), {
      nodeId: 'n-text',
      field: { kind: 'prompt', key: 'prompt', label: 'Text', placeholder: 'Describe…', rows: 6 },
    });
    expect(next.params).toEqual([
      { id: 'prompt', label: 'Text', kind: 'prompt', bind: [{ nodeId: 'n-text', key: 'prompt' }], placeholder: 'Describe…', rows: 6, default: 'a fox' },
    ]);
    expect(lockedKeys(next, 'n-text')).toEqual(new Set(['prompt']));
    expect(boundParam(next, 'n-text', 'prompt')?.id).toBe('prompt');
    expect(boundParam(next, 'n-img', 'prompt')).toBeNull();
    // Idempotent: exposing again changes nothing.
    expect(exposeParam(next, { nodeId: 'n-text', field: { kind: 'prompt', key: 'prompt', label: 'Text' } })).toBe(next);
  });

  it('an image upload exposes the path key, adds it to the config, and carries no base64 default', () => {
    const next = exposeParam(doc(), { nodeId: 'n-file', field: { kind: 'image-upload', key: 'base64', label: 'Image file' } });
    expect(next.params[0]).toEqual({ id: 'filepath', label: 'Image file', kind: 'image', bind: [{ nodeId: 'n-file', key: 'filePath' }] });
    expect(next.graph.nodes[1].config).toEqual({ base64: '', fileName: '', filePath: '' });
  });

  it('ids stay unique across nodes; number hints ride along', () => {
    let next = exposeParam(doc(), { nodeId: 'n-text', field: { kind: 'prompt', key: 'prompt', label: 'Text' } });
    next = exposeParam(next, { nodeId: 'n-img', field: { kind: 'number', key: 'count', label: 'Variations', min: 1, max: 4, step: 1 } });
    next = { ...next, graph: { ...next.graph, nodes: [...next.graph.nodes, { id: 'n-text-2', toolId: 'input_text', position: { x: 0, y: 2 }, config: { prompt: '' }, pause: false }] } };
    next = exposeParam(next, { nodeId: 'n-text-2', field: { kind: 'prompt', key: 'prompt', label: 'Text' } });
    expect(next.params.map((p) => p.id)).toEqual(['prompt', 'count', 'prompt-2']);
    expect(next.params[1]).toMatchObject({ kind: 'number', min: 1, max: 4, step: 1, default: 1 });
    expect(paramIdFor(next, 'Count')).toBe('count-2');
  });

  it('unexpose drops the binding and the param when nothing else binds it; a miss is a no-op', () => {
    const exposed = exposeParam(doc(), { nodeId: 'n-text', field: { kind: 'prompt', key: 'prompt', label: 'Text' } });
    const cleared = unexposeParam(exposed, 'n-text', 'prompt');
    expect(cleared.params).toEqual([]);
    expect(unexposeParam(exposed, 'n-img', 'prompt')).toBe(exposed);
    const shared: FlowDoc = { ...exposed, params: [{ ...exposed.params[0], bind: [...exposed.params[0].bind, { nodeId: 'n-img', key: 'prompt' }] }] };
    expect(unexposeParam(shared, 'n-text', 'prompt').params[0].bind).toEqual([{ nodeId: 'n-img', key: 'prompt' }]);
  });
});

describe('pause flag and form values', () => {
  it('setNodePause flips one node; hasPauseNode reads any', () => {
    const d = doc();
    expect(hasPauseNode(d)).toBe(false);
    const paused = setNodePause(d, 'n-img', true);
    expect(paused.graph.nodes.map((n) => n.pause)).toEqual([false, false, true]);
    expect(hasPauseNode(paused)).toBe(true);
    expect(setNodePause(paused, 'n-img', true).graph.nodes[2]).toBe(paused.graph.nodes[2]);
  });

  it('initial values are defaults then the prefill for known ids; required gate reads blanks', () => {
    const params = [
      { id: 'topic', label: 'Topic', kind: 'prompt' as const, required: true, bind: [] },
      { id: 'style', label: 'Style', kind: 'select' as const, default: 'Clean', bind: [] },
    ];
    expect(initialParamValues(params, { topic: 'foxes', nope: 1 })).toEqual({ topic: 'foxes', style: 'Clean' });
    expect(missingRequiredParams(params, { topic: '  ' }).map((p) => p.id)).toEqual(['topic']);
    expect(missingRequiredParams(params, { topic: 'x' })).toEqual([]);
  });
});
