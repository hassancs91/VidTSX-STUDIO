// Agent memory IPC (G5) — thin wrappers over the store in
// services/studio/agent-memory.ts. Every save over this surface is manual
// entry, so provenance is hardcoded to { by: 'user' } here — agent
// provenance is only ever stamped by the proposal-accept path (G3/G4).

import type { IpcMainInvokeEvent } from 'electron';
import type {
  MemoryDeleteRequest,
  MemoryDeleteResponse,
  MemoryListResponse,
  MemoryPromotionResolveRequest,
  MemoryPromotionResolveResponse,
  MemoryPromotionsGetRequest,
  MemoryPromotionsGetResponse,
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
import {
  findPromotion,
  getPendingPromotions,
  removePromotion,
} from '../services/studio/agent-style-promotions';
import { applyStyleNotesPromotion } from '../../shared/studio/brand';
import { readBrand, updateBrand } from '../services/library/brand-store';
import { getLibraryRoot } from '../services/library/library-paths';

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
      ...(data.agentId ? { agentId: data.agentId } : {}),
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
      ...(proposal.brandId ? { brandId: proposal.brandId } : {}),
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

export async function handleMemoryPromotionsGet(
  _event: IpcMainInvokeEvent,
  data: MemoryPromotionsGetRequest,
): Promise<MemoryPromotionsGetResponse> {
  return { success: true, proposals: getPendingPromotions(data.projectId) };
}

/** Q6c accept = one click, both halves in main: write the rule into the
 *  brand's styleNotes, then retire the memory (styleNotes carries it now —
 *  leaving both active would double-inject). Recomposed against a FRESH
 *  brand read: notes may have changed since the card was minted. A brand
 *  write failure leaves the proposal pending for retry. */
export async function handleMemoryPromotionResolve(
  _event: IpcMainInvokeEvent,
  data: MemoryPromotionResolveRequest,
): Promise<MemoryPromotionResolveResponse> {
  const proposal = findPromotion(data.projectId, data.proposalId);
  if (!proposal) {
    return { success: false, error: 'That promotion is no longer pending.' };
  }
  if (data.action === 'reject') {
    removePromotion(data.projectId, data.proposalId);
    return { success: true };
  }
  try {
    const root = getLibraryRoot();
    const brand = await readBrand(root, proposal.brandId);
    if (!brand) {
      removePromotion(data.projectId, data.proposalId);
      return { success: false, error: 'The brand no longer exists — promotion discarded.' };
    }
    const composed = applyStyleNotesPromotion(brand.styleNotes, proposal.ruleText, proposal.displaces);
    if (composed.ok) {
      await updateBrand(root, proposal.brandId, {
        name: brand.name,
        palette: brand.palette,
        fonts: brand.fonts,
        logoRefs: brand.logoRefs,
        styleNotes: composed.next,
      });
    } else if (composed.reason !== 'already-present') {
      // Notes changed underneath the card (edited in the Brand form) and the
      // promotion no longer fits as proposed — surface it, keep the card.
      return {
        success: false,
        error:
          composed.reason === 'over-cap'
            ? `The style notes changed and the rule no longer fits (over by ${String(composed.overBy ?? 0)} chars). Reject the card and let the agent re-propose.`
            : 'The style notes changed and the text this promotion displaces is gone. Reject the card and let the agent re-propose.',
      };
    }
    // Retire the promoted memory — styleNotes carries the rule from here on.
    await setMemoryActive(proposal.memoryId, false).catch(() => {
      // Memory already deleted by the user — the brand write stands.
    });
    removePromotion(data.projectId, data.proposalId);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to apply the promotion') };
  }
}
