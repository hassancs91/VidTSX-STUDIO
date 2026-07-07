import { NODE_REGISTRY } from '../nodes';
import type { GraphEdge, GraphJson, GraphNode } from '../types';

export type TopoResult =
  | { ok: true; order: string[] }
  | { ok: false; error: string };

export function topoSort(nodes: GraphNode[], edges: GraphEdge[]): TopoResult {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adj[node.id] = [];
  }

  for (const edge of edges) {
    if (!(edge.source in inDegree) || !(edge.target in inDegree)) continue;
    adj[edge.source].push(edge.target);
    inDegree[edge.target] += 1;
  }

  const queue: string[] = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of adj[id]) {
      inDegree[next] -= 1;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  if (order.length !== nodes.length) {
    return { ok: false, error: 'Cycle detected — flows must be a directed acyclic graph.' };
  }

  return { ok: true, order };
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateGraph(graph: GraphJson): ValidationResult {
  if (graph.nodes.length === 0) {
    return { ok: false, error: 'Add at least one node to the flow.' };
  }

  for (const node of graph.nodes) {
    const def = NODE_REGISTRY[node.data.typeId];
    if (!def) {
      return { ok: false, error: `Unknown node type: ${node.data.typeId}` };
    }
    for (const input of def.inputs) {
      if (!input.required) continue;
      const hasEdge = graph.edges.some(
        (e) => e.target === node.id && e.targetHandle === input.id,
      );
      if (!hasEdge) {
        return {
          ok: false,
          error: `"${def.label}" is missing required input: ${input.label}.`,
        };
      }
    }
  }

  return { ok: true };
}
