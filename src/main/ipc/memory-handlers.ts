// Agent memory IPC (G5) — thin wrappers over the store in
// services/studio/agent-memory.ts. Every save over this surface is manual
// entry, so provenance is hardcoded to { by: 'user' } here — agent
// provenance is only ever stamped by the proposal-accept path (G3/G4).

import type { IpcMainInvokeEvent } from 'electron';
import type {
  MemoryDeleteRequest,
  MemoryDeleteResponse,
  MemoryListResponse,
  MemoryProposalResolveRequest,
  MemoryProposalResolveResponse,
  MemoryProposalsGetRequest,
  MemoryProposalsGetResponse,
  MemorySaveRequest,
  MemorySaveResponse,
  MemorySetActiveRequest,
  MemorySetActiveResponse,
} from '../../shared/ipc/types';
import {
  deleteMemory,
  listMemories,
  setMemoryActive,
  upsertMemory,
} from '../services/studio/agent-memory';
import {
  findProposal,
  getPendingProposals,
  removeProposal,
} from '../services/studio/agent-memory-proposals';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function handleMemoryList(): Promise<MemoryListResponse> {
  try {
    return { success: true, memories: await listMemories() };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to load memories') };
  }
}

export async function handleMemorySave(
  _event: IpcMainInvokeEvent,
  data: MemorySaveRequest,
): Promise<MemorySaveResponse> {
  try {
    const memory = await upsertMemory({
      ...(data.id ? { id: data.id } : {}),
      kind: data.kind,
      text: data.text,
      ...(data.aliases ? { aliases: data.aliases } : {}),
      ...(data.brandId ? { brandId: data.brandId } : {}),
      source: { by: 'user' },
    });
    return { success: true, memory };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save the memory') };
  }
}

export async function handleMemorySetActive(
  _event: IpcMainInvokeEvent,
  data: MemorySetActiveRequest,
): Promise<MemorySetActiveResponse> {
  try {
    const memory = await setMemoryActive(data.id, data.active);
    return { success: true, memory };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to update the memory') };
  }
}

export async function handleMemoryDelete(
  _event: IpcMainInvokeEvent,
  data: MemoryDeleteRequest,
): Promise<MemoryDeleteResponse> {
  try {
    await deleteMemory(data.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to delete the memory') };
  }
}

export async function handleMemoryProposalsGet(
  _event: IpcMainInvokeEvent,
  data: MemoryProposalsGetRequest,
): Promise<MemoryProposalsGetResponse> {
  return { success: true, proposals: getPendingProposals(data.projectId) };
}

/** The review-gate decision. Accept stamps AGENT provenance — this is the
 *  only path that does, and it copies the kind from the pending proposal in
 *  main, never from the renderer. A store refusal (rule cap, bad text)
 *  leaves the proposal pending so the user can make room and retry. */
export async function handleMemoryProposalResolve(
  _event: IpcMainInvokeEvent,
  data: MemoryProposalResolveRequest,
): Promise<MemoryProposalResolveResponse> {
  const proposal = findProposal(data.projectId, data.proposalId);
  if (!proposal) {
    return { success: false, error: 'That proposal is no longer pending.' };
  }
  if (data.action === 'reject') {
    removeProposal(data.projectId, data.proposalId);
    return { success: true };
  }
  try {
    const aliases = data.edited ? data.edited.aliases : proposal.aliases;
    const memory = await upsertMemory({
      kind: proposal.kind,
      text: data.edited?.text ?? proposal.text,
      ...(aliases && aliases.length > 0 ? { aliases } : {}),
      source: {
        by: 'agent',
        projectId: proposal.projectId,
        acceptedAt: new Date().toISOString(),
      },
    });
    removeProposal(data.projectId, data.proposalId);
    return { success: true, memory };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save the memory') };
  }
}
