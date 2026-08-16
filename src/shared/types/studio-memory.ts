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
  | { by: 'agent'; projectId: string; acceptedAt: string };

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
  /** Off, not deleted — keeps the history without steering the agent. */
  active: boolean;
  source: StudioMemorySource;
  createdAt: string;
  updatedAt: string;
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
