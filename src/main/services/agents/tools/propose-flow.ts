// `propose_flow` — the Flow Builder proposes a flow (flows plan §1.6, decision
// 8, W8 Stage 4). NEVER WRITES: it validates the proposed document through
// the structural gate AND the registry (unknown tool, bad edge, unfed required
// input), queues ONE card per session, and emits it on the run stream; the
// canvas shows the diff and Accept saves through the ordinary save path.
//
// Two forms, as §1.6 says: a whole document (nodes, edges, params, outputs —
// positions are laid out here when absent) or a patch of named ops
// (`shared/flows/flow-patch.ts`) against the stored flow.

import { z } from 'zod';
import { deriveSinkOutputs, emptyFlowDoc } from '../../../../shared/flows/doc-graph';
import { diffFlowDocs, type FlowDiff } from '../../../../shared/flows/flow-diff';
import { applyFlowPatch, type FlowPatchOp } from '../../../../shared/flows/flow-patch';
import { validateFlowDoc } from '../../../../shared/flows/validate';
import type { FlowDoc, FlowEdge, FlowNode, FlowOutput, FlowParam } from '../../../../shared/types/flows';
import { validateFlowForRun } from '../../flows/flow-validate';
import { loadFlowDoc, resolveFlowRef } from '../../flows/flow-service';
import { addFlowProposal, hasFlowProposal } from '../../flows/flow-proposals';
import { getNode } from './registry-core';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

/** A brand-new flow gets this id until the canvas saves it under the open flow's id. */
export const NEW_FLOW_PROPOSAL_ID = 'proposal/new';
const ALL_CAPS = { imageProvider: true, videoProvider: true, audioProvider: true, agentProvider: true };
const EDGE_RE = /^\s*([^.\s]+)\.(\S+?)\s*->\s*([^.\s]+)\.(\S+)\s*$/;
const COLUMN_X = 400;
const ROW_Y = 220;

const edgeSchema = z.union([
  z.string().describe('"sourceNode.port -> targetNode.port"'),
  z.object({ source: z.string(), sourceHandle: z.string(), target: z.string(), targetHandle: z.string() }),
]);
const nodeSchema = z.object({
  id: z.string().describe('n-<slug>, unique in the flow'),
  toolId: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
  pause: z.boolean().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
const docSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema).optional(),
  params: z.array(z.record(z.string(), z.unknown())).optional().describe('FlowParam[]: { id, label, kind, required?, default?, options?, bind: [{ nodeId, key }] }'),
  outputs: z.array(z.object({ nodeId: z.string(), handle: z.string(), label: z.string().optional() })).optional(),
});

const schema = {
  summary: z.string().min(1).describe('One or two sentences: what the flow does, or what the edit changes and why.'),
  flowId: z.string().optional().describe('The flow to edit (id or exact name). Omit for a NEW flow — it lands on the open canvas.'),
  doc: docSchema.optional().describe('The whole flow: nodes, edges, params, outputs. Positions are laid out for you.'),
  patch: z.array(z.record(z.string(), z.unknown())).optional().describe('Ops against the stored flow instead of a doc: add-node, remove-node, set-config, set-pause, add-edge, remove-edge, expose, unexpose, set-outputs, rename.'),
};

type DocInput = z.infer<typeof docSchema>;
interface ProposeFlowArgs {
  summary: string;
  flowId?: string;
  doc?: DocInput;
  patch?: Record<string, unknown>[];
}

function parseEdge(raw: z.infer<typeof edgeSchema>, index: number): FlowEdge | string {
  if (typeof raw !== 'string') return { id: `e${index + 1}`, ...raw };
  const m = EDGE_RE.exec(raw);
  if (!m) return `Edge "${raw}" is not "node.port -> node.port".`;
  return { id: `e${index + 1}`, source: m[1], sourceHandle: m[2], target: m[3], targetHandle: m[4] };
}

/** Columns by dependency depth, rows within a column — a readable default. */
export function layoutNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const depth = new Map<string, number>();
  const incoming = (id: string) => edges.filter((e) => e.target === id).map((e) => e.source);
  const depthOf = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id) as number;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = incoming(id);
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => depthOf(p, seen)));
    depth.set(id, d);
    return d;
  };
  const rows = new Map<number, number>();
  return nodes.map((n) => {
    if (n.position) return n;
    const d = depthOf(n.id, new Set());
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    return { ...n, position: { x: 80 + d * COLUMN_X, y: 80 + row * ROW_Y } };
  });
}

/** The proposed document from either form. A string is the reason it could not be built. */
export function buildProposedDoc(base: FlowDoc | null, args: Pick<ProposeFlowArgs, 'doc' | 'patch'>): FlowDoc | string {
  if (args.doc && args.patch) return 'Pass either doc or patch, not both.';
  if (args.patch) {
    if (!base) return 'A patch needs flowId — the stored flow it edits. For a new flow pass doc.';
    const result = applyFlowPatch(base, args.patch as unknown as FlowPatchOp[]);
    return result.ok ? result.doc : `Patch op ${result.index + 1} failed: ${result.error}`;
  }
  if (!args.doc) return 'Pass doc (a whole flow) or patch (ops against an existing flow).';
  const start = base ?? emptyFlowDoc({ id: NEW_FLOW_PROPOSAL_ID, name: args.doc.name ?? 'New flow' });
  const edges: FlowEdge[] = [];
  for (const [i, raw] of (args.doc.edges ?? []).entries()) {
    const edge = parseEdge(raw, i);
    if (typeof edge === 'string') return edge;
    edges.push(edge);
  }
  const rawNodes = args.doc.nodes.map((n) => ({
    id: n.id,
    toolId: n.toolId,
    position: n.position as FlowNode['position'],
    config: { ...(getNode(n.toolId)?.ports?.defaultConfig ?? {}), ...(n.config ?? {}) },
    pause: n.pause ?? false,
  }));
  const nodes = layoutNodes(rawNodes, edges);
  const graph = { nodes, edges, viewport: start.graph.viewport };
  const outputs: FlowOutput[] = args.doc.outputs?.length
    ? args.doc.outputs.map((o) => ({ nodeId: o.nodeId, handle: o.handle, label: o.label ?? o.handle }))
    : deriveSinkOutputs(graph, (toolId) => getNode(toolId)?.ports?.outputs[0]?.id);
  return {
    ...start,
    name: args.doc.name ?? start.name,
    description: args.doc.description ?? start.description,
    params: (args.doc.params ?? []) as unknown as FlowParam[],
    graph,
    outputs,
  };
}

/** Both gates; the first problem is the answer. */
export function validateProposal(doc: FlowDoc): string | null {
  const structural = validateFlowDoc(doc, { requireNodes: true });
  if (!structural.ok) return structural.errors.map((e) => e.message).join(' ');
  const run = validateFlowForRun(doc, { getNode }, ALL_CAPS);
  return run.ok ? null : run.error;
}

export function describeDiff(diff: FlowDiff): string {
  const count = (kind: 'added' | 'removed' | 'changed') => diff.nodes.filter((n) => n.change === kind).length;
  const bits = [`+${count('added')} nodes`, `-${count('removed')} nodes`, `${count('changed')} changed`, `${diff.edges.length} edge changes`, `${diff.params.length} param changes`];
  return bits.join(', ');
}

export const proposeFlowTool: AgentToolDef<ProposeFlowArgs> = {
  id: 'propose_flow',
  description:
    'Propose a flow for the user to review on the canvas — a whole doc (new flow, or a rewrite of flowId) or a patch of ops against flowId. It is validated first: every node must be a real node (list_nodes), every edge must join an output port to an input port of a compatible type, every required input must be fed by an edge, a param or config. Nothing is saved until the user clicks Accept. ONE proposal per turn: after calling it, end your turn and wait.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.summary.slice(0, 60));
    if (hasFlowProposal(ctx.sessionId)) {
      return toolText("A flow proposal is already waiting for the user's decision. Do not propose another until they answer it.", true);
    }
    let base: FlowDoc | null = null;
    if (args.flowId) {
      const ref = resolveFlowRef(args.flowId);
      if ('error' in ref) return toolText(ref.error, true);
      base = loadFlowDoc(ref.id).doc;
    }
    const proposed = buildProposedDoc(base, args);
    if (typeof proposed === 'string') return toolText(proposed, true);
    const problem = validateProposal(proposed);
    if (problem) return toolText(`The proposal is not valid: ${problem} Fix it and propose again.`, true);

    const before = base ?? emptyFlowDoc({ id: proposed.id, name: proposed.name });
    const diff = diffFlowDocs(before, proposed);
    if (diff.empty) return toolText('The proposal changes nothing.', true);
    const unmet = proposed.graph.nodes
      .map((n) => getNode(n.toolId))
      .filter((def) => def?.needs)
      .map((def) => `${def?.id} needs ${def?.needs}`);

    try {
      const proposal = addFlowProposal({ agentId: ctx.agentId, sessionId: ctx.sessionId, flowId: base?.id ?? null, doc: proposed, summary: args.summary });
      ctx.emit({ sessionId: ctx.sessionId, kind: 'flow-proposal', proposal });
    } catch (err) {
      return toolText(err instanceof Error ? err.message : String(err), true);
    }
    return toolText(
      `Proposal shown on the canvas (${describeDiff(diff)}; ${proposed.graph.nodes.length} nodes, ${proposed.graph.edges.length} edges, ${proposed.params.length} params).` +
        (unmet.length > 0 ? ` Note: ${[...new Set(unmet)].join('; ')} — the run form shows a chip when it is not configured.` : '') +
        ' The user accepts or discards it there. End your turn now and wait; do not propose another until they answer.',
    );
  },
};
