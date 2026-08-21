import type {
  StudioMemory,
  StudioMemoryKind,
  StudioMemoryProposal,
  StudioStylePromotionProposal,
} from '../../types/studio-memory';

// Studio — agent memory (G5): manual entry + MemoryDialog.
// Design: docs/studio/AGENT_MEMORY_DESIGN.md (M6/M7, Rev 2).

/** memory:list — every stored memory, active and inactive. */
export interface MemoryListResponse {
  success: boolean;
  memories?: StudioMemory[];
  error?: string;
}

/** memory:save — create (no id) or edit (id present) one memory.
 *  Provenance is NOT part of the request: everything saved over this channel
 *  is stamped `{ by: 'user' }` in main. Agent provenance only ever comes from
 *  the proposal-accept path (G3/G4), so the renderer cannot forge it. */
export interface MemorySaveRequest {
  id?: string;
  kind: StudioMemoryKind;
  text: string;
  /** vocabulary only — manglings this entry corrects. */
  aliases?: string[];
  /** Kept for record parity (Rev 2.4); the v1 UI never sets it. */
  brandId?: string;
}

export interface MemorySaveResponse {
  success: boolean;
  memory?: StudioMemory;
  error?: string;
}

/** memory:delete — remove a memory outright (idempotent). */
export interface MemoryDeleteRequest {
  id: string;
}

export interface MemoryDeleteResponse {
  success: boolean;
  error?: string;
}

/** memory:set-active — toggle without deleting (keeps the history without
 *  steering the agent). Re-activating a rule at the cap fails with the cap
 *  message from the store. */
export interface MemorySetActiveRequest {
  id: string;
  active: boolean;
}

export interface MemorySetActiveResponse {
  success: boolean;
  memory?: StudioMemory;
  error?: string;
}

/** memory:proposals:get — pending proposals for one project, so the card
 *  survives renderer navigation (fetched on panel mount; new ones arrive on
 *  the agent event stream). */
export interface MemoryProposalsGetRequest {
  projectId: string;
}

export interface MemoryProposalsGetResponse {
  success: boolean;
  proposals?: StudioMemoryProposal[];
  error?: string;
}

/** memory:proposal:resolve — the user's decision on a pending card.
 *  accept lands the memory with agent provenance; passing `edited` is the
 *  edit-then-accept door (kind is fixed — only text/aliases are editable).
 *  If the store refuses (e.g. the rule cap), the proposal STAYS pending so
 *  the user can make room and retry. reject discards it. */
export interface MemoryProposalResolveRequest {
  proposalId: string;
  projectId: string;
  action: 'accept' | 'reject';
  edited?: {
    text: string;
    aliases?: string[];
  };
}

export interface MemoryProposalResolveResponse {
  success: boolean;
  /** The saved record on accept. */
  memory?: StudioMemory;
  error?: string;
}

/** memory:promotions:get — pending style promotions for one project (Q6c),
 *  same navigation-survival contract as memory proposals. */
export interface MemoryPromotionsGetRequest {
  projectId: string;
}

export interface MemoryPromotionsGetResponse {
  success: boolean;
  proposals?: StudioStylePromotionProposal[];
  error?: string;
}

/** memory:promotion:resolve — accept updates the brand's styleNotes AND
 *  retires the promoted memory (one click, both halves in main); reject
 *  discards the card. A brand write failure leaves the proposal pending. */
export interface MemoryPromotionResolveRequest {
  proposalId: string;
  projectId: string;
  action: 'accept' | 'reject';
}

export interface MemoryPromotionResolveResponse {
  success: boolean;
  error?: string;
}
