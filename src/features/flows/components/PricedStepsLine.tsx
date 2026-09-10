import { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import type { FlowDoc, NodeSpec } from '@shared/types/flows';
import { pricedSteps, pricedStepsLine } from '@shared/flows/priced-steps';

interface Props {
  doc: Pick<FlowDoc, 'graph'>;
  specs: Record<string, NodeSpec>;
}

/** §0.1 item 6: the priced nodes of this flow, named before Run. Nothing for a free flow. */
export function PricedStepsLine({ doc, specs }: Props) {
  const line = useMemo(() => pricedStepsLine(pricedSteps(doc, specs)), [doc, specs]);
  if (!line) return null;
  return (
    <div className="flex items-start gap-1.5 text-[11px] text-text-muted leading-snug" data-priced-steps>
      <DollarSign size={11} strokeWidth={1.75} className="shrink-0 mt-[2px] text-accent-amber" />
      <span>{line}</span>
    </div>
  );
}
