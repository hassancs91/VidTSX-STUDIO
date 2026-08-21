import { ArrowUpToLine } from 'lucide-react';
import type { StudioStylePromotionProposal } from '@shared/types/studio-memory';
import { STYLE_NOTES_MAX } from '@shared/studio/brand';

interface Props {
  proposal: StudioStylePromotionProposal;
  error: string | null;
  resolving: boolean;
  onAccept: () => void;
  onReject: () => void;
}

/** The pending style-promotion card (Q6c): the agent asked to make a learned
 *  rule part of the brand. Accept updates the brand's styleNotes and retires
 *  the memory in one click; reject leaves everything as it is. */
export function StylePromotionCard({ proposal, error, resolving, onAccept, onReject }: Props) {
  return (
    <div
      className="rounded-[8px] bg-app-base p-2.5 space-y-1.5"
      style={{ border: '0.5px solid var(--color-accent, #7F77DD)' }}
      data-style-promotion={proposal.id}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-accent">
        <ArrowUpToLine size={11} strokeWidth={1.75} className="shrink-0" />
        <span className="font-medium">Make this part of the brand?</span>
        <span className="text-text-ghost truncate">· {proposal.brandName}</span>
      </div>

      <div className="text-[11px] text-text-primary leading-snug">{proposal.ruleText}</div>

      <div className="text-[10px] text-text-dim leading-snug">{proposal.evidence}</div>

      {proposal.displaces && (
        <div className="text-[10px] text-accent-amber leading-snug">
          Makes room by removing from the current notes: “{proposal.displaces}”
        </div>
      )}

      <div className="text-[10px] text-text-ghost">
        Style notes after: {proposal.proposedStyleNotes.length}/{STYLE_NOTES_MAX} chars · the
        learned rule retires from memory (the brand carries it instead)
      </div>

      {error && (
        <div className="text-[10px] text-accent-red leading-snug" data-style-promotion-error>
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-1 pt-0.5">
        <button
          type="button"
          onClick={onReject}
          disabled={resolving}
          data-style-promotion-reject
          className="px-2 py-1 rounded-[5px] text-[10px] transition-colors disabled:opacity-40 text-text-muted hover:bg-app-hover hover:text-text-secondary"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={resolving}
          data-style-promotion-accept
          className="px-2 py-1 rounded-[5px] text-[10px] font-medium transition-colors disabled:opacity-40 bg-accent/15 text-accent hover:bg-accent/25"
        >
          Promote to brand
        </button>
      </div>
    </div>
  );
}
