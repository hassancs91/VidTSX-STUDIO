// What changed between two flow documents (flows plan §1.6, W8 Stage 4): the
// canvas colours added nodes green, removed nodes red, and highlights nodes
// whose config, pause flag or tool changed; the overlay lists edges, params
// and outputs the same way. Pure — positions and the viewport never count as
// a change, because a proposal that only moved things is no proposal.

import type { FlowDoc, FlowEdge } from '../types/flows';

export type FlowNodeChange = 'added' | 'removed' | 'changed';

export interface FlowDiff {
  nodes: Array<{ id: string; toolId: string; change: FlowNodeChange; keys?: string[] }>;
  edges: Array<{ edge: FlowEdge; change: 'added' | 'removed' }>;
  params: Array<{ id: string; label: string; change: 'added' | 'removed' | 'changed' }>;
  outputs: Array<{ nodeId: string; handle: string; change: 'added' | 'removed' }>;
  renamed: boolean;
  /** True when nothing above is non-empty. */
  empty: boolean;
}

function edgeKey(e: FlowEdge): string {
  return `${e.source}:${e.sourceHandle}->${e.target}:${e.targetHandle}`;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Config keys whose value differs, in either direction. */
function changedKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => !same(a[k], b[k])).sort();
}

export function diffFlowDocs(before: FlowDoc, after: FlowDoc): FlowDiff {
  const diff: FlowDiff = { nodes: [], edges: [], params: [], outputs: [], renamed: false, empty: true };

  const beforeNodes = new Map(before.graph.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.graph.nodes.map((n) => [n.id, n]));
  for (const node of after.graph.nodes) {
    const prev = beforeNodes.get(node.id);
    if (!prev) {
      diff.nodes.push({ id: node.id, toolId: node.toolId, change: 'added' });
      continue;
    }
    const keys = changedKeys(prev.config, node.config);
    if (prev.toolId !== node.toolId) keys.unshift('toolId');
    if (prev.pause !== node.pause) keys.push('pause');
    if (keys.length > 0) diff.nodes.push({ id: node.id, toolId: node.toolId, change: 'changed', keys });
  }
  for (const node of before.graph.nodes) {
    if (!afterNodes.has(node.id)) diff.nodes.push({ id: node.id, toolId: node.toolId, change: 'removed' });
  }

  const beforeEdges = new Map(before.graph.edges.map((e) => [edgeKey(e), e]));
  const afterEdges = new Map(after.graph.edges.map((e) => [edgeKey(e), e]));
  for (const [key, edge] of afterEdges) if (!beforeEdges.has(key)) diff.edges.push({ edge, change: 'added' });
  for (const [key, edge] of beforeEdges) if (!afterEdges.has(key)) diff.edges.push({ edge, change: 'removed' });

  const beforeParams = new Map(before.params.map((p) => [p.id, p]));
  const afterParams = new Map(after.params.map((p) => [p.id, p]));
  for (const param of after.params) {
    const prev = beforeParams.get(param.id);
    if (!prev) diff.params.push({ id: param.id, label: param.label, change: 'added' });
    else if (!same(prev, param)) diff.params.push({ id: param.id, label: param.label, change: 'changed' });
  }
  for (const param of before.params) {
    if (!afterParams.has(param.id)) diff.params.push({ id: param.id, label: param.label, change: 'removed' });
  }

  const outKey = (o: { nodeId: string; handle: string }) => `${o.nodeId}:${o.handle}`;
  const beforeOut = new Set(before.outputs.map(outKey));
  const afterOut = new Set(after.outputs.map(outKey));
  for (const o of after.outputs) if (!beforeOut.has(outKey(o))) diff.outputs.push({ nodeId: o.nodeId, handle: o.handle, change: 'added' });
  for (const o of before.outputs) if (!afterOut.has(outKey(o))) diff.outputs.push({ nodeId: o.nodeId, handle: o.handle, change: 'removed' });

  diff.renamed = before.name !== after.name || before.description !== after.description;
  diff.empty =
    diff.nodes.length === 0 && diff.edges.length === 0 && diff.params.length === 0 && diff.outputs.length === 0 && !diff.renamed;
  return diff;
}

/** The node-level view the canvas paints: id → change. */
export function nodeChangeMap(diff: FlowDiff): Record<string, FlowNodeChange> {
  return Object.fromEntries(diff.nodes.map((n) => [n.id, n.change]));
}
