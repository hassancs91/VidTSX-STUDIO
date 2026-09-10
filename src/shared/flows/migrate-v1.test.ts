// v1 GraphJson → v2 FlowDoc (docs/flows-plan.md §1.1, Stage 0): the three
// shipped templates round-trip, a saved flow with a removed model id keeps
// it, ids are rewritten deterministically and edges follow.
import { describe, expect, it } from 'vitest';
import { FLOW_TEMPLATES } from '../../features/flows/templates';
import { FLOW_DOC_FORMAT_VERSION, type FlowDoc } from '../types/flows';
import {
  V1_TOOL_ALIASES,
  isFlowDocV2,
  isValidFlowNodeId,
  legacyPrimaryHandle,
  migrateGraphV1,
  normalizeFlowNodeId,
  parseFlowDoc,
  toolIdForLegacyTypeId,
} from './migrate-v1';
import { validateFlowDoc } from './validate';

const META = { id: '01J8Z3M9K2N4P5Q6R7S8T9V0WX', name: 'Test flow', description: 'd' };

describe('the three current templates', () => {
  it('ships exactly three, all on legacy type ids the alias table knows', () => {
    expect(FLOW_TEMPLATES).toHaveLength(3);
    for (const t of FLOW_TEMPLATES) {
      for (const n of t.graph.nodes) expect(V1_TOOL_ALIASES[n.data.typeId]).toBeDefined();
    }
  });

  it.each(FLOW_TEMPLATES.map((t) => [t.id, t] as const))('%s migrates and validates', (_id, t) => {
    const doc = migrateGraphV1(t.graph, META);
    expect(doc.formatVersion).toBe(FLOW_DOC_FORMAT_VERSION);
    expect(doc.id).toBe(META.id);
    expect(doc.params).toEqual([]);
    expect(doc.origin).toBeNull();
    expect(doc.graph.nodes).toHaveLength(t.graph.nodes.length);
    expect(doc.graph.edges).toHaveLength(t.graph.edges.length);
    for (const n of doc.graph.nodes) {
      expect(n.pause).toBe(false);
      expect(isValidFlowNodeId(n.id)).toBe(true);
    }
    // The template's `tpl-*` ids are not valid node ids; they become `n-tpl-*`.
    const original = t.graph.nodes.map((n) => n.id);
    expect(doc.graph.nodes.map((n) => n.id)).toEqual(original.map((id) => `n-${id}`));
    // Edges follow the rewrite and keep their handles.
    for (const [i, e] of doc.graph.edges.entries()) {
      const src = t.graph.edges[i];
      expect(e.source).toBe(`n-${src.source}`);
      expect(e.target).toBe(`n-${src.target}`);
      expect(e.sourceHandle).toBe(src.sourceHandle);
      expect(e.targetHandle).toBe(src.targetHandle);
    }
    // Every template ends in one generate-image sink → one image output.
    expect(doc.outputs).toEqual([{ nodeId: 'n-tpl-generate', handle: 'image', label: 'Image' }]);
    expect(validateFlowDoc(doc, { requireNodes: true })).toEqual({ ok: true });
  });

  it.each(FLOW_TEMPLATES.map((t) => [t.id, t] as const))('%s round-trips positions, configs and type ids', (_id, t) => {
    const doc = migrateGraphV1(t.graph, META);
    for (const [i, n] of doc.graph.nodes.entries()) {
      const src = t.graph.nodes[i];
      expect(n.position).toEqual(src.position);
      expect(n.config).toEqual(src.data.config);
      expect(n.toolId).toBe(V1_TOOL_ALIASES[src.data.typeId]);
      expect(legacyPrimaryHandle(n.toolId)).toBeDefined();
    }
    // A v2 doc passes through parseFlowDoc unchanged.
    const again = parseFlowDoc(JSON.stringify(doc));
    expect(again).toEqual(doc);
    expect(isFlowDocV2(again)).toBe(true);
  });
});

describe('a saved v1 flow', () => {
  // What the canvas actually wrote: reactflow's Node objects with their
  // extra fields, a model id that no longer exists, a null handle.
  const saved = {
    nodes: [
      {
        id: 'n-01J8ZABCDEFGHJKMNPQRSTVWXY',
        type: 'flowNode',
        position: { x: 80, y: 160 },
        positionAbsolute: { x: 80, y: 160 },
        width: 220,
        height: 96,
        selected: true,
        dragging: false,
        data: { typeId: 'input-prompt', config: { prompt: 'a red fox' } },
      },
      {
        id: 'n-01J8ZABCDEFGHJKMNPQRSTVWXZ',
        type: 'flowNode',
        position: { x: 480, y: 120 },
        data: {
          typeId: 'generate-video',
          config: { providerId: 'fal', model: 'seedance-1-lite', aspectRatio: '16:9', durationSeconds: '5' },
        },
      },
    ],
    edges: [
      {
        id: 'e-1',
        source: 'n-01J8ZABCDEFGHJKMNPQRSTVWXY',
        target: 'n-01J8ZABCDEFGHJKMNPQRSTVWXZ',
        sourceHandle: 'text',
        targetHandle: 'prompt',
      },
    ],
    viewport: { x: -20, y: 10, zoom: 0.8 },
  };

  it('keeps a removed model id as-is for the runner to coerce (§11)', () => {
    const doc = migrateGraphV1(saved, META);
    const video = doc.graph.nodes[1];
    expect(video.toolId).toBe('generate_video');
    expect(video.config.model).toBe('seedance-1-lite');
    expect(video.config.providerId).toBe('fal');
  });

  it('keeps the canvas ids (upper-case ULIDs behind n-) and drops reactflow fields', () => {
    const doc = migrateGraphV1(saved, META);
    expect(doc.graph.nodes.map((n) => n.id)).toEqual(saved.nodes.map((n) => n.id));
    expect(Object.keys(doc.graph.nodes[0])).toEqual(['id', 'toolId', 'position', 'config', 'pause']);
    expect(doc.graph.viewport).toEqual(saved.viewport);
    expect(doc.outputs).toEqual([{ nodeId: saved.nodes[1].id, handle: 'video', label: 'Video' }]);
    expect(validateFlowDoc(doc, { requireNodes: true })).toEqual({ ok: true });
  });

  it('is what parseFlowDoc produces from the stored string', () => {
    expect(parseFlowDoc(JSON.stringify(saved), META)).toEqual(migrateGraphV1(saved, META));
  });
});

describe('id repair', () => {
  it('rewrites invalid and duplicate ids deterministically and moves the edges', () => {
    const graph = {
      nodes: [
        { id: 'Prompt #1', type: 'flowNode', position: { x: 0, y: 0 }, data: { typeId: 'input-prompt', config: {} } },
        { id: 'Prompt #1', type: 'flowNode', position: { x: 0, y: 100 }, data: { typeId: 'input-prompt', config: {} } },
        { id: 'gen', type: 'flowNode', position: { x: 300, y: 0 }, data: { typeId: 'generate-image', config: {} } },
      ],
      edges: [
        { id: 'e1', source: 'Prompt #1', target: 'gen', sourceHandle: 'text', targetHandle: 'prompt' },
        { id: 'e2', source: 'ghost', target: 'gen', sourceHandle: 'image', targetHandle: 'sourceImage' },
        { id: 'e3', source: 'gen', target: 'gen', sourceHandle: null, targetHandle: null },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    const a = migrateGraphV1(graph, META);
    const b = migrateGraphV1(graph, META);
    expect(a).toEqual(b);
    expect(a.graph.nodes.map((n) => n.id)).toEqual(['n-prompt-1', 'n-prompt-1-2', 'n-gen']);
    // e1 follows the FIRST holder of the duplicate id; e2 (dangling) is dropped;
    // e3's null handles become '' (the validator names them).
    expect(a.graph.edges.map((e) => [e.id, e.source, e.target, e.sourceHandle])).toEqual([
      ['e1', 'n-prompt-1', 'n-gen', 'text'],
      ['e3', 'n-gen', 'n-gen', ''],
    ]);
  });

  it('accepts ulids and n- ids case-insensitively, and never returns a taken id', () => {
    expect(isValidFlowNodeId('01J8ZABCDEFGHJKMNPQRSTVWXY')).toBe(true);
    expect(isValidFlowNodeId('n-01J8ZABCDEFGHJKMNPQRSTVWXY')).toBe(true);
    expect(isValidFlowNodeId('n-script')).toBe(true);
    expect(isValidFlowNodeId('tpl-prompt')).toBe(false);
    expect(isValidFlowNodeId('n-')).toBe(false);
    expect(normalizeFlowNodeId('n-a', new Set(['n-a', 'n-a-2']))).toBe('n-a-3');
    expect(normalizeFlowNodeId('!!!', new Set())).toBe('n-node');
  });
});

describe('parseFlowDoc', () => {
  it('returns the empty doc for garbage and stray objects', () => {
    for (const raw of ['not json', '{"foo":1}', '[]', 42]) {
      const doc = parseFlowDoc(raw, META);
      expect(doc.formatVersion).toBe(FLOW_DOC_FORMAT_VERSION);
      expect(doc.graph.nodes).toEqual([]);
      expect(doc.id).toBe(META.id);
      expect(doc.name).toBe(META.name);
    }
  });

  it('lets the row override id/name/description of a v2 doc and normalises pause', () => {
    const v2: FlowDoc = {
      ...migrateGraphV1(FLOW_TEMPLATES[0].graph, { id: 'old', name: 'old', description: 'old' }),
    };
    (v2.graph.nodes[0] as { pause: unknown }).pause = undefined;
    const doc = parseFlowDoc(JSON.stringify(v2), META);
    expect(doc.id).toBe(META.id);
    expect(doc.name).toBe(META.name);
    expect(doc.graph.nodes[0].pause).toBe(false);
  });

  it('maps unknown legacy type ids through unchanged', () => {
    expect(toolIdForLegacyTypeId('mystery-node')).toBe('mystery-node');
    expect(legacyPrimaryHandle('transcribe')).toBeUndefined();
  });
});
