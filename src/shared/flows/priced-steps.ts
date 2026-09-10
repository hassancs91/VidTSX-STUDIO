// The "Priced steps: …" line (flows plan §0.1 item 6): which nodes of a flow
// spend money, read off the registry's `NodeSpec.priced` / `priceHint`, in
// graph order. Pure — the run form renders it, and Stage 4's `run_flow`
// description lists the same steps.

import type { FlowDoc, NodeSpec } from '../types/flows';

export interface PricedStep {
  nodeId: string;
  label: string;
  priceHint?: string;
}

export type PricedSpecs = Readonly<Record<string, Pick<NodeSpec, 'label' | 'priced' | 'priceHint'>>>;

export function pricedSteps(doc: Pick<FlowDoc, 'graph'>, specs: PricedSpecs): PricedStep[] {
  const steps: PricedStep[] = [];
  for (const node of doc.graph.nodes) {
    const spec = specs[node.toolId];
    if (!spec?.priced) continue;
    steps.push({ nodeId: node.id, label: spec.label, ...(spec.priceHint ? { priceHint: spec.priceHint } : {}) });
  }
  return steps;
}

/** `Priced steps: Generate Video (…), Generate Image` — or `''` for a free flow. */
export function pricedStepsLine(steps: readonly PricedStep[]): string {
  if (steps.length === 0) return '';
  const counts = new Map<string, { n: number; hint?: string }>();
  for (const step of steps) {
    const entry = counts.get(step.label) ?? { n: 0, ...(step.priceHint ? { hint: step.priceHint } : {}) };
    entry.n += 1;
    counts.set(step.label, entry);
  }
  const parts = [...counts.entries()].map(([label, { n, hint }]) => {
    const name = n > 1 ? `${label} ×${n}` : label;
    return hint ? `${name} (${hint})` : name;
  });
  return `Priced steps: ${parts.join(', ')}`;
}
