// Vocabulary-card IPC (W4) — the review gate for `propose_vocabulary`.
// Accept is one click, both halves in main: merge the ticked terms into
// the LIBRARY brand's vocabulary (against a FRESH brand read — the form may
// have changed it since the card was minted), then retire the vocabulary
// memories the brand now carries (leaving both active would inject the
// same name twice). A brand write failure leaves the proposal pending.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  MemoryVocabularyProposalResolveRequest,
  MemoryVocabularyProposalResolveResponse,
  MemoryVocabularyProposalsGetRequest,
  MemoryVocabularyProposalsGetResponse,
} from '../../shared/ipc/types';
import { mergeBrandVocabulary, termKey } from '../../shared/studio/brand-vocabulary';
import { readBrand, updateBrand } from '../services/library/brand-store';
import { getLibraryRoot } from '../services/library/library-paths';
import { listMemories, setMemoryActive } from '../services/studio/agent-memory';
import {
  findVocabularyProposal,
  getPendingVocabularyProposals,
  removeVocabularyProposal,
} from '../services/studio/agent-vocabulary-proposals';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function handleMemoryVocabularyProposalsGet(
  _event: IpcMainInvokeEvent,
  data: MemoryVocabularyProposalsGetRequest,
): Promise<MemoryVocabularyProposalsGetResponse> {
  return { success: true, proposals: getPendingVocabularyProposals(data.projectId) };
}

/** Retire active vocabulary memories (app-wide or this brand's) whose text
 *  is one of the terms the brand now carries. Best-effort per entry. */
async function retireMatchingMemories(terms: readonly string[], brandId: string): Promise<number> {
  const wanted = new Set(terms.map(termKey));
  let retired = 0;
  const memories = await listMemories();
  for (const memory of memories) {
    if (!memory.active || memory.kind !== 'vocabulary' || memory.agentId !== undefined) continue;
    if (memory.brandId !== undefined && memory.brandId !== brandId) continue;
    if (!wanted.has(termKey(memory.text))) continue;
    await setMemoryActive(memory.id, false).catch(() => {
      // Deleted underneath us — the brand write stands.
    });
    retired += 1;
  }
  return retired;
}

export async function handleMemoryVocabularyProposalResolve(
  _event: IpcMainInvokeEvent,
  data: MemoryVocabularyProposalResolveRequest,
): Promise<MemoryVocabularyProposalResolveResponse> {
  const proposal = findVocabularyProposal(data.projectId, data.proposalId);
  if (!proposal) {
    return { success: false, error: 'That vocabulary card is no longer pending.' };
  }
  if (data.action === 'reject') {
    removeVocabularyProposal(data.projectId, data.proposalId);
    return { success: true };
  }
  const ticked = data.terms ? new Set(data.terms.map(termKey)) : null;
  const selected = proposal.terms.filter((t) => ticked === null || ticked.has(termKey(t.term)));
  if (selected.length === 0) {
    return { success: false, error: 'Tick at least one term, or reject the card.' };
  }
  try {
    const root = getLibraryRoot();
    const brand = await readBrand(root, proposal.brandId);
    if (!brand) {
      removeVocabularyProposal(data.projectId, data.proposalId);
      return { success: false, error: 'The brand no longer exists — vocabulary card discarded.' };
    }
    const merged = mergeBrandVocabulary(
      brand.vocabulary,
      selected.map((t) => ({ term: t.term, ...(t.aliases ? { aliases: t.aliases } : {}) })),
    );
    if (merged.overBy > 0) {
      return {
        success: false,
        error: `The brand vocabulary is full — ${merged.overBy} term${merged.overBy === 1 ? '' : 's'} would not fit. Remove some in the Brand form, then retry.`,
      };
    }
    await updateBrand(root, proposal.brandId, {
      name: brand.name,
      palette: brand.palette,
      fonts: brand.fonts,
      logoRefs: brand.logoRefs,
      ...(brand.styleNotes !== undefined ? { styleNotes: brand.styleNotes } : {}),
      vocabulary: merged.next,
    });
    const retiredMemories = await retireMatchingMemories(
      selected.map((t) => t.term),
      proposal.brandId,
    ).catch(() => 0);
    removeVocabularyProposal(data.projectId, data.proposalId);
    return { success: true, added: merged.added, merged: merged.merged, retiredMemories };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to update the brand vocabulary') };
  }
}
