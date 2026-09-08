// Pending `propose_memory` cards, one per agent session (agents plan §1.10).
//
// The Studio agent has the same queue keyed by project
// (`services/studio/agent-memory-proposals.ts`); this is the agents-side copy
// rather than a shared one, because decision 6 keeps `services/studio/`
// untouched and the two key on different things. What they DO share is the
// store they eventually write to, which is the point of §1.10.
//
// One pending proposal per session, for the reason the Studio copy gives: a
// stack of unanswered cards trains reflex-rejection, which is the exact failure
// the review gate exists to prevent (AGENT_MEMORY_DESIGN M2).
//
// Main-process memory, not disk: the card must survive renderer navigation, and
// losing an unanswered proposal on restart costs nothing — the memory only ever
// exists after the user accepts.

import { randomUUID } from 'crypto';
import type { AgentMemoryProposal } from '../../../shared/types/agents';
import type { StudioMemoryKind } from '../../../shared/types/studio-memory';

const pending = new Map<string, AgentMemoryProposal>();

export interface AddAgentProposalInput {
  agentId: string;
  sessionId: string;
  kind: StudioMemoryKind;
  text: string;
  aliases?: string[];
}

function key(agentId: string, sessionId: string): string {
  return `${agentId}::${sessionId}`;
}

export function getAgentProposals(agentId: string, sessionId: string): AgentMemoryProposal[] {
  const proposal = pending.get(key(agentId, sessionId));
  return proposal ? [proposal] : [];
}

export function hasAgentProposal(agentId: string, sessionId: string): boolean {
  return pending.has(key(agentId, sessionId));
}

/** Queue one. Throws when the session already has a card waiting — the tool
 *  surfaces that message to the model. */
export function addAgentProposal(input: AddAgentProposalInput): AgentMemoryProposal {
  if (hasAgentProposal(input.agentId, input.sessionId)) {
    throw new Error(
      "A memory proposal is already waiting for the user's decision — do not propose another until they answer it.",
    );
  }
  const proposal: AgentMemoryProposal = {
    id: randomUUID(),
    agentId: input.agentId,
    sessionId: input.sessionId,
    kind: input.kind,
    text: input.text,
    ...(input.aliases && input.aliases.length > 0 ? { aliases: input.aliases } : {}),
    createdAt: new Date().toISOString(),
  };
  pending.set(key(input.agentId, input.sessionId), proposal);
  return proposal;
}

export function findAgentProposal(
  agentId: string,
  sessionId: string,
  proposalId: string,
): AgentMemoryProposal | undefined {
  const proposal = pending.get(key(agentId, sessionId));
  return proposal && proposal.id === proposalId ? proposal : undefined;
}

/** Drop a resolved card. Idempotent — resolving twice is a no-op. */
export function removeAgentProposal(agentId: string, sessionId: string, proposalId: string): void {
  const k = key(agentId, sessionId);
  const proposal = pending.get(k);
  if (proposal && proposal.id === proposalId) pending.delete(k);
}

/** Test hook — the queue is module state. */
export function clearAgentProposalsForTests(): void {
  pending.clear();
}
