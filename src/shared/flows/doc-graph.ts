// FlowDoc helpers shared by the migration, the store and the canvas: the
// empty doc, the v2 type guard, sink outputs, and the reconcile step the
// canvas runs when it saves a new graph into a doc.
//
// Stage 1: the primary output handle of a sink comes from the caller — the
// canvas passes the registry's first output port (`NodeSpec.outputs[0]`),
// the v1 migration its fixed legacy table — so no tool-id map lives here.

import {
  FLOW_DOC_FORMAT_VERSION,
  type FlowDoc,
  type FlowGraph,
  type FlowNode,
  type FlowOutput,
  type FlowParam,
} from '../types/flows';

/** The handle a sink node exposes; `undefined` → `output`. */
export type PrimaryHandleResolver = (toolId: string) => string | undefined;

const NO_RESOLVER: PrimaryHandleResolver = () => undefined;

function labelForHandle(handle: string): string {
  return handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : 'Output';
}

/** Every node with no outgoing edge, in node order. */
export function deriveSinkOutputs(
  graph: Pick<FlowGraph, 'nodes' | 'edges'>,
  primaryHandle: PrimaryHandleResolver = NO_RESOLVER,
): FlowOutput[] {
  const sources = new Set(graph.edges.map((e) => e.source));
  return graph.nodes
    .filter((n) => !sources.has(n.id))
    .map((n) => {
      const handle = primaryHandle(n.toolId) ?? 'output';
      return { nodeId: n.id, handle, label: labelForHandle(handle) };
    });
}

export function emptyFlowDoc(meta: { id?: string; name?: string; description?: string | null } = {}): FlowDoc {
  return {
    formatVersion: FLOW_DOC_FORMAT_VERSION,
    id: meta.id ?? '',
    name: meta.name ?? 'Untitled flow',
    description: meta.description ?? '',
    params: [],
    graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    outputs: [],
    origin: null,
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Shape check only — `validateFlowDoc` is the structural gate. */
export function isFlowDocV2(x: unknown): x is FlowDoc {
  if (!isRecord(x) || x.formatVersion !== FLOW_DOC_FORMAT_VERSION) return false;
  if (typeof x.id !== 'string' || typeof x.name !== 'string') return false;
  if (!Array.isArray(x.params) || !Array.isArray(x.outputs)) return false;
  const g = x.graph;
  return isRecord(g) && Array.isArray(g.nodes) && Array.isArray(g.edges) && isRecord(g.viewport);
}

/** What the canvas hands back: nodes without a `pause` keep the doc's flag. */
export interface FlowGraphInput {
  nodes: Array<Omit<FlowNode, 'pause'> & { pause?: boolean }>;
  edges: FlowGraph['edges'];
  viewport: FlowGraph['viewport'];
}

/** Drop bindings and outputs that name nodes (or config keys) the new graph
 *  no longer has; when no output survives, fall back to the sinks. Node
 *  `pause` flags carry over by id. */
export function withGraph(
  doc: FlowDoc,
  graph: FlowGraphInput,
  primaryHandle: PrimaryHandleResolver = NO_RESOLVER,
): FlowDoc {
  const previous = new Map(doc.graph.nodes.map((n) => [n.id, n]));
  const nodes: FlowNode[] = graph.nodes.map((n) => ({
    ...n,
    pause: n.pause ?? previous.get(n.id)?.pause ?? false,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const params: FlowParam[] = doc.params
    .map((p) => ({
      ...p,
      bind: p.bind.filter((b) => {
        const node = byId.get(b.nodeId);
        return Boolean(node) && b.key in (node as FlowNode).config;
      }),
    }))
    .filter((p) => p.bind.length > 0);
  const kept = doc.outputs.filter((o) => byId.has(o.nodeId));
  const nextGraph: FlowGraph = { nodes, edges: graph.edges, viewport: graph.viewport };
  return {
    ...doc,
    params,
    graph: nextGraph,
    outputs: kept.length > 0 ? kept : deriveSinkOutputs(nextGraph, primaryHandle),
  };
}
