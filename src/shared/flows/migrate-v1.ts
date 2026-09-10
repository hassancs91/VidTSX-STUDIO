// v1 `GraphJson` → v2 `FlowDoc` (docs/flows-plan.md §1.1, Stage 0). Pure:
// no registry, no I/O. A removed model id is kept as-is in config — the
// runner coerces it later (§11).

import {
  FLOW_DOC_FORMAT_VERSION,
  type FlowDoc,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowViewport,
} from '../types/flows';
import { deriveSinkOutputs, emptyFlowDoc, isFlowDocV2 } from './doc-graph';

export { isFlowDocV2 } from './doc-graph';

/** The canvas's v1 node: reactflow's `Node` with `data.typeId` + `data.config`. */
export interface GraphNodeV1 {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: { typeId: string; config: Record<string, unknown> };
}

export interface GraphEdgeV1 {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface GraphJsonV1 {
  nodes: GraphNodeV1[];
  edges: GraphEdgeV1[];
  viewport: FlowViewport;
}

/** Legacy renderer `typeId` → registry tool id. Fixed; append-only. */
export const V1_TOOL_ALIASES: Readonly<Record<string, string>> = {
  'input-prompt': 'input_text',
  'generate-image': 'generate_image',
  'generate-video': 'generate_video',
  'generate-text': 'generate_text',
  'input-image-from-gallery': 'input_image_library',
  'input-image-upload': 'input_image_file',
};

const V1_TOOL_ALIASES_REVERSE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(V1_TOOL_ALIASES).map(([typeId, toolId]) => [toolId, typeId]),
);

/** Unknown type ids pass through unchanged so the runner can name them. */
export function toolIdForLegacyTypeId(typeId: string): string {
  return V1_TOOL_ALIASES[typeId] ?? typeId;
}

/** The canvas still keys its node definitions by the legacy id (Stage 1
 *  retires that); `null` for tools that never had a renderer node. */
export function legacyTypeIdForToolId(toolId: string): string | null {
  return V1_TOOL_ALIASES_REVERSE[toolId] ?? null;
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const NODE_ID_RE = /^n-[a-z0-9-]+$/i;

export function isValidFlowNodeId(id: string): boolean {
  return ULID_RE.test(id) || NODE_ID_RE.test(id);
}

/** Deterministic rewrite of an invalid id: `n-` + the slug of the old one,
 *  suffixed `-2`, `-3`… when taken. Same input, same output, every time. */
export function normalizeFlowNodeId(id: string, taken: ReadonlySet<string>): string {
  if (isValidFlowNodeId(id) && !taken.has(id)) return id;
  const slug = id
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = isValidFlowNodeId(id) ? id : `n-${slug || 'node'}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface FlowDocMeta {
  id?: string;
  name?: string;
  description?: string | null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function asNumber(x: unknown, fallback: number): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

export function readViewport(x: unknown): FlowViewport {
  const v = isRecord(x) ? x : {};
  return { x: asNumber(v.x, 0), y: asNumber(v.y, 0), zoom: asNumber(v.zoom, 1) };
}

/** Tolerant reader for whatever the canvas wrote: partial objects fill in. */
export function readGraphV1(x: unknown): GraphJsonV1 {
  const g = isRecord(x) ? x : {};
  const nodes: GraphNodeV1[] = [];
  for (const raw of Array.isArray(g.nodes) ? g.nodes : []) {
    if (!isRecord(raw) || typeof raw.id !== 'string') continue;
    const data = isRecord(raw.data) ? raw.data : {};
    const pos = isRecord(raw.position) ? raw.position : {};
    nodes.push({
      id: raw.id,
      type: typeof raw.type === 'string' ? raw.type : 'flowNode',
      position: { x: asNumber(pos.x, 0), y: asNumber(pos.y, 0) },
      data: {
        typeId: typeof data.typeId === 'string' ? data.typeId : '',
        config: isRecord(data.config) ? { ...data.config } : {},
      },
    });
  }
  const edges: GraphEdgeV1[] = [];
  for (const raw of Array.isArray(g.edges) ? g.edges : []) {
    if (!isRecord(raw) || typeof raw.source !== 'string' || typeof raw.target !== 'string') continue;
    edges.push({
      id: typeof raw.id === 'string' ? raw.id : '',
      source: raw.source,
      target: raw.target,
      sourceHandle: typeof raw.sourceHandle === 'string' ? raw.sourceHandle : null,
      targetHandle: typeof raw.targetHandle === 'string' ? raw.targetHandle : null,
    });
  }
  return { nodes, edges, viewport: readViewport(g.viewport) };
}

/** `params` empty, `outputs` = every sink, `pause` false, ids validated and
 *  edges rewritten to match; dangling edges (a missing end) are dropped. */
export function migrateGraphV1(graphJson: unknown, meta: FlowDocMeta = {}): FlowDoc {
  const v1 = readGraphV1(graphJson);
  const taken = new Set<string>();
  const idMap = new Map<string, string>();
  const nodes: FlowNode[] = [];
  for (const n of v1.nodes) {
    const id = normalizeFlowNodeId(n.id, taken);
    taken.add(id);
    if (!idMap.has(n.id)) idMap.set(n.id, id);
    nodes.push({
      id,
      toolId: toolIdForLegacyTypeId(n.data.typeId),
      position: { x: n.position.x, y: n.position.y },
      config: { ...n.data.config },
      pause: false,
    });
  }
  const edges: FlowEdge[] = [];
  const edgeIds = new Set<string>();
  v1.edges.forEach((e, i) => {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    if (!source || !target) return;
    let id = e.id || `e-${source}-${target}-${i}`;
    if (edgeIds.has(id)) id = `${id}-${i}`;
    edgeIds.add(id);
    edges.push({
      id,
      source,
      sourceHandle: e.sourceHandle ?? '',
      target,
      targetHandle: e.targetHandle ?? '',
    });
  });
  const graph: FlowGraph = { nodes, edges, viewport: v1.viewport };
  return {
    formatVersion: FLOW_DOC_FORMAT_VERSION,
    id: meta.id ?? '',
    name: meta.name ?? 'Untitled flow',
    description: meta.description ?? '',
    params: [],
    graph,
    outputs: deriveSinkOutputs(graph),
    origin: null,
  };
}

/** A v2 doc passes through (normalised, `meta` overriding id/name/description
 *  since the SQLite row owns those); a v1 graph migrates; anything else —
 *  unparsable JSON, a stray object — becomes the empty doc. */
export function parseFlowDoc(json: unknown, meta: FlowDocMeta = {}): FlowDoc {
  let value: unknown = json;
  if (typeof json === 'string') {
    try {
      value = JSON.parse(json);
    } catch {
      return emptyFlowDoc(meta);
    }
  }
  if (isFlowDocV2(value)) {
    return {
      ...value,
      id: meta.id ?? value.id,
      name: meta.name ?? value.name,
      description: meta.description ?? value.description ?? '',
      params: value.params.map((p) => ({ ...p, bind: Array.isArray(p.bind) ? p.bind : [] })),
      graph: {
        nodes: value.graph.nodes.map((n) => ({ ...n, config: isRecord(n.config) ? n.config : {}, pause: n.pause === true })),
        edges: value.graph.edges,
        viewport: readViewport(value.graph.viewport),
      },
      origin: value.origin ?? null,
    };
  }
  if (isRecord(value) && Array.isArray(value.nodes)) {
    return migrateGraphV1(value, meta);
  }
  return emptyFlowDoc(meta);
}
