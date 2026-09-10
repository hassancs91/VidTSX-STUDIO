import { Check, Snowflake, Sparkles, X } from 'lucide-react';
import { diffFlowDocs, type FlowDiff } from '@shared/flows/flow-diff';
import { emptyFlowDoc } from '@shared/flows/doc-graph';
import type { FlowDoc, FlowProposal, NodeSpec } from '@shared/types/flows';

interface Props {
  proposal: FlowProposal;
  /** The document on the canvas now; null for an empty new flow. */
  current: FlowDoc | null;
  specs: Record<string, NodeSpec>;
  busy: boolean;
  error: string | null;
  onAccept: () => void;
  onDiscard: () => void;
}

const CHANGE_COLOR = { added: '#34d399', removed: 'var(--color-accent-red)', changed: '#f59e0b' } as const;
const CHANGE_LABEL = { added: 'added', removed: 'removed', changed: 'changed' } as const;

function Row({ change, children }: { change: 'added' | 'removed' | 'changed'; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-[11px] leading-snug" data-proposal-row={change}>
      <span className="mt-[5px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CHANGE_COLOR[change] }} />
      <span className="text-text-secondary">{children}</span>
      <span className="ml-auto text-[9px] uppercase tracking-wider shrink-0" style={{ color: CHANGE_COLOR[change] }}>
        {CHANGE_LABEL[change]}
      </span>
    </li>
  );
}

/** The diff of a proposal as a list — the canvas colours the nodes to match. */
export function proposalDiff(proposal: FlowProposal, current: FlowDoc | null): FlowDiff {
  return diffFlowDocs(current ?? emptyFlowDoc({ id: proposal.doc.id }), proposal.doc);
}

/**
 * The Flow Builder's card (flows plan §1.6, W8 Stage 4): what the proposal
 * adds, removes and changes, with Accept — which saves through the canvas's
 * ordinary save path — and Discard. Floats over the canvas so the coloured
 * nodes stay visible behind it.
 */
export function FlowProposalOverlay({ proposal, current, specs, busy, error, onAccept, onDiscard }: Props) {
  const diff = proposalDiff(proposal, current);
  const labelOf = (toolId: string) => specs[toolId]?.label ?? toolId;
  const nodeName = (id: string) => {
    const node = proposal.doc.graph.nodes.find((n) => n.id === id) ?? current?.graph.nodes.find((n) => n.id === id);
    return node ? labelOf(node.toolId) : id;
  };

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[420px] max-h-[70%] flex flex-col rounded-[8px] bg-app-surface shadow-lg"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-flow-proposal={proposal.id}
      data-flow-proposal-source={proposal.source ?? 'builder'}
    >
      <div className="flex items-center gap-2 px-3 h-[34px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        {proposal.source === 'frozen' ? (
          <Snowflake size={13} strokeWidth={1.75} className="text-accent" />
        ) : (
          <Sparkles size={13} strokeWidth={1.75} className="text-accent" />
        )}
        <span className="text-[12px] font-medium text-text-primary">
          {proposal.source === 'frozen' ? 'Frozen from session' : 'Flow Builder proposes'}
        </span>
        <span className="ml-auto text-[10px] text-text-dim">
          {proposal.flowId ? 'edit' : 'new flow'} · {proposal.doc.graph.nodes.length} nodes
        </span>
      </div>
      <div className="px-3 py-2 text-[11px] text-text-secondary leading-snug" data-proposal-summary>
        {proposal.summary}
      </div>
      <ul className="px-3 pb-2 space-y-1 overflow-y-auto min-h-0">
        {diff.renamed && <Row change="changed">Name or description: “{proposal.doc.name}”</Row>}
        {diff.nodes.map((n) => (
          <Row key={`n-${n.id}`} change={n.change}>
            {labelOf(n.toolId)} <span className="text-text-dim">({n.id})</span>
            {n.keys?.length ? <span className="text-text-dim"> — {n.keys.join(', ')}</span> : null}
          </Row>
        ))}
        {diff.edges.map(({ edge, change }) => (
          <Row key={`e-${edge.id}-${change}`} change={change}>
            {nodeName(edge.source)}.{edge.sourceHandle} → {nodeName(edge.target)}.{edge.targetHandle}
          </Row>
        ))}
        {diff.params.map((p) => (
          <Row key={`p-${p.id}`} change={p.change}>
            Param “{p.label}” <span className="text-text-dim">({p.id})</span>
          </Row>
        ))}
        {diff.outputs.map((o) => (
          <Row key={`o-${o.nodeId}-${o.handle}`} change={o.change}>
            Output {nodeName(o.nodeId)}.{o.handle}
          </Row>
        ))}
        {diff.empty && <li className="text-[11px] text-text-dim">Nothing would change.</li>}
      </ul>
      {error && (
        <div className="px-3 pb-2 text-[10px] text-accent-red" data-proposal-error>
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 px-3 py-2 shrink-0" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <button
          onClick={onDiscard}
          disabled={busy}
          className="flex items-center gap-1 h-[24px] px-2.5 rounded-[5px] text-[11px] text-text-muted hover:bg-app-hover disabled:opacity-40"
          data-proposal-discard
        >
          <X size={12} strokeWidth={2} />
          Discard
        </button>
        <button
          onClick={onAccept}
          disabled={busy || diff.empty}
          className="flex items-center gap-1 h-[24px] px-2.5 rounded-[5px] text-[11px] bg-accent text-white hover:opacity-90 disabled:opacity-40"
          data-proposal-accept
        >
          <Check size={12} strokeWidth={2} />
          Accept
        </button>
      </div>
    </div>
  );
}
