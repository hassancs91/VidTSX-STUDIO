// Pending preset-update cards (W5) — the queue between "learn from this
// video" (the Inspector button or the agent's `propose_preset_update`) and
// the user's accept/reject. Mirrors agent-vocabulary-proposals.ts: main-
// process memory, one pending per project, and losing one to an app restart
// is fine — the preset is only ever written after the user accepts.

import { randomUUID } from 'crypto';
import type { StudioPresetUpdateProposal } from '../../../shared/types/studio-preset';

const pending = new Map<string, StudioPresetUpdateProposal>();

export type AddPresetProposalInput = Omit<StudioPresetUpdateProposal, 'id' | 'createdAt'>;

export function getPendingPresetProposals(projectId: string): StudioPresetUpdateProposal[] {
  const proposal = pending.get(projectId);
  return proposal ? [proposal] : [];
}

export function hasPendingPresetProposal(projectId: string): boolean {
  return pending.has(projectId);
}

/** Queue a card. Throws when one is already pending for the project. */
export function addPresetProposal(input: AddPresetProposalInput): StudioPresetUpdateProposal {
  if (pending.has(input.projectId)) {
    throw new Error("A preset-update card is already waiting for the user's decision — answer it first.");
  }
  const proposal: StudioPresetUpdateProposal = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  pending.set(input.projectId, proposal);
  return proposal;
}

export function findPresetProposal(projectId: string, proposalId: string): StudioPresetUpdateProposal | undefined {
  const proposal = pending.get(projectId);
  return proposal && proposal.id === proposalId ? proposal : undefined;
}

/** Drop a resolved card. Idempotent. */
export function removePresetProposal(projectId: string, proposalId: string): void {
  const proposal = pending.get(projectId);
  if (proposal && proposal.id === proposalId) pending.delete(projectId);
}

/** Test hook — the queue is module state. */
export function clearAllPresetProposals(): void {
  pending.clear();
}
