// Pending memory proposals (G3) — the queue between the agent's
// `propose_memory` call and the user's accept/edit/reject on the card.
// Lives in main-process memory: it must survive renderer navigation (the
// card re-fetches on mount), and an app restart dropping an unanswered
// proposal is acceptable — the memory itself only ever exists after the
// user accepts, so nothing durable is lost.
//
// One pending proposal per project: the agent is told to wait for the
// user's decision before proposing again, and a stack of unanswered cards
// trains reflex-rejection — the failure mode the one-per-turn policy
// exists to prevent (design doc M2).

import { randomUUID } from 'crypto';
import type {
  StudioMemoryKind,
  StudioMemoryProposal,
} from '../../../shared/types/studio-memory';

const pending = new Map<string, StudioMemoryProposal>();

export interface AddProposalInput {
  projectId: string;
  kind: StudioMemoryKind;
  text: string;
  aliases?: string[];
}

export function getPendingProposals(projectId: string): StudioMemoryProposal[] {
  const proposal = pending.get(projectId);
  return proposal ? [proposal] : [];
}

export function hasPendingProposal(projectId: string): boolean {
  return pending.has(projectId);
}

/** Queue a proposal. Throws when one is already pending for the project —
 *  the tool surfaces that message to the agent. */
export function addProposal(input: AddProposalInput): StudioMemoryProposal {
  if (pending.has(input.projectId)) {
    throw new Error(
      "A memory proposal is already waiting for the user's decision — do not propose another until they answer it.",
    );
  }
  const proposal: StudioMemoryProposal = {
    id: randomUUID(),
    projectId: input.projectId,
    kind: input.kind,
    text: input.text,
    ...(input.aliases && input.aliases.length > 0 ? { aliases: input.aliases } : {}),
    createdAt: new Date().toISOString(),
  };
  pending.set(input.projectId, proposal);
  return proposal;
}

export function findProposal(projectId: string, proposalId: string): StudioMemoryProposal | undefined {
  const proposal = pending.get(projectId);
  return proposal && proposal.id === proposalId ? proposal : undefined;
}

/** Drop a resolved proposal. Idempotent — resolving twice is a no-op. */
export function removeProposal(projectId: string, proposalId: string): void {
  const proposal = pending.get(projectId);
  if (proposal && proposal.id === proposalId) pending.delete(projectId);
}

/** Test hook — the queue is module state. */
export function clearAllProposals(): void {
  pending.clear();
}
