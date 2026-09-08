// Agents IPC — the `propose_memory` review gate (agents plan §1.10).
//
// The one place an agent proposal becomes a stored memory, and the one place
// the SCOPE is applied: the tool queues a card, the user decides here, and the
// write goes through the SAME store, composer and budget Studio uses. That is
// what §1.10 means by "the mechanism is reused, not rebuilt".
//
// Provenance is stamped in main and is not part of the request — the renderer
// cannot forge `{ by: 'agent' }`, exactly as it cannot on the Studio path.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  AgentMemoryProposalResolveRequest,
  AgentMemoryProposalResolveResponse,
  AgentMemoryProposalsGetRequest,
  AgentMemoryProposalsGetResponse,
} from '@shared/ipc/types';
import { MEMORY_TEXT_LIMITS } from '@shared/types/studio-memory';
import { upsertMemory } from '../services/studio/agent-memory';
import {
  findAgentProposal,
  getAgentProposals,
  removeAgentProposal,
} from '../services/agents/memory-proposals';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AgentMemoryHandlers');

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  log.warn(fallback, { error: message });
  return { success: false, error: message || fallback };
}

export async function handleAgentMemoryProposalsGet(
  _event: IpcMainInvokeEvent,
  data: AgentMemoryProposalsGetRequest,
): Promise<AgentMemoryProposalsGetResponse> {
  try {
    return { success: true, proposals: getAgentProposals(data.agentId, data.sessionId) };
  } catch (err) {
    return fail(err, 'Could not read pending memory proposals');
  }
}

export async function handleAgentMemoryProposalResolve(
  _event: IpcMainInvokeEvent,
  data: AgentMemoryProposalResolveRequest,
): Promise<AgentMemoryProposalResolveResponse> {
  try {
    const proposal = findAgentProposal(data.agentId, data.sessionId, data.proposalId);
    if (!proposal) {
      // Already answered, or the app restarted under it. Idempotent: the card
      // is gone either way, and there is nothing for the user to fix.
      return { success: true };
    }

    if (data.action === 'reject') {
      removeAgentProposal(data.agentId, data.sessionId, data.proposalId);
      return { success: true };
    }

    const text = (data.edited?.text ?? proposal.text).replace(/\s+/g, ' ').trim();
    if (!text) return { success: false, error: 'A memory needs text.' };
    const limit = MEMORY_TEXT_LIMITS[proposal.kind];
    if (text.length > limit) {
      return { success: false, error: `A ${proposal.kind} memory is limited to ${limit} characters.` };
    }
    const aliases = data.edited?.aliases ?? proposal.aliases;

    // §1.10's scope line: 'agent' stamps this agent's id, 'all' leaves the
    // entry app-wide so Studio reads it too. Default is the narrow one.
    const scoped = (data.scope ?? 'agent') === 'agent';

    // The store can refuse (the per-scope rule cap). The card STAYS pending in
    // that case so the user can deactivate one and retry — dropping it would
    // lose a proposal they were trying to accept.
    const memory = await upsertMemory({
      kind: proposal.kind,
      text,
      ...(aliases && aliases.length > 0 ? { aliases } : {}),
      ...(scoped ? { agentId: proposal.agentId } : {}),
      source: { by: 'agent', agentId: proposal.agentId, acceptedAt: new Date().toISOString() },
    });

    removeAgentProposal(data.agentId, data.sessionId, data.proposalId);
    return { success: true, memory };
  } catch (err) {
    return fail(err, 'Could not save that memory');
  }
}
