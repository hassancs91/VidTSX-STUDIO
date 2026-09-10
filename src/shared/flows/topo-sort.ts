// Kahn's algorithm over any node/edge shape that carries ids — the v1 canvas
// graph and the v2 FlowDoc alike. Moved from the flows feature in Stage 0 so
// the main runner (Stage 1) and the structural validator share it.

export type TopoResult =
  | { ok: true; order: string[] }
  | { ok: false; error: string; remaining: string[] };

export interface TopoNode {
  id: string;
}

export interface TopoEdge {
  source: string;
  target: string;
}

/** Stable: ties resolve in node order, so the same graph always yields the
 *  same order. Edges naming an unknown node are ignored. */
export function topoSort(nodes: readonly TopoNode[], edges: readonly TopoEdge[]): TopoResult {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) continue;
    adj.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const left = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }

  if (order.length !== nodes.length) {
    const done = new Set(order);
    return {
      ok: false,
      error: 'Cycle detected — flows must be a directed acyclic graph.',
      remaining: nodes.map((n) => n.id).filter((id) => !done.has(id)),
    };
  }

  return { ok: true, order };
}
