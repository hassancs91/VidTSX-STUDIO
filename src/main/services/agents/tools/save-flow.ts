// `save_flow` — the agent names a frozen draft (flows plan §1.5 step 4, W8
// Stage 5). The schema allows ONLY a name, a description, the labels and
// ids of the detected params, the set of node config keys to promote to
// params, and pause flags. It cannot add, remove or rewire nodes: the draft
// came from the lineage walk and the graph is not the agent's to change.
// The result is a proposal on the canvas ("Frozen from session …"), never a
// saved flow — the user's Accept is the only write.

import { z } from 'zod';
import { exposeParam, setNodePause } from '../../../../shared/flows/params';
import type { ConfigField, FlowDoc } from '../../../../shared/types/flows';
import { addFlowProposal, dropFlowProposal } from '../../flows/flow-proposals';
import { dropFrozenDraft, getFrozenDraft } from '../../flows/freeze-drafts';
import { validateProposal } from './propose-flow';
import { getNode } from './registry-core';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const paramEdit = z.object({
  id: z.string().describe('The detected param id to edit.'),
  label: z.string().min(1).max(60).optional(),
  newId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional().describe('A new id (lowercase, dashes).'),
}).strict();
const exposeOp = z.object({
  nodeId: z.string(),
  key: z.string().describe('A config key of that node — from the draft listing.'),
  label: z.string().min(1).max(60).optional(),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
}).strict();
const pauseOp = z.object({ nodeId: z.string(), pause: z.boolean() }).strict();

export const saveFlowSchema = {
  name: z.string().min(1).max(80).optional().describe('The flow\'s name.'),
  description: z.string().max(300).optional().describe('One line: what the flow makes from what.'),
  params: z.array(paramEdit).optional().describe('Relabel or re-id the params the freeze detected.'),
  expose: z.array(exposeOp).optional().describe('Promote node config keys to run-form params.'),
  pause: z.array(pauseOp).optional().describe('Set or clear the pause after a step.'),
};

/** The strict shape: anything naming nodes, edges or a graph is refused. */
export const saveFlowStrictSchema = z.object(saveFlowSchema).strict();

interface SaveFlowArgs {
  name?: string;
  description?: string;
  params?: Array<{ id: string; label?: string; newId?: string }>;
  expose?: Array<{ nodeId: string; key: string; label?: string; id?: string }>;
  pause?: Array<{ nodeId: string; pause: boolean }>;
}

function fieldFor(toolId: string, key: string, value: unknown, label: string | undefined): ConfigField {
  const declared = getNode(toolId)?.ports?.configSchema.find((f) => f.key === key);
  if (declared) return label && 'label' in declared ? { ...declared, label } : declared;
  // A port argument the agent filled by hand (`brief`) has no inspector
  // field; it exposes as a prompt, or a number when that is what it holds.
  return typeof value === 'number'
    ? { kind: 'number', key, label: label ?? key }
    : { kind: 'prompt', key, label: label ?? key, rows: 6 };
}

/** Apply the allowed edits to a draft. A string is the first thing refused. */
export function applySaveFlowEdits(draft: FlowDoc, args: SaveFlowArgs): FlowDoc | string {
  let doc: FlowDoc = structuredClone(draft);
  if (args.name) doc.name = args.name.trim();
  if (args.description !== undefined) doc.description = args.description.trim();
  for (const edit of args.params ?? []) {
    const param = doc.params.find((p) => p.id === edit.id);
    if (!param) return `No param "${edit.id}" — the draft has: ${doc.params.map((p) => p.id).join(', ') || 'none'}.`;
    if (edit.label) param.label = edit.label;
    if (edit.newId) {
      if (doc.params.some((p) => p !== param && p.id === edit.newId)) return `Param id "${edit.newId}" is already taken.`;
      param.id = edit.newId;
    }
  }
  for (const op of args.expose ?? []) {
    const node = doc.graph.nodes.find((n) => n.id === op.nodeId);
    if (!node) return `No step "${op.nodeId}" — the draft has: ${doc.graph.nodes.map((n) => n.id).join(', ')}.`;
    if (!(op.key in node.config)) return `Step ${op.nodeId} has no config key "${op.key}" — it has: ${Object.keys(node.config).join(', ')}.`;
    const primaryOutput = getNode(node.toolId)?.ports?.outputs[0]?.dataType;
    const before = doc.params.length;
    doc = exposeParam(doc, { nodeId: node.id, field: fieldFor(node.toolId, op.key, node.config[op.key], op.label), ...(primaryOutput ? { primaryOutput } : {}), ...(op.label ? { label: op.label } : {}) });
    if (op.id && doc.params.length > before) {
      if (doc.params.some((p, i) => i < before && p.id === op.id)) return `Param id "${op.id}" is already taken.`;
      doc.params[doc.params.length - 1].id = op.id;
    }
  }
  for (const op of args.pause ?? []) {
    if (!doc.graph.nodes.some((n) => n.id === op.nodeId)) return `No step "${op.nodeId}" to pause.`;
    doc = setNodePause(doc, op.nodeId, op.pause);
  }
  return doc;
}

export const saveFlowTool: AgentToolDef<SaveFlowArgs> = {
  id: 'save_flow',
  description:
    'Name the frozen draft flow of this session (from freeze_session_to_flow or the user\'s "Freeze into a flow") and choose its run-form params; the steps and their wiring are fixed. The result is shown on the Flows canvas for the user to accept — nothing is saved by this call. Call it once, then end your turn.',
  schema: saveFlowSchema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const draft = getFrozenDraft(ctx.sessionId);
    if (!draft) {
      return toolText('There is no frozen draft in this session — call freeze_session_to_flow with the artifact to freeze first.', true);
    }
    const doc = applySaveFlowEdits(draft.doc, args);
    if (typeof doc === 'string') return toolText(doc, true);
    const problem = validateProposal(doc);
    if (problem) return toolText(`The flow is not valid after those edits: ${problem}`, true);
    ctx.emitProgress(doc.name);
    dropFlowProposal(ctx.sessionId);
    try {
      const proposal = addFlowProposal({
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        flowId: null,
        doc,
        summary: `Frozen from this session — "${doc.name}": ${doc.graph.nodes.length} steps, ${doc.params.length} params. Accept to save it as a flow.`,
        source: 'frozen',
      });
      ctx.emit({ sessionId: ctx.sessionId, kind: 'flow-proposal', proposal });
    } catch (err) {
      return toolText(err instanceof Error ? err.message : String(err), true);
    }
    dropFrozenDraft(ctx.sessionId);
    return toolText(
      `"${doc.name}" is shown on the Flows canvas with ${doc.params.length} param(s): ${doc.params.map((p) => p.label).join(', ') || 'none'}. The user accepts or discards it there. End your turn now.`,
    );
  },
};
