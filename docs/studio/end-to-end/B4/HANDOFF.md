# B4 — The learning signal: snapped span beside the final span; user trims and text deletes tagged; learn-from-video measures the joins and proposes the cut knobs
status: IN PROGRESS — step 1 (schema + pure measurement/fit) DONE; step 2 (tags + `snapped` wiring) DONE; step 3 (the learn path: propose_preset_update → report → card → applyPresetLearning) next

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety; ALL the disk rules — stop lines
1.0 GB on C: and D:, artefacts > 1 MB to `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\`, "Reuse,
don't copy, while disk is low", "Vitest gate while C: is low", "Vitest gate under load"; the
process-kill lesson; every "Learned" line) and the **"Track B decisions"** section of
`docs/studio/end-to-end/ORCHESTRATOR.md`. B1 (snapper DSP), B2 (cut-style.json, `resolveCutStyle`,
the four consumers, preset `style.cut`, project `settings.cutStyle`) and B3 (cut QA on the cards)
are DONE — read their STATUS rows (top of `Status.md`) first.

**Never hand back while a job you started (the app, proxies, waveforms, a check) is still
running — wait for it inside your own session.**

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **B4** | The learning signal: snapped span kept beside the final span on proposal items; user trims and text deletes tagged; learn-from-video measures lead-in / tail / level at user-touched joins and proposes the cut knobs with numbers | after Hasan re-does his 21 Act-1 joins on M2, the card proposes `head`, `minTail`, `margin` within ±30 ms / ±1 dB of the fitted tight |

**This part depends on Hasan** (ORCHESTRATOR "Track B decisions", Session 2 overrides): build and
verify everything up to his step, prove it with an automated stand-in (below), prepare his step
exactly, then the orchestrator marks B4 `WAITING-HASAN` and moves on.

Session gates (plan §3 head): `npx vitest run` green (DRIVING.md rules), `npm run check:types` at or
below baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the STATUS.md
row, the TESTING.md §18 block (`### 18.10 B4`, after `### 18.9 B3`). Schema additions optional
only; old projects / proposals / presets must open untouched.

## Plan context (§1.x facts, §2 decision, §5 items to read)

**Read plan §1.1 (:94-101, the review signals), §1.2 (:106-121, presets + learning) and §2 T1
(:394-426, especially "The learning signal") in full.** Essentials:

- **Today (§1.1):** dragging a cut region's edges (`CutRegionLayer.tsx:123-161`) OVERWRITES
  `sourceStart/End` and sets `adjusted: true` (`proposal-ops.ts:54-68`); `StudioProposalItem` keeps
  no original span (`src/shared/types/studio.ts` ~:302-326); learn-from-video counts
  `cutItemsAdjusted` as a boolean tally (`preset-learn-stats.ts:124`); **no stat captures where the
  user put the edge.** Transcript deletions are derived state ("Deletions are never state",
  `transcript-doc.ts:5-7`) and apply directly with one undo, no proposal (`text-delete.ts:10-11`);
  a later trim is indistinguishable from the delete.
- **Learning today (§1.2):** `StudioPresetKnobKey = keyof StudioPresetStyle` — only those can be
  learned (B2 deliberately left `cut` OUT of it: "learning the cut knobs is B4");
  `applyPresetLearning` (`preset-store.ts` ~:153-176) patches `style`, appends to PRESET.md, pushes
  a `learned[]` entry (cap 20); the learn card is one pending proposal per project
  (`agent-preset-proposals.ts:24-26`); accept re-applies the knob changes over the preset as it is
  now (`preset-learn-handlers.ts:61-97`). Entry point: the agent tool `propose_preset_update`
  (`agent-tools/preset-tools.ts:44-68`) → `learn-from-project.ts` (139 lines) + `preset-learn-stats.ts`
  (274 lines) + `preset-learn-format.ts` — the numbers are computed by CODE; the agent only
  triggers it.
- **T1 "The learning signal" (Hasan: "ok"):** "every proposal item keeps its snapped span beside
  the user's final span; every user trim and Transcript delete tags the clip `origin {by:'user',
  op}`. Learn-from-video measures, at every join the user touched, the lead-in actually kept
  before the first word and the tail kept after the last word, and the level at the user's tail
  edges relative to the floor; it proposes `head`, `minTail`, `maxTail` and `margin` when the
  user's medians differ from the style by more than 30 ms (or 1 dB) over at least 10 joins. The
  card shows the numbers." **Q4 (answered yes):** ≥ 10 touched joins, > 30 ms or > 1 dB.
  "Learning writes into the user's preset through the existing learn card and
  `applyPresetLearning`; `StudioPresetKnobKey` widens to the nested cut knobs. Nothing is
  inferred silently." §5: "Joins the user never touches teach nothing; the card says how many
  joins it learned from."
- **The reference (what the exit compares against):** Hasan's fitted tight (`cut-style.json`
  `tight` = `cuts.json` `styles.tight`): `head 0.15, minTail 0.08, maxTail 0.7, margin 12`.
  His 2026-10-15 audit (memory `cut-pacing-continuous`, editor project): he trimmed **21 sentence
  joins in the first 1:55 of preview-tight**, all pauses; mapped to raw he keeps **~0.14 s after a
  word's ASR end (cuts land at about floor + 12..15 dB, right after the main release) and ~0.12 s
  before the next word**; the plan had given those joins a 0.62 s median soft landing (cap 0.70)
  + 0.21 head. **The 21 individual edits are NOT recorded** anywhere in the editor repo (only the
  fitted result, and three later "audit round 2" manual cuts in `cuts.json`) — so the automated
  stand-in below re-creates the geometry, and Hasan's own redo is the real exit.

## Orchestrator decisions (DECIDED — follow them; raise objections under Open problems)

1. **Schema (optional fields only):** `StudioProposalItem.snapped?: { sourceStart, sourceEnd }`
   written when the item is created (Auto Cut, editorial, any cut-plan proposal) and never changed
   by an edge drag; the drag keeps writing the final span as today. Clips get
   `origin?: { by: 'user'; op: 'trim' | 'text-delete' | … ; at?: number }` on user trims and
   Transcript deletes (one tag per op; the existing undo restores the untagged clip). Old data =
   no learning signal, never an error.
2. **The measurement** is a pure module in `src/shared/` (unit-tested on hand-made envelopes +
   words): for each join the user touched (a dragged proposal edge whose final ≠ snapped, a
   user-trimmed clip edge, a text-delete edge), lead-in = first kept word start − segment start;
   tail = segment end − last kept word end; tail level = `RmsEnvelope.rmsDb(end)` − floor (same
   windows as the snapper). Medians over joins vs the RESOLVED style of the project (B2's
   resolver) → proposals for `head`, `minTail`, `maxTail`, `margin` only when |Δ| > 30 ms (dB:
   > 1 dB) and ≥ 10 joins (Q4). Report n, the medians, and the per-join list on the card.
3. **Where it lands:** `StudioPresetKnobKey` widens to the cut knobs as nested keys (e.g.
   `cut.head`) — the learn card's knob changes write `style.cut` through `applyPresetLearning`
   (base kept; only changed knobs written; B2's `cutSpecProblems` validation applies). A project
   with no preset: the card says so and offers nothing to save (or saves to the project override —
   pick the existing pattern and say which).
4. **No model call to prove it:** drive `propose_preset_update` through its real tool handler
   (fixture project, no LLM) in tests and in the live stand-in; Hasan triggers it from the
   assistant in his step.
5. **The automated stand-in (proves the pipeline before Hasan):** on a scratch M2 copy, Act 1 =
   the raw span behind preview-tight 0:00–1:55 (map it through `cuts.json`'s keeps / the clips
   0369…0371 — say which joins you used); make the starting proposal with a DIFFERENT style
   (e.g. natural, or the old pre-October tight `head 0.11 / minTail 0.14 / maxTail 0.4 / margin 5`
   as a project override) so the joins start wrong; apply it; then trim ≥ 10 (ideally 21) of those
   joins THROUGH THE APP'S OWN TRIM PATH (the timeline edge drag or the reducer action the drag
   dispatches) to the fitted-tight geometry (the edges cutlib/Studio's planner gives with the
   fitted tight at those joins); then run learn-from-video → the card must propose `head`,
   `minTail`, `margin` within ±30 ms / ±1 dB of 0.15 / 0.08 / 12. Also a negative: trim joins to
   the CURRENT style's own edges → no change proposed; and < 10 touched joins → no proposal, the
   card says how many it saw.
6. **Hasan's step (prepare it, do not do it):** a ready station for him on C: — Studio root =
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\B1-verify-root` (a scratch full M2 copy; reset its
   timeline and set the starting style as in 5), profile
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\B1-verify\profile`, and a one-click launcher
   script (`docs/studio/end-to-end/B4/HASAN-STEP.md` + a `.ps1`/`.sh` it names) that starts THIS
   branch's dev build on that profile (his installed 1.1.0 lacks B1–B4; never his own profile or
   projects). HASAN-STEP.md says exactly: what to open, the Act-1 span, "trim each sentence join
   the way you want it (about 21)", then "ask the assistant: learn from this video" (or the
   deterministic path if one exists), and what numbers on the card mean pass (head 0.15 ± 0.03,
   minTail 0.08 ± 0.03, margin 12 ± 1). Time it: how long should his pass take.
7. **Also (B3 doc debt, small):** in Status.md's B3 row and TESTING §18.9, the follow-up "audition
   starts ~0.2 s early (1.21 s before / 0.78 s after)" is a MISREAD of the toolbar clock
   (`formatClock`, `src/features/studio/services/timeline-view.ts:43-52`, MM:SS.FF in 60 fps
   frames) — the B3 verifier measured ±0.99 s: replace it with that; "on all nine clips" for the
   hand plan → eight (0366 has no keeps); add the 133 vs 134 joins flip (0373 seg 17).

**Material:** builders reuse `C:\Users\hasan\AppData\Local\vidtsx-e2e\B2-root` + `profiles\B2\profile`
(scratch, reset as needed; CDP 9301); the B4 verifier gets `B2-verify-root` +
`profiles\B2-verify\profile`; Hasan's station = `B1-verify-root` + `profiles\B1-verify\profile`
(decision 6). Never modify `…\vidtsx-e2e\b-root` (the shared M2) or `profiles\source`. No new copies.
Disk at hand-off: C: ~2.4 GB, D: ~1.4 GB.

## Done (file:line, commit hashes)

**Step 1 — schema + the pure learning modules (builder #1, 2026-10-22; code `92d846f`).**
Nothing is wired yet: no reducer, IPC, learn path or UI change.

- Schema, optional only (`src/shared/types/studio.ts`): `StudioClipEditOp = 'trim' | 'text-delete'`
  (:115); `StudioClipOrigin` gains `op?` (:122) and per-edge `edges?: { start?, end? }` (:130) —
  `by`/`proposalId` keep meaning "who PLACED the clip" (applied cut pieces are `by:'agent'`,
  `apply-cut-proposal.ts:174`; learn stats count clips by it). `StudioProposalItem.snapped?:
  { sourceStart, sourceEnd }` (:336).
- Types `src/shared/types/studio-cut-learn.ts` (94 lines): `CutLearnKnob`, Q4 constants
  `CUT_LEARN_MIN_JOINS = 10`, `CUT_LEARN_MIN_SECONDS = 0.03`, `CUT_LEARN_MIN_DB = 1`,
  `CutLearnJoinInput`, `CutLearnJoin` (the card row), `CutLearnMedians`, `CutLearnChange`,
  `CutLearnReport` (`joins`, `headEdges`, `tailEdges`, `medians`, `fitted`, `changes`, `notes`,
  `joinsList`).
- `src/shared/studio/cut-learn-joins.ts` (136): `collectCutLearnJoins(timeline, proposals)` (:34)
  on `masterLane`; `clipLearnJoins` (:43) — edges tagged `'trim'`; two neighbouring same-source
  clips = ONE join (left end = tail edge, right start = head edge); `'text-delete'` edges are not
  samples; `proposalLearnJoins` (:91) — accepted items of applied/partial cut plans whose final ≠
  `snapped` (> 1 ms), counted only while the master lane still has that edge untrimmed (a trim
  supersedes; a lost edge is stale; no `snapped` = old data = nothing).
- `src/shared/studio/cut-learn-measure.ts` (168): `measureCutJoins` (:68) — per TOUCHED edge:
  tail = edge − last word (start < edge) end, `tailDb` = `rmsDb(edge)` − floor (50 ms, the
  snapper's), lead-in = first word (end > edge) start − edge; beside each the resolved style's own
  edge at that join (`tailFor` with the planner's gap, `styleLeadIn` (:53) = planner rule) and
  `styleSoft`; edges > 1.5 s after / > 1.0 s before their word are skipped ("not a landing").
- `src/shared/studio/cut-learn-fit.ts` (134): `fitHead` (:34), `fitTails` (:58) — L1 fit in whole
  ms over grids (head/minTail 0–0.40 step 0.01, maxTail 0.10–1.50 step 0.05, margin 0–30 step
  0.5, each plus the current value) through the snapper's own rules (snapTail's 20 ms walk from
  minTail, the cap, the gap clamp; lead-in = max(head, snapHead reach)). Ties: current wins if
  among the best; else the largest minTail, the middle of the margin/head plateau, the maxTail
  nearest the current.
- `src/shared/studio/cut-learn.ts` (161): `learnCutKnobs(inputs, assets, style)` (:25) — measure →
  medians → Q4 gate PER SIDE (≥ 10 edges AND the user's median offset from the style's own edges
  > 30 ms, or > 1 dB at the tail) → fit (head with the current margin, tails with that head, head
  again with the fitted margin) → `changes` only for knobs moving > 30 ms / > 1 dB; notes for
  "Learned from N joins — at least 10 …", within-threshold, soft landings, skipped edges.
- Tests: `cut-learn.test.ts` (8), `cut-learn-joins.test.ts` (9).

**Step 2 — the learning SIGNAL wired (builder #2, 2026-10-22; code `c5a6f4c`).** The learn path
(stats → card → preset) is still untouched.

- `src/shared/studio/clip-edge-tags.ts` (31): `withEdgeTag(clip, edge, op)` (:15) — sets
  `origin.edges[edge]` + `origin.op`, keeps `by`/`proposalId`, absent origin → `{ by: 'user' }`;
  `withoutEdgeTag(clip, edge)` (:22) — identity when that edge has no tag, drops `edges` when empty
  (keeps `op`). Re-exported from `@shared/studio` (`index.ts`, beside `snapCutSpans`).
- `src/features/studio/services/clip-edit-tags.ts` (70): `tagTrimmedEdge(before, after, clipId,
  edge)` (:22) tags `'trim'` only when that edge's SOURCE second moved (a trim the neighbour/source
  blocks tags nothing); `tagTextDeleteEdges(before, after)` (:41) tags every master-lane edge whose
  source second moved, and the start of a new-id piece (the right half of a clip the delete went
  through), `'text-delete'`. Identity when nothing to tag.
- Reducer (`src/features/studio/hooks/useTimeline.ts`): `'trim'` (:323) runs `trimClip` /
  `trimClipRippleAll` then `tagTrimmedEdge`; `'text-delete'` (:370) wraps `applyTextDelete` in
  `tagTextDeleteEdges`. Undo = the history's untagged document (nothing extra). The only `'trim'`
  dispatchers are user UI (`useClipDrag.ts:274`, `ShotClipSection.tsx:267`); the only
  `'text-delete'` dispatcher is `useTextEdit.ts:113`.
- Ops that REWRITE an edge drop its tag (each piece keeps only the edge it keeps):
  `splitClip` (`timeline-ops.ts:185,190`), `cutSpanFromClips` (`ripple-ops.ts:59,71` — range
  delete, ripple, text delete), `restoreDeletion` (`text-restore.ts:73` — the two rejoined edges).
- `setProposalItemSpan` (`proposal-ops.ts:59`, :72): the first drag of an item with no `snapped`
  and not yet `adjusted` keeps the pre-drag span as `snapped`; later drags never change it; an item
  adjusted before B4 gets none (old data = no signal). Creators write it at creation:
  `buildCutProposal` (`src/shared/studio/cut-proposal.ts:96` — Auto Cut button and `run_auto_cut`)
  and `buildEditorialProposal` (`src/main/services/studio/editorial-cuts.ts:70` — the editorial
  snap / `propose_cuts`). These are the only two `kind: 'cut-plan'` creators (grep).
- Tests: `src/features/studio/services/clip-edit-tags.test.ts` (12, through the real reducer:
  tag + keep `by`/`proposalId` + undo; no-origin start trim; blocked trim tags nothing; ripple-all
  trim; both sides of a join trimmed → `collectCutLearnJoins` = ONE join, both touched, tail 2.8 /
  head 4.2; split and range delete keep only the outer tags; Transcript delete of "um" tags
  `'text-delete'` (no learn join), a later trim turns it into a `'trim'` sample, undo walks back to
  `'text-delete'` then to no origin; restore drops both rejoined tags; `snapped` on first drag,
  kept on the second, creator's kept, pre-B4 adjusted item gets none, a no-op drag is identity);
  `snapped` assertions added to `cut-proposal.test.ts` and `editorial-cuts.test.ts`.

## Verified (exact commands + outputs)

Step 2:

- `npx vitest run src/features/studio/services/clip-edit-tags.test.ts …cut-proposal.test.ts
  src/main/services/studio/editorial-cuts.test.ts …text-restore.test.ts …text-delete.test.ts
  …ripple-ops.test.ts …timeline-ops.test.ts src/shared/studio/cut-learn.test.ts
  src/shared/studio/cut-learn-joins.test.ts` → `Test Files 9 passed (9) · Tests 118 passed (118)`.
- Subset run `npx vitest run src/features/studio src/main/services/studio src/shared/studio
  src/main/services/agents src/main/ipc` (log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\vitest-step2-subset.log`)
  → `Test Files 238 passed | 2 skipped (240) · Tests 2040 passed | 23 skipped (2063)` (22.45 s).
  No full run yet (the session gate is at the end, DRIVING.md rules).
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Disk at step 2: C: 2.32 GB, D: 6.44 GB free. No app launched.

Step 1:


- `npx vitest run src/shared/studio/cut-learn.test.ts src/shared/studio/cut-learn-joins.test.ts`
  → `Test Files 2 passed (2) · Tests 17 passed (17)` (1.34 s). Covered: one join's lead-in 0.1 /
  tail 0.3 / `tailDb` 7.6 / the style's own edges; untouched joins and unknown clips teach
  nothing; a far edge is skipped; **13 joins trimmed to the fitted-tight geometry with the OLD
  tight as the style (head 0.11 / minTail 0.14 / maxTail 0.4 / margin 5 over base tight) → fitted
  head 0.15, minTail 0.08, margin within ±1 dB of 12, changes head/minTail/margin/maxTail (maxTail
  0.4 → 0.5: only known up to the longest tail kept)**; joins at the current style's own edges →
  `changes: []`, fitted = current; 9 joins → nothing, note "Learned from 9 joins — at least 10
  touched joins are needed before the cut knobs change."; lead-ins +30 ms → nothing, +40 ms →
  head +0.04; natural (softGap 1.2) → "13 of 13 tails land soft …"; trims pair into one join,
  one-sided joins, different sources, text-delete edges, speed; proposal drags on/off the
  timeline, superseded by a trim, old items without `snapped`, rejected items, unapplied plans;
  `collectCutLearnJoins` counts a join once.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Disk at step 1: C: 2.43 GB, D: 6.44 GB free. No app launched, no full vitest run (no
  reducer/IPC code touched yet).

## Next step (ONE concrete instruction)

Wire the LEARN PATH in main, with unit tests through the real `propose_preset_update` tool
handler on a fixture project (no LLM; decision 4), then hand off: read `preset-learn-stats.ts`,
`learn-from-project.ts`, `preset-learn-format.ts`, `preset-store.ts` `applyPresetLearning`
(~:153-176), `preset-learn-handlers.ts` (:61-97), `agent-tools/preset-tools.ts` (:44-68),
`studio-preset.ts` (`StudioPresetKnobKey` :146) (none read yet); then (a) widen
`StudioPresetKnobKey` to the nested cut knobs `cut.head` / `cut.minTail` / `cut.maxTail` /
`cut.margin` (optional, old `learned[]` entries still parse); (b) in `learn-from-project.ts` load
each master-lane asset's v3 waveform envelope + words (same loaders B2's `resolveCutStyle` callers
/ the editorial snap use in main), run `collectCutLearnJoins(project.timeline, project.proposals)`
→ `learnCutKnobs(inputs, assets, resolveCutStyle(project, preset))` and turn `report.changes` into
knob changes; (c) `preset-learn-format.ts` prints the card text per the RULED block (n joins, head
and tail edge counts separately, medians AND fitted values, "maxTail at least N s", "learned from
your trims; Transcript deletes count once you trim them", < 10 → "Learned from N joins — at least
10 …"); (d) accept writes `style.cut` through `applyPresetLearning` (base kept, only changed knobs,
B2's `cutSpecProblems` validation); no preset → say which existing pattern applies. UI (the card)
and the M2 stand-in are the steps after.

## Open problems

Objections to the orchestrator decisions — built this way, the orchestrator to rule (none needs
Hasan; none blocks):

1. **Decision 2 "medians vs the resolved style → proposals": the medians are the GATE, the
   numbers come from a fit.** The snapper's tail is not a knob value: with the fitted tight
   (minTail 0.08, margin 12) the tails it keeps run ~0.14 s (Hasan's audit) and land a few dB
   UNDER floor + 12 (the 20 ms walk stops at the first window at or below it) — the raw median
   tail / landing level would propose minTail ≈ 0.14 and margin ≈ 9–10, failing the exit. So:
   Q4 gate = the user's median offset from the style's own edges at the same joins (> 30 ms, or
   > 1 dB at the tail, ≥ 10 edges); values = the L1 fit through the snapper's own rules (it IS
   the median where the rule is a constant — a lead-in without `maxHead`). The card shows both
   the medians and the fitted values. To confirm on M2 in the stand-in.
2. **Text-delete edges are NOT samples** (decision 2 lists "a text-delete edge"). The resolved
   style placed them, so they carry no timing preference and would pull the fit toward the
   current style — and would bias Hasan's step if he also removes retakes in the Transcript.
   They are tagged `'text-delete'` so a later trim of one is distinguishable (the §1.1 point) and
   becomes a sample.
3. **Decision 1's `origin {by:'user', op, at?}` → `op` + per-edge `edges` on the existing
   `StudioClipOrigin`, `by` kept, no `at`.** A trim moves ONE edge; without the per-edge record
   the untouched edge of a trimmed clip would be measured. `by` already means who placed the clip
   (applied cut pieces are `by:'agent'`; learn stats count clips by it). `at` would make the
   reducers impure and nothing reads it.
4. **Per edge, not per join:** a join with only its tail trimmed gives a tail sample only; ≥ 10 is
   counted per side (head edges → `head`; tail edges → `minTail`/`maxTail`/`margin`); the card's
   "joins" = joins with ≥ 1 measured edge.
5. **`maxTail` is only identifiable up to the longest tail kept** (the fit returns the cap nearest
   the current one that reproduces every tail): the card should say "at least". Not in the exit.
6. **All tails are fitted as punchy landings.** Under a style with a small `softGap` (natural
   1.2) the joins land soft and a learned `margin`/`maxTail` does not reach them; the report says
   so. The stand-in should start from the old tight as a project override over base tight
   (softGap 99 → every join punchy), as decision 5 suggests.

Step 2 notes (no ruling needed): a TSX shot clip trimmed in the Inspector (`ShotClipSection`)
is tagged too — harmless, the collector reads media clips only; only MASTER-lane edges get
`'text-delete'` tags (the collector reads the master lane only; ripple-all pieces on other lanes
just lose stale tags).

**RULED (orchestrator, 2026-10-22 17:20) — all six accepted as built:**
1. Accepted: medians = the Q4 gate, values = the fit through the snapper's rules; the card shows
   BOTH ("you kept a median 0.12 s lead-in; head 0.15 reproduces your edges") so nothing is
   inferred silently. The STATUS row explains why a raw median would be wrong.
2. Accepted: text-delete edges are tagged, not samples; a later trim of one is a sample. Say it on
   the card ("learned from your trims; Transcript deletes count once you trim them").
3. Accepted: per-edge `edges` + `op` on `StudioClipOrigin`, `by` unchanged, no `at`.
4. Accepted: ≥ 10 per side; the card reports head-edge and tail-edge counts separately.
5. Accepted: `maxTail` shown as "at least N s" (not part of the exit).
6. Accepted, and it applies to **Hasan's station too**: start style = the old pre-October tight
   (`head 0.11, minTail 0.14, maxTail 0.4, margin 5`) as a project override over base tight
   (softGap 99, so every join is punchy). Note in STATUS + HASAN-STEP.md: the learn card cannot
   learn `softGap` (not one of T1's four), so Hasan's 10-15 move "soft landings off" stays a
   style choice, not a learned one — a follow-up if he wants it learned.

## Do-not-redo

- B1, B2, B3 are DONE — do not re-port the snapper, change the resolver/precedence, or the QA
  checks. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY.
- Step 1 is DONE: the schema fields and the four `src/shared/studio/cut-learn*.ts` modules + their
  17 tests — extend them, do not rewrite them (unless the stand-in on M2 disproves the fit; then
  record the numbers first).
- Step 2 is DONE (`c5a6f4c`): edge tags on trim / text-delete, tag drops in split / span cut /
  restore, `snapped` on first drag and at creation, 12 reducer-level tests. Do not re-wire them.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~37 calls · step 1: schema + pure join collector / measurement / fit /
  report with 17 unit tests; types 26/10; no app launch.
- 2026-10-22 · builder #2 · ~42 calls · step 2: the signal wired (reducer tags, tag drops,
  `snapped` on drag + creators), 12 tests; subset vitest green; types 26/10; no app launch.
