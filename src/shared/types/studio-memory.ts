// Agent memory record shape — the published contract between the memory
// store (main), the prompt composer, and the Studio memory UI.
// Design: docs/studio/AGENT_MEMORY_DESIGN.md (M1, Rev 2).
//
// The standing rule that shapes everything here: nothing enters memory that
// the user did not see and accept. Records carry provenance so the UI can
// always answer "where did this come from".

export type StudioMemoryKind = 'rule' | 'vocabulary' | 'profile';

export type StudioMemorySource =
  | { by: 'user' }
  /** Accepted from a proposal card. `projectId` names the Studio project that
   *  proposed it; `agentId` the installed agent that did (agents plan §1.10).
   *  Exactly one is set in practice — both are optional so neither side has to
   *  invent an id for the other's field. */
  | { by: 'agent'; projectId?: string; agentId?: string; acceptedAt: string };

export interface StudioMemory {
  id: string;
  kind: StudioMemoryKind;
  /** What the agent reads. For vocabulary: the CORRECT spelling. */
  text: string;
  /** vocabulary only — manglings this entry corrects. */
  aliases?: string[];
  /** Undefined = applies everywhere. Set = only when the open project's
   *  brand matches. V1 ships the field with no UI (Rev 2.4) — every memory
   *  created in v1 is app-wide; the filter exists so brand scope needs no
   *  migration later. */
  brandId?: string;
  /** Agents plan §1.10, following the `brandId` pattern: undefined = applies to
   *  every agent AND to Studio; set = only that agent's sessions. Studio never
   *  sets it and never passes one when reading, so its own view of the store is
   *  exactly the set of entries that existed before agents. */
  agentId?: string;
  /** Off, not deleted — keeps the history without steering the agent. */
  active: boolean;
  source: StudioMemorySource;
  createdAt: string;
  updatedAt: string;
}

/** A pending memory proposal (G3): the agent called `propose_memory` and the
 *  result is waiting for the user's decision as a card in the assistant
 *  panel. NEVER applied directly — accept/edit/reject is the same review
 *  gate as cut plans and shot plans. Pending proposals live in main so
 *  renderer navigation doesn't lose them. */
export interface StudioMemoryProposal {
  id: string;
  /** The project whose assistant panel shows the card. */
  projectId: string;
  kind: StudioMemoryKind;
  text: string;
  /** vocabulary only — manglings the entry would correct. */
  aliases?: string[];
  /** Q6b: rule proposals may be scoped to the project's brand — stamped by
   *  main from project settings at proposal time, never by the agent. */
  brandId?: string;
  /** Display name for the card ("applies to Acme Test only"). */
  brandName?: string;
  createdAt: string;
}

/** Q6c: a pending "promote this rule into the brand" card. Composed by MAIN
 *  at proposal time (rule text, brand, resulting notes) so the card shows
 *  the exact outcome; accept re-validates against a fresh brand read. */
export interface StudioStylePromotionProposal {
  id: string;
  projectId: string;
  /** The brand-scoped rule memory being promoted (retired on accept). */
  memoryId: string;
  ruleText: string;
  brandId: string;
  brandName: string;
  /** The agent's named evidence — which shots/spans the rule held across. */
  evidence: string;
  /** styleNotes before and after, for the card's preview. */
  currentStyleNotes?: string;
  proposedStyleNotes: string;
  /** Exact substring of the current notes the promotion removes, when the
   *  2000-char cap forces a displacement — the proposal must say so. */
  displaces?: string;
  createdAt: string;
}

/** Hard cap on ACTIVE rules — at the cap, accepting one requires
 *  deactivating another (unbounded memory is worse than none). 50 was
 *  decided against the skills already shipping 10,508 chars per turn
 *  (design doc §Rev 2.6). The risk at 50 is instruction dilution, not
 *  cost — revisit when a user with many active rules reports the agent
 *  ignoring one; no token count will show that failure. */
export const MAX_ACTIVE_RULES = 50;

/** Character budget for the composed memory prompt block (~1,750 tokens —
 *  two-thirds of the skill payload already riding every turn, and served
 *  from cache after the first turn). 50 rules × ~80 chars ≈ 4,000 leaves
 *  ~3,000 for vocabulary + profile (§Rev 2.6). */
export const MEMORY_PROMPT_BUDGET = 7000;

/** Character budget for the learned-style block injected into the SHOT
 *  pipeline prompt (Q6a) — rule + profile memories only, brand-filtered.
 *  Sized to the brand styleNotes cap (2000): the two blocks sit side by
 *  side in the shot prompt and neither should dwarf the other. */
export const SHOT_STYLE_PROMPT_BUDGET = 2000;

/** Per-record text ceilings, enforced by the store and mirrored as
 *  maxLength in the entry UI. Sanity ceilings, not budget guarantees —
 *  observed rule length in the spike was 60–110 chars; 300 is generous.
 *  They exist so one pasted wall of text can't silently blow the block
 *  budget (truncation would drop the profile without the user noticing). */
export const MEMORY_TEXT_LIMITS: Record<StudioMemoryKind, number> = {
  rule: 300,
  vocabulary: 120,
  profile: 2500,
};

/** Cap on vocabulary aliases per entry (extras are dropped, not errored). */
export const MAX_MEMORY_ALIASES = 10;
