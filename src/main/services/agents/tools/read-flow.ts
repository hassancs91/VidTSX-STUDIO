// `read_flow` — the Flow Builder reads a stored flow (flows plan §1.6, W8
// Stage 4): the document as JSON (nodes with their config, edges, params,
// outputs) plus the last runs. With no id it lists every flow, so the builder
// can find the one the user means. Read-only.

import { z } from 'zod';
import type { FlowDoc } from '../../../../shared/types/flows';
import { listRuns } from '../../flows-runs-db';
import { listFlowDocs, loadFlowDoc, resolveFlowRef } from '../../flows/flow-service';
import { pricedSummary } from './flow-listing';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const schema = {
  flowId: z.string().optional().describe('The flow id or its exact name. Omit to list every flow.'),
};

interface ReadFlowArgs {
  flowId?: string;
}

/** The parts of a doc the builder edits, compact — positions and the viewport are left out. */
export function flowDocForModel(doc: FlowDoc): string {
  return JSON.stringify(
    {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      nodes: doc.graph.nodes.map((n) => ({ id: n.id, toolId: n.toolId, config: n.config, ...(n.pause ? { pause: true } : {}) })),
      edges: doc.graph.edges.map((e) => `${e.source}.${e.sourceHandle} -> ${e.target}.${e.targetHandle}`),
      params: doc.params,
      outputs: doc.outputs,
    },
    null,
    1,
  );
}

export const readFlowTool: AgentToolDef<ReadFlowArgs> = {
  id: 'read_flow',
  description:
    'Read one flow as JSON — nodes with config and pause flags, edges as "node.port -> node.port", params, outputs — with its recent runs. Omit flowId to list every stored flow. Read before proposing an edit.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    if (!args.flowId) {
      const flows = listFlowDocs();
      if (flows.length === 0) return toolText('No flows are stored yet. Propose a new one with propose_flow (flowId omitted).');
      return toolText(
        flows
          .map(({ doc }) => `- "${doc.name}" (id ${doc.id}) — ${doc.graph.nodes.length} nodes: ${doc.graph.nodes.map((n) => n.toolId).join(' → ') || 'empty'}`)
          .join('\n'),
      );
    }
    const ref = resolveFlowRef(args.flowId);
    if ('error' in ref) return toolText(ref.error, true);
    ctx.emitProgress(`Reading "${ref.name}"`);
    const { doc } = loadFlowDoc(ref.id);
    const runs = listRuns(ref.id).slice(0, 5);
    const runLines = runs.length
      ? runs.map((r) => `- ${r.id}: ${r.status}${r.error ? ` — ${r.error}` : ''} (${new Date(r.startedAt).toISOString()})`).join('\n')
      : 'no runs yet';
    return toolText(`${flowDocForModel(doc)}\n\n${pricedSummary(doc)}\n\nRecent runs:\n${runLines}`);
  },
};
