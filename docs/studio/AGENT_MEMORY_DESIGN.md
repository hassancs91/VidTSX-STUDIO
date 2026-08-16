# Agent memory design — the editor that learns how you work

> The Studio agent should get better at editing *your* videos the longer you
> use it. Not by guessing: by accumulating a small, inspectable set of things
> you told it, and reading them on every turn.

> **Rev 2 (2026-08-16) — grilled, with a measurement behind it.** The design
> below is Rev 1 and stands except where a `Rev 2:` callout says otherwise.
> The evidence and the revised decisions live in **§Rev 2** at the bottom;
> read it before building. Headline: injection **works** (12/12 runs), agent
> proposal **triggers correctly** (3/3 general, 0/3 one-off), citation **works
> as prose but cannot be parsed into a machine signal** — so `lastCitedAt` is
> cut.

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
  /** REMOVED in Rev 2 — citation is prose, not a parseable signal. See §Rev 2.3.
   *  lastCitedAt?: string; */
}
```

> **Rev 2:** `lastCitedAt` is **cut from the record**. `brandId` **stays in the
> record and in the pure scope filter, but ships with no UI** (§Rev 2.4).

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

> **Rev 2 — this policy was tested before building anything and it holds.**
> With the three bullets above as prose in the prompt and a throwaway
> `propose_memory` tool: a turn where the user states a general preference
> proposed exactly **one** memory in **3/3** runs; a turn where the user gives a
> one-off instruction ("make this one especially tight, I need it under 45 s
> for this upload") proposed **0** in **3/3**. No tuning was needed. Details in
> §Rev 2.2.

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

> **Rev 2 — field yes, UI no.** `brandId` stays in the record and in the pure
> scope filter (three lines, unit-tested), because that is what makes the
> dimension free to add later with no migration. It ships with **no picker and
> no brand column** in v1: every memory is created app-wide. The whole assets
> root today holds exactly one brand, `acme-test`, a fixture — there is no
> second channel to scope against, so the UI would be built for a user who does
> not exist yet. See §Rev 2.4.

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

> **Rev 2 — the block must be the LAST thing in the system prompt**, after the
> composed skills, not part of the base prompt. `composeSystemPrompt` renders
> `${basePrompt}\n\n---\n\n${skills}` (`skills-registry.ts:164`), so a memory
> block folded into `buildAgentSystemPrompt`'s output would sit *ahead* of
> 10,508 chars (~2,600 tokens) of `studio-clean-cut` + `studio-make-tsx`, and
> every memory edit would re-write those skill blocks at cache-write price for
> nothing. Implementation: `composeSystemPrompt(base, skillIds, trailing?)`
> with the memory block passed as `trailing` — prompt assembly stays in one
> place. See §Rev 2.5.

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
   ~~The proper fix is a mid-conversation system message…~~
   > **Rev 2 — verified, and both halves of this were wrong in a useful way.**
   > (a) There is **no session to evict**: `studio-agent.ts` passes no
   > `sessionScope`, so `ClaudeProvider.generate` takes the scope-less branch
   > and closes the session in a `finally` (`claude-provider.ts:203-211`) —
   > every Studio turn already spawns and tears down its own claude.exe. The
   > `matches()` systemPrompt check (`claude-session.ts:112-118`) is never
   > consulted for this agent, so a mid-conversation memory change costs
   > exactly one server-side cache write and nothing else. **M4's "v1 accepts
   > it" stance holds, and cheaply.**
   > (b) The speculated fix **does not exist**: `SDKUserMessage.message` is an
   > Anthropic `MessageParam`, whose role is `user | assistant` only — the SDK
   > exposes no `{role:"system"}` in `messages[]`. The mechanism it *does*
   > expose is `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` with a `string[]` systemPrompt,
   > which splits a custom prompt into a globally-cacheable static prefix and a
   > session-dynamic suffix. That is a different (and better) optimization than
   > the one guessed at — see §Rev 2.5 for why it is **not** worth taking in G.
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
- **A cap** — ~~`MAX_ACTIVE_RULES` (40)~~. At the cap, accepting requires
  deactivating something. Unbounded memory is worse than none.
  > **Rev 2 — 40 and 2000 are arithmetically incompatible.** The rules in the
  > spike ran 60–110 chars; at ~80 chars, 40 rules is ~3,200 chars, so a full
  > rule set overflows a 2,000-char budget on its own — and "rules are never
  > silently dropped" then fires permanently. ~~Revised to 4000 / 25~~
  > **DECIDED (Hasan, 2026-08-16): `MAX_ACTIVE_RULES = 50`,
  > `MEMORY_PROMPT_BUDGET = 7000` chars.** §Rev 2.6 gives the derivation, and
  > the review trigger that changed with it.
- **Toggle off, not just delete** — preserves history and makes "did this
  rule cause that?" answerable by flipping it.
- **"Applied because"** — when the agent follows a memory it says so in its
  reply. ~~and that citation stamps `lastCitedAt`~~
  > **Rev 2 — keep the prose, cut the timestamp.** The agent cites reliably
  > (9/9 runs) and the citations read well, so this ships as the trust feature
  > it was meant to be. But it is **prose, not a signal**: the reply says
  > "applied because of your rule that you decide what's off-topic yourself" or
  > "your standing rule says never propose fluff" — mapping that back to a
  > memory `id` is fuzzy matching. In the spike my own scoring regex, written
  > knowing the exact fixture, **missed a plainly-worded citation**. A stamp
  > derived from that would be wrong often enough that "never cited in months"
  > would prune rules the agent had been following all along. `lastCitedAt` is
  > cut, and with it the pruning-UI story; §Rev 2.3 says what replaces it.

## M6. Surfaces — two views, one store

**In Studio (the assistant panel)** — proposal cards appear where the
correction happened. A user who just told the agent something wants "I'll
remember that" *right there*, not on another screen.

~~**In Assets (beside Brands)**~~ — the browse, edit, toggle and prune surface,
grouped by tier, with provenance and last-cited shown. Brands already lives
here (L3 Rev 3) and is the same shape of thing: durable, cross-project
preference data that is not a file.

Feature isolation holds: `asset-library` and `studio` never import each
other. Both talk to `src/shared/` types and the memory IPC surface.

> **Rev 2 — one surface, in Studio. Memory does not go on the Assets screen.**
> Three reasons, in order of weight:
> 1. **M7 already argues against it.** Memory is stored in
>    `userData/studio/memory.json` and explicitly *not* in the assets root,
>    because "that root holds content; memory is behaviour". The same sentence
>    that keeps memory out of the assets *folder* keeps it off the assets
>    *screen*. Brands are asset-adjacent — logos and palettes are real files in
>    that root. Memory is not.
> 2. **The Assets screen is filling up.** L2/L7 added Describe with AI,
>    Organize, a dismissible no-provider note and a progress strip; the toolbar
>    is already Brands · Describe · Organize · Refresh. A fifth entry point to
>    an unrelated feature is how a screen becomes a junk drawer.
> 3. **Two surfaces was never load-bearing.** M6's own argument is that the
>    proposal card belongs where the correction happened. The management view
>    can live one click away from it.
>
> **Revised**: one `MemoryDialog`, opened from the assistant panel
> (`AgentPanel`), holding browse / edit / toggle / delete. Proposal cards stay
> inline in the panel. `asset-library` is untouched, so the feature-isolation
> question disappears rather than being managed.
>
> The cost, stated plainly: app-wide data is only reachable from inside an open
> project. That is acceptable while the Studio agent is memory's only consumer
> (M8) — there is nowhere else it could be read *from*. If memory ever reaches
> TSX generation or image prompts, it earns a home outside Studio, and adding
> an Assets toolbar button then is a one-line change.

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
src/features/studio/components/MemoryDialog.tsx      management UI (Rev 2)
src/features/studio/components/MemoryProposalCard.tsx  in the assistant panel
```

> **Rev 2:** the management UI moved out of `asset-library` (M6 Rev 2).

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
  list of entries? ~~Proposed: keep it a list~~ **ANSWERED Rev 2: one free-text
  box.** The block renders profile as a single paragraph either way, so a list
  buys a uniform record shape and costs a second editing affordance for a
  field that changes once a year. Store it as one `profile`-kind entry;
  editing replaces its `text`.
- **QM2** — Should `lastCitedAt` drive an automatic "stale rule" prompt after
  N months, or stay a column the user reads? **MOOT Rev 2** — `lastCitedAt` is
  cut (§Rev 2.3). Neither.

---

# Rev 2 (2026-08-16) — the grill, with evidence

Rev 1 was designed but unproven. This section is what four hours of
verification and one spike changed. **Nothing was implemented**; the spike is
a throwaway harness under `.vidtsx-temp/` (gitignored), not app code.

## Rev 2.0 — The spike, and why it is trustworthy

`memory-spike.mjs` drives `query()` from `@anthropic-ai/claude-agent-sdk` with
**the same options object `claude-provider.ts:151-174` builds** — string
`systemPrompt`, `settingSources: []`, an in-process `createSdkMcpServer` — on
`claude-opus-5`, the model the Studio agent actually logs (10/11 auto-cut runs
in the ai-usage DB). The system prompt is the real `buildAgentSystemPrompt`
text plus the two real skill files read off disk. Tools are real MCP tools
(`get_transcript`, `propose_cuts`, `propose_memory`) that record their args.
The fixture is a 62 s takes-view transcript with a retake behind a spoken
"Other take." slate, two standalone fillers, two fluff spans, and the channel
name mis-transcribed as "learn with Hassan".

Four arms × 3 runs, all 12 succeeded:

| Arm | Memory block | `propose_memory` | User turn |
|---|---|---|---|
| A | — | — | "Do an editorial pass" |
| B | yes | — | "Do an editorial pass" |
| C | yes | yes | pass + **general** preference ("I always want…on every project") |
| D | yes | yes | pass + **one-off** ("make this one tight, under 45 s for this upload") |

The memory block held two rules ("never propose fluff cuts — I decide what is
off-topic myself"; "every cut note must name its segment number, like #4"),
one vocabulary entry (LearnWithHasan) and one profile line — 573 chars total.

## Rev 2.1 — Is memory worth building? **Yes. This is the finding that carries the phase.**

| Probe | A (no memory) | B/C/D (memory) |
|---|---|---|
| `fluff` cuts proposed | **2, 2, 2** | **0** in all 9 runs |
| Cut notes naming their segment (`#4`) | **0 / 13** | **36 / 36** |
| Correct "LearnWithHasan" spelling used | 0 / 3 | 8 / 9 |

Perfect separation on both rules, 12/12, with no prompt tuning. A one-line
user-authored rule reliably overrides a shipped skill's explicit instruction —
`studio-clean-cut` tells the agent to propose fluff as suggest-only, and the
memory rule suppressed it every time without the agent going silent about it
(it listed the fluff spots in prose instead, unprompted: *"Two spots you may
want to look at on your own…"*). That is the behaviour you would want and it
was not asked for.

Secondary finding, unlooked-for: **memory reduced output variance.** Arm A
produced three different cut-category sequences across three runs; arm B
produced the identical sequence `filler|retake|retake|filler` all three times.

Vocabulary is real but weaker than rules: the correct spelling appeared in 8/9
memory runs and 0/3 baseline runs, but the *mangled* form also appears in every
arm — the agent quotes the transcript verbatim when explaining a cut, which is
correct behaviour. Vocabulary steers what the agent *writes*, not what it
*quotes*. Do not oversell that tier in UI copy.

**Verdict: build it.** The doubt in "no evidence that user-authored rules
measurably change agent output" is resolved as strongly as a spike can resolve
it.

## Rev 2.2 — Does `propose_memory` trigger sanely? **Yes, untuned.**

Arm C proposed exactly **one** memory in **3/3** runs — never two, never zero.
Arm D proposed **0** in **3/3**. The three C proposals were near-identical in
wording, all correctly typed `rule`, and none duplicated an entry already in
the block:

> *"Always cut every 'um' and 'uh' in every project — no exceptions, including
> ones inside otherwise-kept sentences."*

Arm D is the more interesting result. "Make this one especially tight, I need
it under 45 seconds for this upload" is exactly the sentence a
reflex-proposing agent would mis-file as a pacing preference, and it proposed
nothing in every run — while still *saying* in prose that it could not reach
45 s without the fluff its standing rule forbids. It understood the
instruction, applied it, and correctly judged it non-durable.

The over-proposing risk that motivated the "one per turn" cap does not appear
to need the cap. **Keep the cap anyway** — it costs one sentence of prose and
the failure it prevents (trained reflex-rejection) is unrecoverable.

## Rev 2.3 — Will the agent cite? **Yes as prose. No as a signal. `lastCitedAt` is cut.**

Citation rate across memory arms: **9/9**. The citations are good — specific,
naturally worded, and they name *which* rule:

> "No fluff proposed — applied because of your rule that you decide what's
> off-topic yourself."
> "The only remaining fat is fluff, and your standing rule says never propose
> fluff — you decide off-topic yourself."

So M5's user-facing promise is delivered. What is **not** delivered is the
machine signal M5 built on top of it. Stamping `lastCitedAt` means mapping
that free prose back to a memory `id`, and the spike produced the cleanest
possible demonstration that this is unreliable: my first scoring regex —
written by me, with the fixture in front of me, matching seven different
citation phrasings — scored the second quote above as **no citation**, because
it says "your standing rule" and I had only written "your rule". A 1-in-9
miss rate in a hand-tuned detector against a known fixture is a floor, not a
ceiling, on what a shipped parser would do.

The consequence is not "the stamp is a bit noisy". It is that the pruning
story inverts: `lastCitedAt` would read `null` on rules the agent has been
obeying, and "never cited in months — cut it?" would recommend deleting
working rules.

**Cut:** the `lastCitedAt` field, the last-cited column in the management UI,
the "which rules actually matter" pruning affordance, and — as a bonus — M4's
most dangerous correctness rule, the one forbidding `lastCitedAt` from
reaching the prompt block. A field that does not exist cannot silently
invalidate the cache. (The deterministic-ordering rule itself **stays**: order
by tier then `createdAt` then `id`, never iterate a `Set`, never render a
timestamp. It is still the rule that a `Map` iteration or a `.sort()` on
`updatedAt` would violate.)

**What replaces it:** nothing, deliberately. The whole memory set is a bounded,
grouped, human-readable list with provenance and creation date on every row.
At `MAX_ACTIVE_RULES = 50` that is a short scroll rather than a single screen
(it was 25 when this was first written), so grouping by tier and showing
provenance do more work than they would have — but the conclusion holds: a
person reading their own 50 rules does not need staleness analytics, and a
staleness number derived from unparseable prose would actively mislead them. Structured citation (a
`cite_memory(ids)` tool, or `[mem:id]` markers in the reply) is the honest way
to get the signal back — it is agent-sdk-only, costs a turn, and pollutes the
chat, so it is not v1.

## Rev 2.4 — Is brand scope premature? **The UI is. The field is not.**

The assets root contains exactly one brand, `acme-test` — a fixture. There is
no second channel for a brand-scoped memory to distinguish.

But M3's own argument makes the split cheap: scope resolves at prompt-build
time, so keeping `brandId` on the record and in the pure filter means the
dimension can be surfaced later with **no migration and no re-write of the
composition function** — the filter is already written and already tested.
What costs real work is the UI: a scope picker on every memory card, a
"which brand does this project use" affordance next to it, and the explaining
that both require.

**Ship:** the field, the filter, and unit tests for both (no-brand applies
everywhere; branded applies only on match). **Defer:** every pixel of it.
Every memory created in v1 is app-wide.

## Rev 2.5 — Does `systemPrompt` land where M4 claims? **Yes — but the block is in the wrong position.**

Verified against `claude-provider.ts` and the SDK's own type declarations:

- `options.systemPrompt` takes the string **verbatim as the entire system
  prompt**. The SDK's `excludeDynamicSections` option documents that it "has
  no effect when `systemPrompt` is a string" — i.e. on our path the SDK
  injects no cwd / git-status / memory-path preamble of its own. The prompt we
  compose is the whole system block, ahead of `messages`. **M4's caching
  premise is correct.**
- The render order `tools → system → messages` holds, so a memory edit never
  re-bills the MCP tool schemas. **M4 rule 3 confirmed.**

Two corrections, one of them actionable:

1. **Position (actionable).** `composeSystemPrompt` appends skills *after* the
   base prompt. Memory folded into the base prompt would sit ahead of 10,508
   chars of skills and re-write them on every memory edit. Memory must be
   appended **last**; see the M4 callout for the signature change.
2. **The system prompt is not as static as M4 implies (accepted, not fixed).**
   `buildAgentSystemPrompt` embeds the live project asset inventory — asset
   ids, names, durations, transcript state — near the *top*, before the tool
   contract and before the skills. Importing or transcribing an asset
   therefore already invalidates the whole system prefix mid-session, and has
   since the agent shipped. The measured ~95% cache-read rate is achieved
   *despite* this, because inventory changes are rare within a conversation.
   Memory sitting last is unaffected by it either way.

   The SDK does expose the fix — `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` as a
   standalone element of a `string[]` systemPrompt splits the prompt into a
   globally-cacheable static prefix and a session-dynamic suffix, so
   role + skills + memory could be cached across sessions with the inventory
   after the boundary. **Not in G**: it means re-ordering the shipped agent
   prompt (inventory to the bottom), it changes cache behaviour for a feature
   memory does not own, and the win is invisible next to the ~95% already
   being served. Recorded here so the next person does not have to re-find it.

## Rev 2.6 — Are the numbers guesses? **They were, and they contradicted each other.**

40 rules × ~80 chars ≈ 3,200 chars cannot fit a 2,000-char budget, so a user
at the cap would permanently trip the "rules alone exceed the budget → emit
whole and log the overflow" branch. The two constants were never checked
against each other.

Measured anchors, from the ai-usage DB and the spike:

| Quantity | Value |
|---|---|
| Average Studio agent turn, input | **10,713 tokens** (487 uncached + 10,226 cache-read) |
| Base prompt + both skills | 16,190 chars ≈ **4,050 tokens** |
| Spike memory block that produced 12/12 rule adherence | **573 chars ≈ 145 tokens** |
| Observed rule length | 60–110 chars |

**DECIDED (Hasan, 2026-08-16): `MAX_ACTIVE_RULES = 50`,
`MEMORY_PROMPT_BUDGET = 7000` chars.** 50 rules × ~80 chars ≈ 4,000 for rules,
leaving ~3,000 for vocabulary and profile.

The argument for 50 over my proposed 25 is the right one, and it is an
argument from what already ships: **the two skills inject 10,508 chars into
every single turn** and no one has ever worried about it. A 7,000-char memory
budget is ~1,750 tokens — **two-thirds the size of the skill payload already
riding along**, and after the first turn nearly all of it is served from cache.
Being stingy here would be optimizing the smaller half of the prompt while the
larger half goes unexamined.

**The review trigger changes with the number, and this is the part to carry
into the code comment.** At 25 the risk was cost; at 50 the risk is
**instruction dilution** — 50 imperatives competing with each other and with
two skills. Cost is measurable and fine. Adherence at scale is *unmeasured*:
the spike proved 2 rules hold perfectly, and says nothing about 40. So the
trigger is no longer "memory exceeds N% of input" but:

> Revisit when a user with many active rules reports the agent ignoring one.
> That is the failure mode this number risks, and it is invisible in the
> telemetry — no token count will show it.

Two mitigations that cost nothing and should ship with the cap:
- Truncation order matters far more at 50 than at 25. The rules → vocabulary →
  profile ordering is already specified; test it at a full rule set, not a
  toy one.
- **A dilution spike is cheap and should run before G ships**: reuse the
  harness, pad the block to 40 filler rules plus the two measurable ones, and
  check whether fluff suppression and the note format still hold 12/12. If
  adherence degrades, the fix is not a smaller cap — it is ordering the most
  recently edited rules last, where models weight hardest.

## Rev 2.7 — Revised slice, and what got cut

**Cut from v1** (each with its reason above):

1. `lastCitedAt`, the last-cited column, and the staleness-pruning story — Rev 2.3.
2. Brand-scope UI (field and filter stay) — Rev 2.4.
3. The Assets-screen memory section; one Studio dialog instead — M6 Rev 2.
4. The **"replaces →" picker** on the proposal card. Showing the same-kind
   active memories inline is free and does the real work (the user sees the
   conflict); a supersede-rewiring control is real UI for a case that needs
   two near-duplicate rules to exist first. Show the list, let the user reject
   or edit.
5. Profile as a list of entries — one free-text box (QM1).

**Kept, and now evidence-backed**: injection (Rev 2.1), the propose policy
(Rev 2.2), citation as prose (Rev 2.3), the cap and the review gate.

**Order to build**, unchanged in shape but re-weighted: G1 (store) → G2 (pure
composition, memory appended last) → G5 (manual entry + the Studio dialog) is
where **all** the measured value sits — arm B used a hand-written block and
got the full effect with no tool involved. G3 (`propose_memory`) + G4
(proposal card) are the *convenience* half, not the *value* half. They also
now carry the least risk of any part of the phase, because the policy that
worried us most tested clean on the first try.

## Rev 2.8 — Revised test plan deltas

Everything in the Rev 1 sketch stands, minus the `lastCitedAt` stamping test,
plus:

- **Ordering (pure)**: the composed prompt places the memory block **after**
  the skill sections. This is a cache-cost invariant, so assert it.
- **Budget coherence (pure)**: `MAX_ACTIVE_RULES` rules of the observed
  maximum length still leave room for at least one vocabulary entry under
  `MEMORY_PROMPT_BUDGET`. This is the test that would have caught 40-vs-2000.
- **Live CDP**, revised: the acceptance script drops "toggle it off → the next
  turn stops citing it" as a *citation* assertion and asserts the *behaviour*
  instead — with the fluff rule active the agent proposes no fluff cuts; with
  it toggled off, it does. Behaviour is what the spike showed is reliable.

## Rev 2.9 — Memory and skills are the same mechanism (asked 2026-08-16)

*"Is the clean-cut flow we migrated from the original editor a skill, or is it
hardcoded — and can I improve the agent's flow later by improving the skills?"*

**It is a real skill**, `resources/skills/studio-clean-cut/SKILL.md`, plain
markdown with frontmatter, loaded by `skills-registry.ts` and composed into the
system prompt. Same for `studio-make-tsx`. But the agent's behaviour is spread
across three layers with very different edit costs, and only the first is the
skill:

| Layer | Lives in | Cost to change |
|---|---|---|
| **Judgment** — what counts as a retake, cut the FIRST doubled phrase, fluff is suggest-only, distrust the timestamps | `SKILL.md` | edit a text file |
| **Workflow** — the role, the numbered steps, "plan cheap / generate expensive", the 10-shots-per-pass cap, the tool list | `studio-agent-prompt.ts` (hardcoded TS) | rebuild |
| **Mechanics** — RMS snapping, span validation, the category enum | `editorial-cuts.ts`, `snapEditorialCuts` | real code |

**Skills are editable in a shipped build today.** `getSkillsDir()`
(`paths.ts:51-56`) resolves to `process.resourcesPath/skills` when packaged, and
`electron-builder.yml:32-33` copies `resources/skills` there as `extraResources`
— a plain folder next to the .exe, deliberately **not** inside `app.asar`. The
editorial policy can be edited on an installed machine with a text editor.

**Two gaps, both small, both already half-built:**
- `loadAll()` memoizes into a module cache (`skills-registry.ts:116`), so an
  edit needs an app restart. `clearSkillCache()` exists at `:206` and is
  **called by nothing** — the reload hook was written and never wired.
- `SKILLS_LIST` IPC exists (`channels.ts:143`) but is consumed only by the
  Tools AI chat, which is feature-flagged off in V1. There is no skills UI.

**The V1.1+ shape**, if flow-tuning between releases becomes a goal: a small
skills screen (list → edit body → save → `clearSkillCache()`), plus
progressively moving workflow prose out of `studio-agent-prompt.ts` into the
skill, so more of the flow is tunable without shipping a build. The loader, the
IPC and the cache reset already exist; this is wiring, not architecture.

**Why this belongs in the memory doc.** Memory and skills are *the same
mechanism* — markdown blocks composed into one system prompt by
`composeSystemPrompt`. The spike showed a **573-char memory block override an
explicit instruction inside a 4,826-char shipped skill** (§Rev 2.1: the skill
says propose fluff as suggest-only; the memory rule suppressed it 9/9). So
memory is already user-editable skill patching, scoped and gated.

That has a design consequence worth stating: **skill editing is a developer
affordance, not a user feature.** Users get memory — gated, inspectable,
per-user, capped. Skills stay the shipped baseline that memory patches. Do not
build a user-facing skill editor on the argument that "users want to tune the
agent"; they want memory, and it is safer.
