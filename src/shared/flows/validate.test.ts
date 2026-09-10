// Structural validation without the registry (docs/flows-plan.md §3): bad
// bind, cycle, unknown output, duplicate id — plus the edge cases the codes
// exist for.
import { describe, expect, it } from 'vitest';
import type { FlowDoc, FlowNode } from '../types/flows';
import { validateFlowDoc, type FlowValidationCode } from './validate';

function node(id: string, toolId: string, config: Record<string, unknown> = {}): FlowNode {
  return { id, toolId, position: { x: 0, y: 0 }, config, pause: false };
}

function doc(over: Partial<FlowDoc> = {}): FlowDoc {
  return {
    formatVersion: 2,
    id: '01J8Z3M9K2N4P5Q6R7S8T9V0WX',
    name: 'Explainer',
    description: '',
    params: [
      { id: 'topic', label: 'Topic', kind: 'prompt', required: true, bind: [{ nodeId: 'n-script', key: 'prompt' }] },
    ],
    graph: {
      nodes: [
        node('n-script', 'generate_text', { prompt: '', model: '' }),
        node('n-compose', 'generate_composition', { seconds: 30 }),
        node('n-render', 'render_composition'),
      ],
      edges: [
        { id: 'e1', source: 'n-script', sourceHandle: 'text', target: 'n-compose', targetHandle: 'brief' },
        { id: 'e2', source: 'n-compose', sourceHandle: 'composition', target: 'n-render', targetHandle: 'composition' },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    outputs: [{ nodeId: 'n-render', handle: 'video', label: 'Video' }],
    origin: null,
    ...over,
  };
}

function codes(d: FlowDoc, requireNodes = false): FlowValidationCode[] {
  const r = validateFlowDoc(d, { requireNodes });
  return r.ok ? [] : r.errors.map((e) => e.code);
}

describe('validateFlowDoc', () => {
  it('accepts the plan\'s example shape', () => {
    expect(validateFlowDoc(doc(), { requireNodes: true })).toEqual({ ok: true });
  });

  it('flags a bind to a missing node and to a key the node has no config for', () => {
    const d = doc({
      params: [
        { id: 'a', label: 'A', kind: 'text', bind: [{ nodeId: 'n-nope', key: 'prompt' }] },
        { id: 'b', label: 'B', kind: 'text', bind: [{ nodeId: 'n-script', key: 'temperature' }] },
      ],
    });
    expect(codes(d)).toEqual(['PARAM_BIND_NODE_MISSING', 'PARAM_BIND_KEY_MISSING']);
    const r = validateFlowDoc(d);
    if (r.ok) throw new Error('expected errors');
    expect(r.errors[1]).toMatchObject({ paramId: 'b', nodeId: 'n-script' });
  });

  it('detects a cycle and names a node on it', () => {
    const d = doc();
    d.graph.edges.push({ id: 'e3', source: 'n-render', sourceHandle: 'video', target: 'n-script', targetHandle: 'prompt' });
    expect(codes(d)).toEqual(['GRAPH_CYCLE']);
    const r = validateFlowDoc(d);
    if (r.ok) throw new Error('expected errors');
    expect(['n-script', 'n-compose', 'n-render']).toContain(r.errors[0].nodeId);
  });

  it('flags an output that names an unknown node or no handle', () => {
    const d = doc({ outputs: [{ nodeId: 'n-gone', handle: 'video', label: 'Video' }, { nodeId: 'n-render', handle: '', label: 'X' }] });
    expect(codes(d)).toEqual(['OUTPUT_NODE_MISSING', 'OUTPUT_HANDLE_MISSING']);
  });

  it('flags duplicate node, edge and param ids once each', () => {
    const d = doc();
    d.graph.nodes.push(node('n-script', 'generate_text', { prompt: '' }));
    d.graph.edges.push({ ...d.graph.edges[0] });
    d.params.push({ ...d.params[0] });
    expect(codes(d)).toEqual(['NODE_ID_DUPLICATE', 'EDGE_ID_DUPLICATE', 'PARAM_ID_DUPLICATE']);
  });

  it('flags invalid node ids, missing tools, dangling edges, self loops and empty handles', () => {
    const d = doc();
    d.graph.nodes[0].id = 'tpl-script';
    d.graph.nodes[1].toolId = '';
    d.graph.edges[0].source = 'tpl-script';
    d.graph.edges.push({ id: 'e9', source: 'n-render', sourceHandle: '', target: 'n-render', targetHandle: '' });
    d.graph.edges.push({ id: 'e10', source: 'n-ghost', sourceHandle: 'x', target: 'n-render', targetHandle: 'y' });
    d.params[0].bind[0].nodeId = 'tpl-script';
    expect(codes(d)).toEqual([
      'NODE_ID_INVALID',
      'NODE_TOOL_MISSING',
      'EDGE_SELF_LOOP',
      'EDGE_HANDLE_MISSING',
      'EDGE_NODE_MISSING',
    ]);
  });

  it('flags a bad doc id, a bad param id and an unknown param kind', () => {
    const d = doc({ id: 'not a ulid' });
    d.params[0].id = '1st';
    (d.params[0] as { kind: string }).kind = 'colour';
    expect(codes(d)).toEqual(['DOC_ID_INVALID', 'PARAM_ID_INVALID', 'PARAM_KIND_INVALID']);
    expect(codes(doc({ id: 'vidtsx/thumbnail' }))).toEqual([]);
  });

  it('only requires nodes when asked — a new empty flow is a valid document', () => {
    const empty = doc({ params: [], outputs: [], graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } });
    expect(codes(empty)).toEqual([]);
    expect(codes(empty, true)).toEqual(['GRAPH_EMPTY']);
  });
});
