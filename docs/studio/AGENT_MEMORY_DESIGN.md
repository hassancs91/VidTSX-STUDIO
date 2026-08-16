# Agent memory design — the editor that learns how you work

> The Studio agent should get better at editing *your* videos the longer you
> use it. Not by guessing: by accumulating a small, inspectable set of things
> you told it, and reading them on every turn.

## What this builds on

Almost none of this is new machinery. Three seams already exist:

- **Prompt composition** — `composeSystemPrompt(basePrompt, skillIds)`
  (`skills-registry.ts:164`) already appends `## Skill: <name>` blocks to the
  agent's system prompt, and the agent already passes `skillIds`
  (`studio-agent.ts:92`). Memory is one more composed block.
- **The review gate** — shot-plan, cut-plan and library organize all follow
  propose → per-item accept/reject → apply. Memory capture reuses it exactly.
- **In-process agent tools** — `propose_cuts` / `propose_shots` are MCP tools
  the agent calls, whose results reach the renderer over the agent event
  stream. `propose_memory` is a sibling, not a new transport.

The design rule that shapes everything below: **nothing enters memory that
the user did not see and accept.** Memory that can't be inspected can't be
debugged, and an agent whose behaviour drifts for unexplainable reasons is
worse than one that never learned anything.

## M1. What a memory is — three tiers, one record

Three kinds, deliberately not merged, because they are read differently:

- **`rule`** — an imperative the agent obeys. *"Cut filler tight."* *"Never
  use zoom transitions."* *"Two cutaways per minute."* This tier does the
  real editing work.
- **`vocabulary`** — a proper noun or spelling, with the manglings it should
  correct. *"LearnWithHasan"* ← *"learn with Hassan"*, *"Remotion"* ←
  *"remotion"*, *"emotion"*. Cheapest tier, unambiguous, immediately useful.
- **`profile`** — a durable fact about the user or channel. *"AI coding
  tutorials for developers, 8–15 minutes, direct and practical."* Sets
  context; changes rarely.

```ts
export type StudioMemoryKind = 'rule' | 'vocabulary' | 'profile';

export interface StudioMemory {
  id: string;
  kind: StudioMemoryKind;
  /** What the agent reads. For vocabulary: the CORRECT spelling. */
  text: string;
  /** vocabulary only — manglings this entry corrects. */
  aliases?: string[];
  /** Undefined = applies everywhere. Set = only when the project's brand
   *  matches (M3). */
  brandId?: string;
  /** Off, not deleted — keeps the history without steering the agent. */
  active: boolean;
  source:
    | { by: 'user' }
    | { by: 'agent'; projectId: string; acceptedAt: string };
  createdAt: string;
  updatedAt: string;
  /** Stamped when the agent CITES this memory in a turn (M5) — not when it
   *  is merely injected. This is the "which of my rules actually matter"
   *  signal that makes pruning possible. */
  lastCitedAt?: string;
}
```

## M2. Capture — two doors, both gated

**Door 1 — you write it.** Free text in the Assets memory section. Always
available, needs no provider, and is the fallback for everything.

**Door 2 — the agent proposes it.** A `propose_memory` in-process tool
alongside `propose_cuts` / `propose_shots`. The result is **never applied** —
it lands as a pending card the user accepts, edits before accepting, or
rejects. Pending proposals persist until answered, so navigating away does
not lose one.

The policy for *when* to propose ships as agent prompt policy (the
`studio-clean-cut` precedent — contracts in tool schemas, policy in prose):

- Propose only when the user states a **general** preference, not a one-off
  instruction. *"Make this one shorter"* → no. *"I always want tight cuts"*
  → yes.
- At most **one proposal per turn**. A chatty memory-proposer trains the user
  to reject reflexively, which destroys the gate's value.
- Never propose something already in memory (the active set is in its prompt,
  so it can see the duplicates).

**Explicitly out of scope: silent inference.** The agent may not conclude a
lesson from a rejection, a re-cut, or an undo. Those signals are ambiguous —
a user rejecting a cut plan may be rejecting the pacing, the take choice, or
their own earlier instruction — and guessing wrong writes a permanent rule
from a misreading.

### Door 2 needs tool support — Door 1 never does

`propose_memory` is an in-process MCP tool, and this app treats tools as
**agent-sdk-only**: `resolveToolSupport` returns `config.type === 'agent-sdk'`
(`studio-agent.ts:124`), so on a `gemini`, `openai-compat` or `local` provider
the agent is built with no MCP server at all and `buildSystemPrompt` switches
to its no-tools variant. That is a deliberate, already-shipped degradation —
`propose_cuts`, `propose_shots` and the rest are equally unavailable there.

Consequences for memory, which the UI must reflect rather than discover:

- **Injection (M4) works on every provider.** Every provider takes a system
  prompt, so memories always steer the agent.
- **Agent-proposed capture works only on `agent-sdk` providers.** On the
  others the Studio surface must say so plainly — *"your AI provider can't
  propose memories; add them yourself in Assets"* — not silently never
  propose, which reads as the feature being broken.
- **Manual entry is the universal floor**, exactly as it is for descriptions
  under L2 Rev 3. Memory is never fully unavailable.

## M3. Scope — app-wide by default, brand when it matters

A memory with no `brandId` applies to every project. A memory with one
applies only when the open project's `settings.brandId` matches.

Rationale: most preferences are about *you* and should follow you everywhere,
which is exactly why per-project memory would be wrong — it never
accumulates, and accumulation is the whole point. But brands already exist as
the "this channel / this client" axis (L3), so a user editing for two clients
gets the one extra dimension that genuinely differs, and no more.

Scope is resolved at prompt-build time, not at write time, so re-pointing a
project at another brand changes which memories apply with no migration.

## M4. Injection — one composed block, hard budget

The active, in-scope memories become a single block appended to the agent's
system prompt through the existing composition step:

```
## How this editor works with you

### Rules you have set
- Cut filler tight — no breathing room between sentences.
- Never use zoom transitions.

### Names and spellings
- "LearnWithHasan" (not "learn with Hassan", "LearnWithHassan")
- "Remotion" (not "remotion", "emotion")

### About you and your channel
AI coding tutorials for developers, 8–15 minutes, direct and practical.
```

Ordering is **rules → vocabulary → profile**, and it is load-bearing: under a
character budget (`MEMORY_PROMPT_BUDGET`, ~2000 chars to start) the lowest
tier truncates first. Rules are imperative and must never be silently
dropped; if rules alone exceed the budget the block is still emitted whole
and the overflow is logged, because a half-applied rule set is worse than a
large prompt.

Composition is a **pure function** of (memories, brandId, budget) — no fs, no
provider — so ordering, filtering and truncation are unit-testable.

### Prompt caching — why the system prompt is the right home

Caching is a **prefix match**, and the render order is `tools` → `system` →
`messages`. Memory in the system prompt therefore sits in the *stable* prefix,
ahead of the volatile conversation, which is the best possible place for it:
the cost is **one cache write plus N cheap reads**, not `memory_tokens × N
requests`. A ~500-token block across a 20-turn session costs about 2.5 turns'
worth of tokens rather than 20. Memory is close to an ideal cache payload —
large, stable, re-read every turn.

This is not theoretical here. The Studio agent already runs at ~95% of input
tokens served from cache (108,861 cache-read vs 5,242 uncached across its
logged runs) with **no `cache_control` anywhere in this codebase** — the Claude
Agent SDK places the breakpoints itself on the `agent-sdk` provider path.

Three rules follow, and the first is load-bearing:

1. **The block MUST be a deterministic function of the active memory set.**
   Order by tier, then by a stable key (`createdAt`, then `id`). **Never order
   or filter by `lastCitedAt`**, never iterate a `Set`, and never render a
   timestamp into the text. `lastCitedAt` mutates whenever the agent cites a
   memory, so letting it reach the block would reorder the prefix on almost
   every turn and silently invalidate the cache forever — no error, just full
   price. It is a column in the Assets UI only.
2. **Accepting a memory mid-session invalidates the cached prefix** for the
   rest of that conversation (one extra cache write on the history, then
   reads resume). This is bounded, rare and user-initiated, so v1 accepts it.
   The proper fix is a mid-conversation system message — appending
   `{role: "system", …}` to `messages[]` rather than editing the top-level
   system prompt preserves the prefix — but it is model-gated and it is not
   yet established whether the Agent SDK exposes it. Treat as a later
   optimization, and verify against the Agent SDK docs before assuming it.
3. **Changing the system prompt does not invalidate the tools cache** (system
   and messages only). So a memory edit never re-bills the tool schemas —
   another reason memory belongs in `system` rather than ahead of `tools`.

Caching is a property of the **provider path**, not of this feature: only
`agent-sdk` providers get it today (`gemini`, `openai-compat` and `local` set
no breakpoints and do not even report `cacheReadInputTokens` back). Memory
costs more per turn on those providers — a reason to prefer `agent-sdk`
providers, not a reason to change this design.

## M5. Hygiene — the part that decides if this compounds or rots

"Gets better with time" and "accumulates junk with time" are the same
mechanism. Five countermeasures, all cheap:

- **Provenance on every entry** — created date, and whether you wrote it or
  accepted it from the agent in a named project. Shown in the UI.
- **Contradiction surfacing at accept time** — accepting a proposal shows the
  existing active memories of the same kind and scope right in the card, with
  a "replaces →" picker. Deterministic and free; no LLM, no false confidence.
  (LLM-assisted conflict detection is a later refinement, not v1.)
- **A cap** — `MAX_ACTIVE_RULES` (40). At the cap, accepting requires
  deactivating something. Unbounded memory is worse than none.
- **Toggle off, not just delete** — preserves history and makes "did this
  rule cause that?" answerable by flipping it.
- **"Applied because"** — when the agent follows a memory it says so in its
  reply, and that citation stamps `lastCitedAt`. This is what turns "the app
  learned" from a feeling into something you can audit, and it gives the
  pruning UI a real signal: rules never cited in months are the ones to cut.

## M6. Surfaces — two views, one store

**In Studio (the assistant panel)** — proposal cards appear where the
correction happened. A user who just told the agent something wants "I'll
remember that" *right there*, not on another screen.

**In Assets (beside Brands)** — the browse, edit, toggle and prune surface,
grouped by tier, with provenance and last-cited shown. Brands already lives
here (L3 Rev 3) and is the same shape of thing: durable, cross-project
preference data that is not a file.

Feature isolation holds: `asset-library` and `studio` never import each
other. Both talk to `src/shared/` types and the memory IPC surface.

## M7. Module layout & IPC

```
src/shared/types/studio-memory.ts        the record shape (published contract)
src/main/services/studio/
  agent-memory.ts                        store: load/upsert/deactivate/delete,
                                         atomic write (project-store precedent)
  agent-memory-prompt.ts                 PURE: scope filter, order, budget,
                                         block composition
  agent-memory-proposals.ts              pending queue (survives navigation)
src/main/ipc/memory-handlers.ts + registrations/memory.ts
src/preload/api/memory.ts
src/features/asset-library/components/MemorySection.tsx   management UI
src/features/studio/components/…          proposal card in the assistant panel
```

**Storage**: `userData/studio/memory.json`, atomic tmp+rename. Not the assets
root — that root is relocatable and shareable, and it holds *content*
(logos, palettes, footage). Memory is *behaviour*, so it belongs with app
state. That is the line between this and brands.

**Channels**: `MEMORY_LIST`, `MEMORY_SAVE`, `MEMORY_DELETE`,
`MEMORY_SET_ACTIVE`, `MEMORY_PROPOSALS_GET`, `MEMORY_PROPOSAL_RESOLVE`
(accept / accept-edited / reject).

## M8. What v1 does NOT do

Named so they do not get built by accident:

- **No semantic retrieval.** All active in-scope memories are injected under
  the budget. The app has embedding models, so retrieval is viable later —
  but it only earns its cost once a user has far more memories than a 2000
  char budget can hold.
- **No STT vocabulary feed.** The transcriber has no word-boost / vocabulary
  hook today (verified), so wiring vocabulary into transcription is real new
  scope. High value, separate slice.
- **No reach beyond the Studio agent.** TSX generation and image prompts do
  not read memory in v1 — one consumer makes it possible to judge whether
  this is actually helping before widening.
- **No silent inference, ever** (M2). This one is a standing rule, not a v1
  deferral.

## Test plan sketch

- **Unit (pure)**: scope filtering (no-brand applies everywhere; branded
  applies only on match); tier ordering; budget truncation drops profile
  before vocabulary before rules; rules never silently dropped; vocabulary
  alias rendering; empty memory set produces no block at all; cap
  enforcement; proposal accept / accept-edited / reject; duplicate rejection.
- **Cache stability (pure, and the one that silently rots if missed)**: the
  composed block is **byte-identical** across two builds of the same active
  set when `lastCitedAt` differs, when the input array order differs, and
  when the set is passed as a `Set` rather than an array; no timestamp
  appears anywhere in the output; toggling a memory to `active: false`
  changes the block exactly once and deterministically.
- **Store**: atomic write round-trip, `active:false` excluded from the block
  but retained on disk, `lastCitedAt` stamping.
- **Live CDP**: state a general preference in the assistant → one proposal
  card → accept → it appears in the Assets memory section with agent
  provenance → next turn the agent's reply cites it and behaviour matches →
  toggle it off → the next turn stops citing it → a one-off instruction
  ("make this one shorter") produces NO proposal.

---

## Decision checklist — ANSWERED (Hasan, 2026-08-16)

1. **M2 — Capture**: manual entry **and** agent-proposed, both behind the
   review gate; silent auto-save rejected. **ANSWERED — gated.**
2. **M3 — Scope**: app-wide by default, with optional brand scope;
   per-project rejected (it never accumulates). **ANSWERED.**
3. **M1 — Tiers in v1**: all three — `rule`, `vocabulary`, `profile`.
   **ANSWERED.**
4. **M8 — Reach in v1**: the Studio editing agent only. **ANSWERED.**

Open, to settle while building:

- **QM1** — Does the profile tier want to be one free-text box rather than a
  list of entries? Proposed: keep it a list for a uniform record and UI, but
  render it as a single paragraph in the prompt block.
- **QM2** — Should `lastCitedAt` drive an automatic "stale rule" prompt after
  N months, or stay a column the user reads? Proposed: a column in v1; any
  automatic nudge is the same ambient-suggestion pattern deferred in L7.
