// Structural validation of a FlowDoc WITHOUT the registry (docs/flows-plan.md
// §3): ids, duplicates, edge ends, param binds, outputs, cycles. The runner
// adds the registry checks (unknown tool, unmet capability, unbound required
// input) on top.

import type { FlowDoc, FlowParamKind } from '../types/flows';
import { isValidFlowNodeId } from './migrate-v1';
import { topoSort } from './topo-sort';

export type FlowValidationCode =
  | 'DOC_ID_INVALID'
  | 'GRAPH_EMPTY'
  | 'NODE_ID_INVALID'
  | 'NODE_ID_DUPLICATE'
  | 'NODE_TOOL_MISSING'
  | 'EDGE_ID_DUPLICATE'
  | 'EDGE_NODE_MISSING'
  | 'EDGE_HANDLE_MISSING'
  | 'EDGE_SELF_LOOP'
  | 'PARAM_ID_INVALID'
  | 'PARAM_ID_DUPLICATE'
  | 'PARAM_KIND_INVALID'
  | 'PARAM_BIND_NODE_MISSING'
  | 'PARAM_BIND_KEY_MISSING'
  | 'OUTPUT_NODE_MISSING'
  | 'OUTPUT_HANDLE_MISSING'
  | 'GRAPH_CYCLE';

export interface FlowValidationError {
  code: FlowValidationCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
  paramId?: string;
}

export type FlowValidationResult =
  | { ok: true }
  | { ok: false; errors: FlowValidationError[] };

export interface ValidateFlowDocOptions {
  /** The runner wants at least one node; a freshly created flow has none. */
  requireNodes?: boolean;
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const PACKAGED_ID_RE = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i;
const PARAM_ID_RE = /^[a-z][a-z0-9_-]*$/i;

const PARAM_KINDS: ReadonlySet<string> = new Set<FlowParamKind>([
  'text',
  'prompt',
  'number',
  'select',
  'model-picker',
  'llm-model-picker',
  'video-model-picker',
  'video-model-options',
  'gallery-image-picker',
  'image-upload',
  'image',
  'video',
]);

export function isValidFlowDocId(id: string): boolean {
  return ULID_RE.test(id) || PACKAGED_ID_RE.test(id);
}

export function validateFlowDoc(doc: FlowDoc, opts: ValidateFlowDocOptions = {}): FlowValidationResult {
  const errors: FlowValidationError[] = [];
  const push = (e: FlowValidationError) => errors.push(e);

  if (typeof doc.id !== 'string' || !isValidFlowDocId(doc.id)) {
    push({ code: 'DOC_ID_INVALID', message: `Flow id "${String(doc.id)}" is not a ulid or "<ns>/<name>".` });
  }

  const { nodes, edges } = doc.graph;
  if (opts.requireNodes && nodes.length === 0) {
    push({ code: 'GRAPH_EMPTY', message: 'Add at least one node to the flow.' });
  }

  const nodeById = new Map<string, (typeof nodes)[number]>();
  for (const node of nodes) {
    if (typeof node.id !== 'string' || !isValidFlowNodeId(node.id)) {
      push({ code: 'NODE_ID_INVALID', nodeId: node.id, message: `Node id "${node.id}" is not a ulid or "n-…".` });
    }
    if (nodeById.has(node.id)) {
      push({ code: 'NODE_ID_DUPLICATE', nodeId: node.id, message: `Node id "${node.id}" appears more than once.` });
    } else {
      nodeById.set(node.id, node);
    }
    if (typeof node.toolId !== 'string' || node.toolId.length === 0) {
      push({ code: 'NODE_TOOL_MISSING', nodeId: node.id, message: `Node "${node.id}" names no tool.` });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      push({ code: 'EDGE_ID_DUPLICATE', edgeId: edge.id, message: `Edge id "${edge.id}" appears more than once.` });
    }
    edgeIds.add(edge.id);
    for (const end of [edge.source, edge.target]) {
      if (!nodeById.has(end)) {
        push({ code: 'EDGE_NODE_MISSING', edgeId: edge.id, nodeId: end, message: `Edge "${edge.id}" references missing node "${end}".` });
      }
    }
    if (edge.source === edge.target) {
      push({ code: 'EDGE_SELF_LOOP', edgeId: edge.id, nodeId: edge.source, message: `Edge "${edge.id}" connects node "${edge.source}" to itself.` });
    }
    if (!edge.sourceHandle || !edge.targetHandle) {
      push({ code: 'EDGE_HANDLE_MISSING', edgeId: edge.id, message: `Edge "${edge.id}" is missing a port handle.` });
    }
  }

  const paramIds = new Set<string>();
  for (const param of doc.params) {
    if (typeof param.id !== 'string' || !PARAM_ID_RE.test(param.id)) {
      push({ code: 'PARAM_ID_INVALID', paramId: param.id, message: `Parameter id "${param.id}" is invalid.` });
    }
    if (paramIds.has(param.id)) {
      push({ code: 'PARAM_ID_DUPLICATE', paramId: param.id, message: `Parameter id "${param.id}" appears more than once.` });
    }
    paramIds.add(param.id);
    if (!PARAM_KINDS.has(param.kind)) {
      push({ code: 'PARAM_KIND_INVALID', paramId: param.id, message: `Parameter "${param.id}" has unknown kind "${String(param.kind)}".` });
    }
    for (const bind of param.bind ?? []) {
      const node = nodeById.get(bind.nodeId);
      if (!node) {
        push({ code: 'PARAM_BIND_NODE_MISSING', paramId: param.id, nodeId: bind.nodeId, message: `Parameter "${param.id}" binds to missing node "${bind.nodeId}".` });
        continue;
      }
      if (!(bind.key in node.config)) {
        push({ code: 'PARAM_BIND_KEY_MISSING', paramId: param.id, nodeId: bind.nodeId, message: `Parameter "${param.id}" binds to "${bind.key}", which node "${bind.nodeId}" has no config key for.` });
      }
    }
  }

  for (const output of doc.outputs) {
    if (!nodeById.has(output.nodeId)) {
      push({ code: 'OUTPUT_NODE_MISSING', nodeId: output.nodeId, message: `Output "${output.label}" references missing node "${output.nodeId}".` });
    }
    if (!output.handle) {
      push({ code: 'OUTPUT_HANDLE_MISSING', nodeId: output.nodeId, message: `Output "${output.label}" names no port handle.` });
    }
  }

  // Only meaningful when every edge lands on a real node and ids are unique.
  const structurallySound = !errors.some(
    (e) => e.code === 'EDGE_NODE_MISSING' || e.code === 'NODE_ID_DUPLICATE',
  );
  if (structurallySound) {
    const sorted = topoSort(nodes, edges);
    if (!sorted.ok) {
      push({ code: 'GRAPH_CYCLE', message: sorted.error, nodeId: sorted.remaining[0] });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
