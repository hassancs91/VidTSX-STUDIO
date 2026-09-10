// Registry-aware validation of a FlowDoc before a run (flows plan §1.3):
// the structural gate first (`validateFlowDoc`), then what only the registry
// knows — unknown tool, unmet capability gate, an edge on a handle the tool
// does not have or between incompatible types, a required input nobody
// feeds — and finally the topological order the runner walks.

import type { FlowDoc, FlowNode } from '../../../shared/types/flows';
import { isPortCompatible } from '../../../shared/types/flows';
import { validateFlowDoc } from '../../../shared/flows/validate';
import { topoSort } from '../../../shared/flows/topo-sort';
import type { RegisteredTool, ToolCapabilities } from '../agents/tools/registry';
import { needMet, unmetNeedMessage } from '../agents/tools/invoke-tool';

export interface FlowRegistryView {
  getNode(toolId: string): RegisteredTool | undefined;
}

export type FlowRunValidation =
  | { ok: true; order: string[] }
  | { ok: false; error: string; nodeId?: string };

function nodeLabel(node: FlowNode, def: RegisteredTool | undefined): string {
  return def?.ports?.label ?? node.toolId;
}

function hasValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

/**
 * Everything the runner refuses to start on, as one message the run form
 * shows. Stops at the first problem: a flow with three broken edges wants
 * the canvas, not a list.
 */
export function validateFlowForRun(
  doc: FlowDoc,
  registry: FlowRegistryView,
  capabilities: ToolCapabilities,
): FlowRunValidation {
  const structural = validateFlowDoc(doc, { requireNodes: true });
  if (!structural.ok) {
    const first = structural.errors[0];
    return { ok: false, error: first.message, ...(first.nodeId ? { nodeId: first.nodeId } : {}) };
  }

  const defs = new Map<string, RegisteredTool>();
  for (const node of doc.graph.nodes) {
    const def = registry.getNode(node.toolId);
    if (!def?.ports) {
      return { ok: false, error: `Unknown node "${node.toolId}" — this app has no such tool.`, nodeId: node.id };
    }
    if (def.needs && !needMet(def.needs, capabilities)) {
      return { ok: false, error: unmetNeedMessage(nodeLabel(node, def), def.needs), nodeId: node.id };
    }
    defs.set(node.id, def);
  }

  for (const edge of doc.graph.edges) {
    const sourceDef = defs.get(edge.source);
    const targetDef = defs.get(edge.target);
    const out = sourceDef?.ports?.outputs.find((p) => p.id === edge.sourceHandle);
    const inp = targetDef?.ports?.inputs.find((p) => p.id === edge.targetHandle);
    if (!out) {
      return { ok: false, error: `Edge ${edge.id} leaves a port "${edge.sourceHandle}" that ${sourceDef?.ports?.label ?? edge.source} does not have.`, nodeId: edge.source };
    }
    if (!inp) {
      return { ok: false, error: `Edge ${edge.id} enters a port "${edge.targetHandle}" that ${targetDef?.ports?.label ?? edge.target} does not have.`, nodeId: edge.target };
    }
    if (!isPortCompatible(out.dataType, inp.dataType)) {
      return { ok: false, error: `Edge ${edge.id} connects ${out.dataType} to ${inp.dataType} — the types do not match.`, nodeId: edge.target };
    }
  }

  for (const node of doc.graph.nodes) {
    const def = defs.get(node.id);
    for (const port of def?.ports?.inputs ?? []) {
      if (!port.required) continue;
      const argKey = port.argKey ?? port.id;
      const fed = doc.graph.edges.some((e) => e.target === node.id && e.targetHandle === port.id);
      const bound = doc.params.some((p) => p.bind.some((b) => b.nodeId === node.id && b.key === argKey));
      if (!fed && !bound && !hasValue(node.config[argKey])) {
        return {
          ok: false,
          error: `"${nodeLabel(node, def)}" is missing its required input "${port.label}" — connect a node to it.`,
          nodeId: node.id,
        };
      }
    }
  }

  const sorted = topoSort(doc.graph.nodes, doc.graph.edges);
  if (!sorted.ok) return { ok: false, error: sorted.error, nodeId: sorted.remaining[0] };
  return { ok: true, order: sorted.order };
}
