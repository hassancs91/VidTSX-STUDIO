// Pending style-promotion proposals (Q6c) — the queue between the agent's
// `propose_style_promotion` call and the user's accept/reject on the card.
// Mirrors agent-memory-proposals.ts deliberately: main-process memory (the
// card re-fetches on mount), one pending per project (a stack of unanswered
// cards trains reflex-rejection), and losing one to an app restart is fine —
// the brand is only ever written after the user accepts.

import { randomUUID } from 'crypto';
import type { StudioStylePromotionProposal } from '../../../shared/types/studio-memory';

const pending = new Map<string, StudioStylePromotionProposal>();

export type AddPromotionInput = Omit<StudioStylePromotionProposal, 'id' | 'createdAt'>;

export function getPendingPromotions(projectId: string): StudioStylePromotionProposal[] {
  const proposal = pending.get(projectId);
  return proposal ? [proposal] : [];
}

export function hasPendingPromotion(projectId: string): boolean {
  return pending.has(projectId);
}

/** Queue a promotion. Throws when one is already pending for the project —
 *  the tool surfaces that message to the agent. */
export function addPromotion(input: AddPromotionInput): StudioStylePromotionProposal {
  if (pending.has(input.projectId)) {
    throw new Error(
      "A style promotion is already waiting for the user's decision — do not propose another until they answer it.",
    );
  }
  const proposal: StudioStylePromotionProposal = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  pending.set(input.projectId, proposal);
  return proposal;
}

export function findPromotion(
  projectId: string,
  proposalId: string,
): StudioStylePromotionProposal | undefined {
  const proposal = pending.get(projectId);
  return proposal && proposal.id === proposalId ? proposal : undefined;
}

/** Drop a resolved promotion. Idempotent — resolving twice is a no-op. */
export function removePromotion(projectId: string, proposalId: string): void {
  const proposal = pending.get(projectId);
  if (proposal && proposal.id === proposalId) pending.delete(projectId);
}

/** Test hook — the queue is module state. */
export function clearAllPromotions(): void {
  pending.clear();
}
