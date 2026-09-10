// The patch form of `propose_flow` (flows plan §1.6, W8 Stage 4): a short
// list of named operations a model can write reliably — add or remove a
// node, connect or disconnect two ports, set config, pause, expose a param —
// instead of JSON Patch paths into a document it has to reproduce verbatim.
// Pure: apply returns a NEW doc, and the first bad op is the error.

import type { ConfigField, FlowDoc, FlowEdge, FlowNode, FlowParam, FlowParamKind, FlowOutput } from '../types/flows';
import { exposeParam, unexposeParam, setNodePause } from './params';

export type FlowPatchOp =
  | { op: 'add-node'; id: string; toolId: string; config?: Record<string, unknown>; position?: { x: number; y: number }; pause?: boolean }
  | { op: 'remove-node'; id: string }
  | { op: 'set-config'; id: string; config: Record<string, unknown> }
  | { op: 'set-pause'; id: string; pause: boolean }
  | { op: 'add-edge'; source: string; sourceHandle: string; target: string; targetHandle: string }
  | { op: 'remove-edge'; source: string; sourceHandle?: string; target: string; targetHandle?: string }
  | { op: 'expose'; nodeId: string; key: string; kind?: FlowParamKind; label?: string; required?: boolean }
  | { op: 'unexpose'; nodeId: string; key: string }
  | { op: 'set-outputs'; outputs: FlowOutput[] }
  | { op: 'rename'; name?: string; description?: string };

export type FlowPatchResult = { ok: true; doc: FlowDoc } | { ok: false; error: string; index: number };

const NODE_GAP_X = 400;

/** Where a node lands when the op names no position: right of the last one. */
function nextPosition(doc: FlowDoc): { x: number; y: number } {
  const last = doc.graph.nodes[doc.graph.nodes.length - 1];
  return last ? { x: last.position.x + NODE_GAP_X, y: last.position.y } : { x: 80, y: 80 };
}

function edgeId(edges: FlowEdge[]): string {
  let n = edges.length + 1;
  const taken = new Set(edges.map((e) => e.id));
  while (taken.has(`e${n}`)) n += 1;
  return `e${n}`;
}

function applyOne(doc: FlowDoc, op: FlowPatchOp): FlowDoc | string {
  const nodes = doc.graph.nodes;
  const byId = (id: string): FlowNode | undefined => nodes.find((n) => n.id === id);
  switch (op.op) {
    case 'add-node': {
      if (byId(op.id)) return `A node "${op.id}" already exists.`;
      const node: FlowNode = {
        id: op.id,
        toolId: op.toolId,
        position: op.position ?? nextPosition(doc),
        config: { ...(op.config ?? {}) },
        pause: op.pause ?? false,
      };
      return { ...doc, graph: { ...doc.graph, nodes: [...nodes, node] } };
    }
    case 'remove-node': {
      if (!byId(op.id)) return `No node "${op.id}" to remove.`;
      return {
        ...doc,
        graph: {
          ...doc.graph,
          nodes: nodes.filter((n) => n.id !== op.id),
          edges: doc.graph.edges.filter((e) => e.source !== op.id && e.target !== op.id),
        },
        params: doc.params
          .map((p) => ({ ...p, bind: p.bind.filter((b) => b.nodeId !== op.id) }))
          .filter((p) => p.bind.length > 0),
        outputs: doc.outputs.filter((o) => o.nodeId !== op.id),
      };
    }
    case 'set-config': {
      if (!byId(op.id)) return `No node "${op.id}" to configure.`;
      return {
        ...doc,
        graph: {
          ...doc.graph,
          nodes: nodes.map((n) => (n.id === op.id ? { ...n, config: { ...n.config, ...op.config } } : n)),
        },
      };
    }
    case 'set-pause':
      if (!byId(op.id)) return `No node "${op.id}" to pause.`;
      return setNodePause(doc, op.id, op.pause);
    case 'add-edge': {
      if (!byId(op.source)) return `Edge source "${op.source}" is not a node.`;
      if (!byId(op.target)) return `Edge target "${op.target}" is not a node.`;
      const duplicate = doc.graph.edges.some(
        (e) => e.source === op.source && e.sourceHandle === op.sourceHandle && e.target === op.target && e.targetHandle === op.targetHandle,
      );
      if (duplicate) return doc;
      const edge: FlowEdge = { id: edgeId(doc.graph.edges), source: op.source, sourceHandle: op.sourceHandle, target: op.target, targetHandle: op.targetHandle };
      return { ...doc, graph: { ...doc.graph, edges: [...doc.graph.edges, edge] } };
    }
    case 'remove-edge': {
      const keep = doc.graph.edges.filter(
        (e) =>
          !(
            e.source === op.source &&
            e.target === op.target &&
            (op.sourceHandle === undefined || e.sourceHandle === op.sourceHandle) &&
            (op.targetHandle === undefined || e.targetHandle === op.targetHandle)
          ),
      );
      if (keep.length === doc.graph.edges.length) return `No edge from "${op.source}" to "${op.target}" to remove.`;
      return { ...doc, graph: { ...doc.graph, edges: keep } };
    }
    case 'expose': {
      const node = byId(op.nodeId);
      if (!node) return `No node "${op.nodeId}" to expose a parameter on.`;
      const kind: FlowParamKind = op.kind ?? (typeof node.config[op.key] === 'number' ? 'number' : 'text');
      const field = { kind: kind === 'image' || kind === 'video' ? 'text' : kind, key: op.key, label: op.label ?? op.key } as ConfigField;
      const exposed = exposeParam(doc, { nodeId: op.nodeId, field });
      const params: FlowParam[] = exposed.params.map((p) => {
        if (!p.bind.some((b) => b.nodeId === op.nodeId && b.key === op.key)) return p;
        const { default: seeded, ...rest } = p;
        const media = kind === 'image' || kind === 'video';
        return {
          ...rest,
          kind,
          ...(media || seeded === undefined ? {} : { default: seeded }),
          ...(op.label ? { label: op.label } : {}),
          ...(op.required !== undefined ? { required: op.required } : {}),
        };
      });
      return { ...exposed, params };
    }
    case 'unexpose':
      return unexposeParam(doc, op.nodeId, op.key);
    case 'set-outputs': {
      for (const output of op.outputs) {
        if (!byId(output.nodeId)) return `Output names a node "${output.nodeId}" the flow does not have.`;
      }
      return { ...doc, outputs: op.outputs.map((o) => ({ nodeId: o.nodeId, handle: o.handle, label: o.label || o.handle })) };
    }
    case 'rename':
      return {
        ...doc,
        ...(op.name !== undefined && op.name.trim() ? { name: op.name.trim() } : {}),
        ...(op.description !== undefined ? { description: op.description } : {}),
      };
  }
}

/** Apply the ops in order to a copy of `doc`; stop at the first one that fails. */
export function applyFlowPatch(doc: FlowDoc, ops: FlowPatchOp[]): FlowPatchResult {
  let current: FlowDoc = structuredClone(doc);
  for (let i = 0; i < ops.length; i += 1) {
    const next = applyOne(current, ops[i]);
    if (typeof next === 'string') return { ok: false, error: next, index: i };
    current = next;
  }
  return { ok: true, doc: current };
}
