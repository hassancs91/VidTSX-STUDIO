// Pending vocabulary proposals (W4) — the queue between the agent's
// `propose_vocabulary` call and the user's accept/reject on the card.
// Mirrors agent-style-promotions.ts deliberately: main-process memory (the
// card re-fetches on mount), one pending per project, and losing one to an
// app restart is fine — the brand is only ever written after the user
// accepts.

import { randomUUID } from 'crypto';
import type { StudioVocabularyProposal } from '../../../shared/types/studio-memory';

const pending = new Map<string, StudioVocabularyProposal>();

export type AddVocabularyProposalInput = Omit<StudioVocabularyProposal, 'id' | 'createdAt'>;

export function getPendingVocabularyProposals(projectId: string): StudioVocabularyProposal[] {
  const proposal = pending.get(projectId);
  return proposal ? [proposal] : [];
}

export function hasPendingVocabularyProposal(projectId: string): boolean {
  return pending.has(projectId);
}

/** Queue a card. Throws when one is already pending for the project —
 *  the tool surfaces that message to the agent. */
export function addVocabularyProposal(input: AddVocabularyProposalInput): StudioVocabularyProposal {
  if (pending.has(input.projectId)) {
    throw new Error(
      "A vocabulary card is already waiting for the user's decision — do not propose another until they answer it.",
    );
  }
  const proposal: StudioVocabularyProposal = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  pending.set(input.projectId, proposal);
  return proposal;
}

export function findVocabularyProposal(
  projectId: string,
  proposalId: string,
): StudioVocabularyProposal | undefined {
  const proposal = pending.get(projectId);
  return proposal && proposal.id === proposalId ? proposal : undefined;
}

/** Drop a resolved card. Idempotent — resolving twice is a no-op. */
export function removeVocabularyProposal(projectId: string, proposalId: string): void {
  const proposal = pending.get(projectId);
  if (proposal && proposal.id === proposalId) pending.delete(projectId);
}

/** Test hook — the queue is module state. */
export function clearAllVocabularyProposals(): void {
  pending.clear();
}
