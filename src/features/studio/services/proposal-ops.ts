// Pure edits to the project's proposal list — the same contract as
// timeline-ops: return the IDENTICAL array when an edit rejects, so the
// reducer can skip the undo step.

import type { StudioProposal, StudioProposalItem } from '../types';

export function addProposal(
  proposals: StudioProposal[],
  proposal: StudioProposal,
): StudioProposal[] {
  return [...proposals, proposal];
}

function withProposal(
  proposals: StudioProposal[],
  proposalId: string,
  update: (proposal: StudioProposal) => StudioProposal,
): StudioProposal[] {
  const index = proposals.findIndex((p) => p.id === proposalId);
  if (index < 0) return proposals;
  const next = update(proposals[index]);
  if (next === proposals[index]) return proposals;
  return proposals.map((p, i) => (i === index ? next : p));
}

function withItem(
  proposal: StudioProposal,
  itemId: string,
  update: (item: StudioProposalItem) => StudioProposalItem,
): StudioProposal {
  const index = proposal.items.findIndex((i) => i.id === itemId);
  if (index < 0) return proposal;
  const next = update(proposal.items[index]);
  if (next === proposal.items[index]) return proposal;
  return { ...proposal, items: proposal.items.map((it, i) => (i === index ? next : it)) };
}

/** Accept/reject one item. Only meaningful while the proposal is open. */
export function setProposalItemStatus(
  proposals: StudioProposal[],
  proposalId: string,
  itemId: string,
  status: 'accepted' | 'rejected',
): StudioProposal[] {
  return withProposal(proposals, proposalId, (proposal) => {
    if (proposal.status !== 'proposed') return proposal;
    return withItem(proposal, itemId, (item) =>
      item.status === status ? item : { ...item, status },
    );
  });
}

/** Move one item's edges (drag). Marks the item user-adjusted. */
export function setProposalItemSpan(
  proposals: StudioProposal[],
  proposalId: string,
  itemId: string,
  sourceStart: number,
  sourceEnd: number,
): StudioProposal[] {
  return withProposal(proposals, proposalId, (proposal) => {
    if (proposal.status !== 'proposed') return proposal;
    return withItem(proposal, itemId, (item) => {
      if (item.sourceStart === sourceStart && item.sourceEnd === sourceEnd) return item;
      return { ...item, sourceStart, sourceEnd, adjusted: true };
    });
  });
}

/**
 * Close a proposal after Apply (or Reject all). Applied + every item accepted
 * → `applied`; applied with vetoes → `partial`; nothing applied → `rejected`.
 */
export function closeProposal(
  proposals: StudioProposal[],
  proposalId: string,
  applied: boolean,
): StudioProposal[] {
  return withProposal(proposals, proposalId, (proposal) => {
    if (proposal.status !== 'proposed') return proposal;
    if (!applied) return { ...proposal, status: 'rejected' };
    const anyRejected = proposal.items.some((i) => i.status === 'rejected');
    return { ...proposal, status: anyRejected ? 'partial' : 'applied' };
  });
}
