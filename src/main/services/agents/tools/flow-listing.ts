// The installed-flows listing that rides the `run_flow` tool description
// (flows plan §1.5, §0.1 item 6, W8 Stage 4): every stored flow with its id,
// what it makes, its `params` schema, and its PRICED nodes with a cost hint —
// what lets the agent name the flow and the expected cost before it calls.
//
// The text is cached by a fingerprint of the flows' ids and `updatedAt`s, so
// every session sees the SAME string until a flow actually changes — that is
// what makes the description prompt-cache friendly. Pure over its inputs;
// the db read lives in `flow-service.ts`.

import type { FlowDoc, FlowNode, FlowParam } from '../../../../shared/types/flows';
import { estimateVideoClipCost, formatUsd } from '../../../../shared/presets/video-model-prices';
import { getNode } from './registry-core';
import { listFlowDocs } from '../../flows/flow-service';

export interface PricedNodeLine {
  nodeId: string;
  toolId: string;
  /** e.g. `generate_video (kling-2.5-turbo-pro, 5 s ≈ $0.40)`. */
  text: string;
  /** A dollar estimate when the catalog knows the rate. */
  usd?: number;
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** The cost line for one node, when its tool is priced. */
export function pricedNodeLine(node: FlowNode): PricedNodeLine | null {
  const def = getNode(node.toolId);
  if (!def?.ports?.priced) return null;
  if (node.toolId === 'generate_video') {
    const model = typeof node.config.model === 'string' && node.config.model ? node.config.model : undefined;
    const seconds = asNumber(node.config.durationSeconds) ?? 5;
    const resolution = typeof node.config.resolution === 'string' ? node.config.resolution : '';
    const usd = model ? estimateVideoClipCost(model, seconds, resolution as '' | '480p' | '720p' | '1080p' | '4k') : undefined;
    const cost = usd !== undefined ? `≈ $${formatUsd(usd)}` : 'per-second price, model unknown';
    return {
      nodeId: node.id,
      toolId: node.toolId,
      text: `${node.toolId} (${model ?? 'default model'}, ${seconds} s ${cost})`,
      ...(usd !== undefined ? { usd } : {}),
    };
  }
  const hint = def.ports.priceHint?.();
  return { nodeId: node.id, toolId: node.toolId, text: hint ? `${node.toolId} (${hint})` : node.toolId };
}

/** Every priced node of a flow, in node order. */
export function pricedNodesOf(doc: FlowDoc): PricedNodeLine[] {
  return doc.graph.nodes.map(pricedNodeLine).filter((line): line is PricedNodeLine => line !== null);
}

/** `Priced steps: generate_video (…) — expect about $0.40` or `Free`. */
export function pricedSummary(doc: FlowDoc): string {
  const lines = pricedNodesOf(doc);
  if (lines.length === 0) return 'Priced steps: none (LLM turns run on the session provider).';
  const known = lines.filter((l) => l.usd !== undefined);
  const total = known.reduce((sum, l) => sum + (l.usd ?? 0), 0);
  const suffix =
    known.length === lines.length
      ? ` — expect about $${formatUsd(total)}`
      : known.length > 0
        ? ` — at least $${formatUsd(total)} plus the steps without a known rate`
        : '';
  return `Priced steps: ${lines.map((l) => l.text).join('; ')}${suffix}.`;
}

function paramLine(param: FlowParam): string {
  const bits: string[] = [param.kind];
  if (param.required) bits.push('required');
  if (param.options?.length) {
    bits.push(`one of ${param.options.map((o) => (typeof o === 'string' ? o : o.value)).join(' | ')}`);
  }
  if (param.default !== undefined && param.default !== '') bits.push(`default ${JSON.stringify(param.default)}`);
  if (param.kind === 'video' || param.kind === 'image') bits.push('an absolute file path, or a Video Studio / gallery entry id');
  return `    - ${param.id}: ${param.label} (${bits.join(', ')})`;
}

/** One flow's block of the listing. */
export function describeFlow(doc: FlowDoc): string {
  const steps = doc.graph.nodes.map((n) => n.toolId).join(' → ');
  const outputs = doc.outputs.map((o) => o.label || o.handle).join(', ') || 'none';
  const params = doc.params.length > 0 ? doc.params.map(paramLine).join('\n') : '    (no parameters)';
  return [
    `- "${doc.name}" (id ${doc.id})${doc.description ? ` — ${doc.description}` : ''}`,
    `    steps: ${steps || 'none'}; outputs: ${outputs}`,
    `    ${pricedSummary(doc)}`,
    `    params:`,
    params,
  ].join('\n');
}

let cached: { fingerprint: string; text: string } | null = null;

/** The listing, rebuilt only when a flow changed. */
export function installedFlowsListing(): string {
  const flows = listFlowDocs();
  const fingerprint = flows.map((f) => `${f.doc.id}@${f.updatedAt}`).join('|');
  if (cached && cached.fingerprint === fingerprint) return cached.text;
  const text =
    flows.length === 0
      ? 'No flows are installed yet — the user can create one on the Flows page.'
      : flows.map((f) => describeFlow(f.doc)).join('\n');
  cached = { fingerprint, text };
  return text;
}

/** Test seam — the cache is module state. */
export function clearFlowListingCacheForTests(): void {
  cached = null;
}
