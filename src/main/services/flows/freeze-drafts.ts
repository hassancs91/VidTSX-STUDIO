// Frozen drafts waiting for `save_flow` (flows plan §1.5 step 4, W8 Stage
// 5): one per agent session, main-process memory like the proposal queue.
// A draft is what the lineage walk produced; the agent's one turn turns it
// into a proposal by naming it. Losing an unnamed draft on restart costs
// nothing — the freeze is deterministic and can be run again.

import type { FlowDoc } from '../../../shared/types/flows';

export interface FrozenDraft {
  agentId: string;
  sessionId: string;
  artifactId: string;
  doc: FlowDoc;
  createdAt: string;
}

const drafts = new Map<string, FrozenDraft>();

export function setFrozenDraft(draft: Omit<FrozenDraft, 'createdAt'>): FrozenDraft {
  const stored: FrozenDraft = { ...draft, doc: structuredClone(draft.doc), createdAt: new Date().toISOString() };
  drafts.set(draft.sessionId, stored);
  return stored;
}

export function getFrozenDraft(sessionId: string): FrozenDraft | null {
  const draft = drafts.get(sessionId);
  return draft ? { ...draft, doc: structuredClone(draft.doc) } : null;
}

export function dropFrozenDraft(sessionId: string): boolean {
  return drafts.delete(sessionId);
}

/** Test hook — the stash is module state. */
export function clearFrozenDraftsForTests(): void {
  drafts.clear();
}
