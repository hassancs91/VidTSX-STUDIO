// The ordering itself lives in `@shared/flows/topo-sort` (W8 Stage 0) so the
// main runner and the structural validator share it; this file keeps the
// registry-aware `validateGraph` the legacy renderer runner still uses.

import { NODE_REGISTRY } from '../nodes';
import type { GraphJson } from '../types';

export { topoSort } from '@shared/flows/topo-sort';
export type { TopoResult } from '@shared/flows/topo-sort';

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
