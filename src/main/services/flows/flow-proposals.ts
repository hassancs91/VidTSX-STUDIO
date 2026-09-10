// Pending `propose_flow` cards, one per agent session (flows plan §1.6, W8
// Stage 4) — the flows-side twin of `agents/memory-proposals.ts`, for the
// same reasons: main-process memory (the card must survive renderer
// navigation; losing an unanswered proposal on restart costs nothing, because
// a flow only changes after the user accepts), and ONE pending card per
// session, so a stack of unanswered proposals never trains reflex-rejection.
//
// `propose_flow` never writes a flow. Accept goes through the ordinary save
// path in the renderer (`flowsProjectUpdate` / `flowsProjectCreate`), then
// `resolve` drops the card here.

import { randomUUID } from 'crypto';
import type { FlowDoc, FlowProposal } from '../../../shared/types/flows';

const pending = new Map<string, FlowProposal>();

export interface AddFlowProposalInput {
  agentId: string;
  sessionId: string;
  flowId: string | null;
  doc: FlowDoc;
  summary: string;
  /** W8 Stage 5: `frozen` for a session's winning path. */
  source?: FlowProposal['source'];
}

export function getFlowProposal(sessionId: string): FlowProposal | null {
  return pending.get(sessionId) ?? null;
}

export function hasFlowProposal(sessionId: string): boolean {
  return pending.has(sessionId);
}

/** Queue one. Throws when the session already has a card waiting. */
export function addFlowProposal(input: AddFlowProposalInput): FlowProposal {
  if (pending.has(input.sessionId)) {
    throw new Error("A flow proposal is already waiting for the user's decision — do not propose another until they answer it.");
  }
  const proposal: FlowProposal = {
    id: randomUUID(),
    agentId: input.agentId,
    sessionId: input.sessionId,
    flowId: input.flowId,
    doc: structuredClone(input.doc),
    summary: input.summary,
    createdAt: new Date().toISOString(),
    ...(input.source ? { source: input.source } : {}),
  };
  pending.set(input.sessionId, proposal);
  return proposal;
}

/** W8 Stage 5: a new freeze replaces whatever card the session still had. */
export function dropFlowProposal(sessionId: string): boolean {
  return pending.delete(sessionId);
}

/** Drop a resolved card. Idempotent — resolving twice is a no-op. */
export function resolveFlowProposal(sessionId: string, proposalId: string): boolean {
  const proposal = pending.get(sessionId);
  if (!proposal || proposal.id !== proposalId) return false;
  pending.delete(sessionId);
  return true;
}

/** Test hook — the queue is module state. */
export function clearFlowProposalsForTests(): void {
  pending.clear();
}
