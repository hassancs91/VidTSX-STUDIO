import type { StudioMemory, StudioMemoryKind } from '../../types/studio-memory';

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
