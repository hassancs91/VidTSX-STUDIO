# B4 — The learning signal: snapped span beside the final span; user trims and text deletes tagged; learn-from-video measures the joins and proposes the cut knobs
status: DONE up to Hasan's step (fix round 2) — builder #10, 2026-10-22: HASAN-STEP.md §2 = Snap off FIRST, then per join playhead → Zoom in 4× → read the total → drag from the clip's LOWER half (the "Add transition" square and the fade dots do not trim) → the toolbar total is the sign for both edges (a lead-in edge comes back to the join — normal); live with real mouse drags on B2-root (8 rows + the misses, see Verified); card shows the stats sentence once; Status.md / TESTING §18.10 carry pass rule (a) + the per-knob gate; gates green (full vitest 457 / 3866 first run, types 26/10). — was: FIX round 2 (verifier round 2 FAIL: HASAN-STEP.md trim check wrong for lead-ins) — was: DONE up to Hasan's step (fix round 1) — builder #9, 2026-10-22: HASAN-STEP.md Snap off + zoom; per-knob gate on |fitted − current|; card wording; one join counted once; gates green (full vitest 457 / 3866, types 26/10). One residual risk for the orchestrator under Open problems ("Fix round 1 — residual"). — was: FIX (verifier round 1 FAIL) — was: DONE up to Hasan's step (2026-10-22, builder #8) — steps 1–7 DONE: the signal, the learn path and the card built; the M2 stand-in live (21 joins → head 0.15 / minTail 0.08 / margin 12, Δ 0) + the two negatives; Hasan's station ready at its start state; gates green (full vitest run 2 counted, types 26/10); Status.md row, TESTING §18.10 and the B3 doc debt written. **The EXIT waits for Hasan's redo on the station — `docs/studio/end-to-end/B4/HASAN-STEP.md`; the orchestrator marks B4 `WAITING-HASAN`.**

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

**Step 3 — the LEARN PATH in main (builder #3, 2026-10-22; code `2865675`).** The card's UI
still shows only the knob table (the four new labels); `cutLines` / `cutLearn.joinsList` are not
rendered yet.

- Types (`src/shared/types/studio-preset.ts`): `StudioPresetCutKnobKey = \`cut.${CutLearnKnob}\``
  (:158); `StudioPresetKnobKey` = the flat knobs | the four cut keys (:162);
  `StudioPresetUpdateProposal.cutLearn?: CutLearnReport` (:196) and `cutLines?: string[]` (:199),
  both optional (pending cards are in memory; `learned[]` entries hold no keys — old presets parse).
- `src/main/services/studio/learn-cut-knobs.ts` (73): `learnProjectCutKnobs(project)` (:44) —
  `collectCutLearnJoins(timeline, proposals)`; none → `null` (no cut half on the card); per asset
  `readTranscriptFile` words + `loadRmsEnvelope` (the editorial snap's loaders; unreadable asset →
  a card line, its joins teach nothing); `resolveProjectCutStyle(project.id, { settings:
  project.settings })` (the LIVE document's settings — an unsaved override counts) →
  `learnCutKnobs` → `cut.<knob>` changes + lines; logs `Cut knobs measured`.
- `src/main/services/studio/cut-learn-format.ts` (79, pure): `formatCutLearnLines` (:30) — "Cut:
  learned from N joins you trimmed (H lead-ins, T tails) — learned from your trims; Transcript
  deletes count once you trim them." · "Lead-in: you kept a median X s before the first word (the
  style keeps Y s); head Z s reproduces your edges." · "Tail: you kept a median X s after the last
  word, cut D dB over the floor (the style: …); minTail … and margin … reproduce your edges;
  maxTail at least N s." · unreadable assets · the report's notes (the < 10 line) · with a project
  override and changes: "This project's own cut style (Project settings) overrides the preset:
  accepting teaches the preset; this project keeps its override until you clear it there.";
  `cutKnobChange` (:64) — the reason per knob (head: median lead-in vs the style's; minTail/margin:
  median tail + dB vs the style's; maxTail: "at least N s — only known up to the longest tail you
  kept").
- `learn-from-project.ts` (153): cut learning in a try/catch (a failure costs the cut half only,
  :109); changes = flat diff + cut changes; the summary prompt and `buildLearnedSection` (new
  `cutLines` input, `preset-learn-format.ts`) carry the cut lines; `proposedStyle` via
  `applyKnobChanges(…, cutFile)` (:117); card gets `cutLearn` + `cutLines` (:145).
- `src/main/services/studio/preset-knob-apply.ts` (59): `applyKnobChanges` MOVED here from
  `preset-learn-stats.ts` (now 269) — flat keys set; `cut.<knob>` written with `withPresetCutKnob`
  (the preset form's own rule: base kept, a value equal to the base's drops the override) when the
  cut-style file is at hand, else a plain override; `hasCutKnobChanges`, `presetCutProblems`
  (B2's `cutSpecProblems` with the base style).
- Accept (`src/main/ipc/preset-learn-handlers.ts:88-92`): re-applies the changes over the preset
  as it is now through `applyKnobChanges` (loads `cut-style.json` only when a cut key is present),
  refuses with "The learned cut style is not valid: …" when `presetCutProblems` flags it, then
  `applyPresetLearning` as before (the card stays pending on that error).
- Tool result (`agent-tools/preset-tools.ts:68`): "… Cut knobs: learned from N trimmed joins (H
  lead-ins, T tails), K cut knob changes."
- **No preset = the existing pattern**: `learnFromProject` returns "This project has no editing
  preset to learn into — pick one in the Inspector …" — no card, nothing saved; the project
  override is NOT used as a save target.
- `src/shared/studio/cut-learn-test-fixtures.ts` (104): step 1's recording builder / styles /
  `joinsAt` moved out of `cut-learn.test.ts` (which now imports them; its 8 tests unchanged) and
  `Recording` gains `levels`/`zcr` (what a v3 waveform file holds).
- Tests: `agent-tools/preset-tools.test.ts` (5) — the REAL `propose_preset_update` handler + the
  REAL accept handler, real `cut-style.json` (getSkillsDir → `resources/skills`), real preset store
  on a temp library, the waveform written as a v3 cache file, transcript mocked: 13 joins trimmed to
  the fitted-tight geometry from the old tight on the preset (`cut: { base:'tight', head 0.11,
  minTail 0.14, maxTail 0.4, margin 5 }`) → `cut.head 0.11→0.15`, `cut.minTail 0.14→0.08`,
  `cut.margin 5→12±1`, `cut.maxTail 0.4→0.5` ("at least 0.5 s"), the exact card lines, PRESET.md
  section; accept → `style.cut = { base:'tight', maxTail:0.5, … }` (head/minTail back to the base);
  joins at the current style's edges → no cut change (13 joins reported); 9 joins → none + the
  "Learned from 9 joins — at least 10 …" line; project override → measured against it + the
  override line; no trimmed join → no `cutLearn`/`cutLines`. `preset-knob-apply.test.ts` (3).

**Step 4 — the card UI + ruling 8 (builder #4, 2026-10-22; code `f39a220`).** No main code touched.

- Ruling 8 (maxTail only raised): `fitTails` skips every cap below the style's
  (`src/shared/studio/cut-learn-fit.ts:86`, `if (M < m || M < style.maxTail) continue;`). Test
  `cut-learn.test.ts:98` "never lowers maxTail …": user tails clipped at 0.15 s under the fitted
  tight (cap 0.7) → other knobs change, no `maxTail` change, `fitted.maxTail` 0.7. **It FAILED
  without the guard** (`expected { knob: 'maxTail', from: 0.7, … } to be undefined` — the fit
  lowered the cap), passes with it; the step-1/3 numbers (old tight → maxTail 0.5) are unchanged.
- `src/features/studio/components/CutLearnBlock.tsx` (95, new): `proposal.cutLines` each as one
  dim line (main wrote every number; the block computes none), then a toggle "Show the N joins it
  measured" → a scrollable table (max 200 px): Join = `<file name> @ <edge s>` + `lastWord |
  nextWord` + `skipped`; "Tail you / style" = `tail s · tailDb dB / styleTail s · styleTailDb dB`
  (+ "(soft)" when the style lands it soft); "Lead-in you / style". Hooks:
  `[data-preset-update-cut]`, `[data-preset-update-cut-line]`, `[data-preset-update-toggle-joins]`,
  `[data-preset-update-joins]`, `[data-preset-update-join=<ref>]`.
- `PresetUpdateCard.tsx:88-90` renders the block under the knob table only when `cutLines` is
  non-empty (old cards / no trimmed join → nothing new); new optional prop `assetNames` (:13).
  `AgentPanel.tsx:103` builds `assetNames` (id → file name via `assetName` from
  `services/agent-chat-format.ts`) from a new optional `assets` prop; `EditorShell.tsx:1535`
  passes `project.assets`. (AgentPanel was already 420 lines before B4; +5.)
- No renderer test: the card had none (the brief's rule).

**Step 5 (a)–(d) — the M2 stand-in, live (builder #5, 2026-10-22; card fix + docs `a734ff5`).** Kit in `.vidtsx-temp/end-to-end/B4/` (gitignored): `setup.mjs` (start state; args
`<studioRoot> <profile> <out>` for Hasan's station), `launch.sh` (CDP 9301, B2 profile, log
`C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\app.log`), `cdp.mjs`, `restore.ps1`, `drive.mjs`
(`ready` · `cut` · `trim <ops.json>` · `probe` · `learn <tag> [read]` · `accept` · `shot`),
`vitest.b4.config.ts` + `targets.b4.test.ts` (`B4_TARGETS=1`).

- (a) Start state (ruling 7): scratch user preset `b4-start-old-tight` ("B4 start — old tight")
  in `profiles\B2\profile\assets\presets\` (flat knobs copied from youtube-long-form, `style.cut =
  {base:'tight', head:0.11, minTail:0.14, maxTail:0.4, margin:5}`); `B2-root\projects\video-14-raw`
  → `settings.presetId` = it, no `cutStyle`, `settings.agent.providerId = 'b4-no-model'` (an id no
  provider is registered under), timeline + proposals emptied. Backup of the project as B3 left it:
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\backup\B2-root-project.before-b4.json`. BEFORE preset:
  `.vidtsx-temp/end-to-end/B4/preset.before.B2-root.json`.
- (b) In the app: 0369/0370/0371 on V1, Auto Cut + "Apply N cuts" on each with the preset's style.
  **Act 1** = the editor's `cuts.json` keeps (read-only) planned with its `styles.tight` through
  Studio's `planClip`, summed in clip order to 115 s → raw cut-off 0369 → 41.024, 0370 → 82.688,
  0371 → 188.287 (26 keeps). Studio's Auto Cut is pause-only (keeps the retakes `cuts.json`
  removed): 47 joins on V1 in that span, **28 sentence joins** (both words inside keeps), **the
  first 21 in time order used** (0369 ×5, 0370 ×8, 0371 ×8; words + old/fitted edges in
  `.vidtsx-temp/end-to-end/B4/act1-joins.json`). Targets = the fitted tight's own edges at each join
  (`measureCutJoins` with `styles.tight`): 42 edges, 39 moved (3 already there: "apps? | Simply,"
  tail, "costs, | no" and "app | costs" lead-ins), each dispatched as the reducer's `'trim'`
  (`tl.dispatch` from TimelinePanel's props — what `useClipDrag.ts:274` sends — with
  `rippleAllTracks: true`, so a lengthened head never clamps at its neighbour).
- (c) Learn through the BUTTON with no model: Inspector → Project → "Learn from this video" → the
  card in the Assistant tab, summary "(numbers only — no summary model was available)".
- (d) "Update preset" → preset `style.cut` = `{ base:'tight', maxTail:0.5 }` (head/minTail/margin
  overrides dropped = back to the base's 0.15/0.08/12), `learned[]` 1 entry, PRESET.md section
  appended. AFTER: `.vidtsx-temp/end-to-end/B4/preset.after.B2-root.json`. The flat knobs moved too
  (pacing normal→tight, shots 1.5→0, SFX 1→0, music quiet→none, captions block→none, transitions
  crossfade→none, intro 8→0, outro 10→0) — the scratch preset's youtube-long-form values vs a bare
  M2 timeline (existing flat learning, not B4).
- **Card defect found live and fixed** (`CutLearnBlock.tsx:58-84`): the per-join table rendered
  420 px wide inside the ~200 px Assistant column (`th` x 944/1155/1304, wrapper clientWidth 200,
  scrollWidth 420) — the tail/lead-in numbers were off-screen. Now stacked rows per join (file @
  edge · words · "Tail you / style" · "Lead-in you / style"); hooks `[data-preset-update-joins]`,
  `[data-preset-update-join=<ref>]` kept.

**Step 5 (e) — the two negatives on the M2 data (builder #6, 2026-10-22; no `src/` change).**
Scratch test `.vidtsx-temp/end-to-end/B4/negatives.b4.test.ts` (gitignored kit, `B4_NEG=1`, run
with `vitest.b4.config.ts`): the REAL `propose_preset_update` handler with `summary` passed (no
model; `llm-handlers` mocked to fail anyway), the real learn path + real `cut-style.json`, the
REAL v3 waveforms and transcripts read from `B2-root\projects\video-14-raw\cache` (read-only;
`generateWaveform` mocked to throw, `getProjectCacheDir` → that folder), the project =
`…\vidtsx-e2e\B4\project.after-trims.json`, the preset = a temp-library copy of
`preset.before.B2-root.json`'s style (old tight on the preset). Three cases; per-case JSON
(n, medians, fitted, changes, card lines, tool text) in `.vidtsx-temp/end-to-end/B4/negatives-1-as-trimmed.json`,
`negatives-2-own-style.json`, `negatives-3-nine-joins.json`.

- (1) As trimmed → the live card's four `cut.*` changes exactly (tool path = button path).
- (2) All 39 tagged edges moved back to the START style's own edges (`oldTailEdge` /
  `oldHeadEdge` from `act1-joins.json`, jitter −10/−5/0/+5/+10 ms, tags kept, V1 re-laid end to
  end) → **0 cut changes at 21 joins**, fitted = the current knobs.
- (3) Tags kept on the first 9 joins only (`withoutEdgeTag` on every other edge) → **0 cut
  changes**, the card line "Learned from 9 joins — at least 10 touched joins are needed before
  the cut knobs change."

**Step 6 — Hasan's station (builder #7, 2026-10-22; docs commit, see LOG.md; no `src/` change).**

- Kit (gitignored, `.vidtsx-temp/end-to-end/B4/`): `station.b4.test.ts` (`B4_STATION=1`, re-runnable =
  the RESET): (1) backup once → `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\backup\B1-verify-root-project.before-b4.json`
  (17,913 bytes, the station as B1's verifier left it: 1 clip on V1, 2 proposals); scratch preset
  `b4-start-old-tight` "B4 start — old tight" in `profiles\B1-verify\profile\assets\presets\` = the
  profile's youtube-long-form preset.json with flat knobs `pacing tight, shotsPerMinute 0,
  sfxPerMinute 0, musicBed none, captions none, transitions [], intro 0, outro 0` and `style.cut =
  {base:'tight', head:0.11, minTail:0.14, maxTail:0.4, margin:5}` (copy:
  `.vidtsx-temp/end-to-end/B4/preset.before.B1-verify-root.json`); project `settings.presetId` = it,
  no `cutStyle`, `agent.providerId = 'b4-no-model'`, `proposals: []`; **V1 = the editor's `cuts.json`
  keeps (read-only) of 0369/0370/0371 up to the Act-1 cut-off (`act1-joins.json`), each planned with
  `planClip` + `cuts` under the START style (`resolveCutStyle` over the preset = tight + the four old
  knobs, asserted), whole segments starting before the cut-off, laid contiguous and untagged
  (`clip_b4st<clip>_<nn>`); A1 empty → 36 clips (0369 ×6, 0370 ×10, 0371 ×20), 0 merges, 33 joins
  (same-asset neighbours), 1:46.787.** `station.json` = the 33 joins (time, words, start + fitted-tight
  edges). (2) in-memory dry run (nothing written to the station): start state through the REAL
  `propose_preset_update` → no flat change; every join trimmed to the fitted tight's edges through the
  REAL `timelineReducer` `'trim'` (ripple all; 66 ops, 60 moved) → the card (`station-dryrun.json`).
  `station-check.mjs` (`open` · `readout` · `trim`, `CDP_PORT=9311`) = the click-check driver.
- `docs/studio/end-to-end/B4/hasan-station.ps1` (new): checks the profile/project/node_modules and that
  the checkout has `src\shared\studio\cut-learn.ts`, refuses if the station's electron is already
  running (matched by the profile path), unsets `ELECTRON_RUN_AS_NODE`, runs `npx.cmd electron-vite
  dev -- --user-data-dir=<B1-verify profile>` (+ `--remote-debugging-port` only with `-CdpPort`);
  `-Reset` saves `project.json` + `preset.json` to `…\vidtsx-e2e\B4\station-runs\<stamp>` then runs
  the station script.
- `docs/studio/end-to-end/B4/HASAN-STEP.md` (new): decision 6 + the ruled points — open
  video-14-raw, Act 1 = the whole 36-clip timeline (preview-tight 0:00–1:55), ripple buttons lit,
  Snap off if edges jump, "trim each sentence join the way you want it (about 21)" by dragging edges
  only, the 33 joins listed, Inspector → PROJECT → "Learn from this video" (not the Assistant chat;
  don't touch the Provider dropdown), pass = head 0.12–0.18 / minTail 0.05–0.11 / margin 11–13,
  maxTail "at least", softGap not learned, non-cut rows to ignore, ~20–25 min, `-Reset`.
- Ripple: `useRippleMode.ts` keeps the mode in renderer `localStorage['studio.ripple.mode']`
  (default `'all'` when absent); trims ripple only in `'all'` (`useClipDrag.ts:279`). On the station
  it was absent (= `'all'`); the click-check set it to `'all'` explicitly (not found in the leveldb
  after the kill — likely unflushed; harmless, the default is `'all'`).

**Step 7 — gates + docs (builder #8, 2026-10-22; docs commit, see LOG.md; no `src/` change, no app launch).**

- Full vitest per DRIVING.md (C: < 4 GB → python-models excluded; CPU at 100 % → `--maxWorkers=4`): run 1 red only
  on two known-load files, both green alone; **run 2 green = the counted run**. Types 26/10.
- `Status.md`: the B4 row at the top (dated 2026-10-22; what was built, why the card fits rather than takes a raw
  median, maxTail only raised, softGap not learned, the stand-in Δ 0, the negatives, the station + its dry run, the
  gates, "THE EXIT WAITS FOR HASAN" with his steps and HASAN-STEP.md, honest notes, follow-ups).
- `docs/studio/TESTING.md`: `### 18.10 B4` after §18.9 — Hasan's step is the first, UNCHECKED exit item; the
  stand-in, accept, card, negatives, station, signal / measurement / learn-path items checked.
- Decision 7 (B3 doc debt) DONE in Status.md's B3 row and TESTING §18.9: "hard entries 0 / 0 on all nine clips" →
  eight clips with keeps (0366 has none); the 133 vs 134 joins flip at 0373 seg 17 added (Studio skip 0.738 s vs
  analyze_cut 0.798 s across the 0.75 s line; Studio's seg 16 ends 63.566 vs 63.506 — from
  `…\vidtsx-e2e\B3-verify\compare.txt` / `details.txt`); the audition numbers re-read as `formatClock` MM:SS.FF (60 fps
  frames): `13:04.33` → `13:08.32` = 784.55 → 788.53 s around the join 785.539 / 787.544 = **±0.99 s** (the B3
  verifier's video-element read: source 320.200 → 321.075, 323.217 → 324.112 around 321.193 / 323.198,
  `…\B3-verify\audition-0373-hard.json`); the "~0.2 s early" follow-up removed; the parked-playhead follow-up's
  "655.44" re-read as clock `10:55.44` = 655.73 s (the claim itself stands).

**Fix round 1 (builder #9, 2026-10-22; code + docs in one commit, see LOG.md).**

- Gate (`src/shared/studio/cut-learn.ts`): the median-offset gate (`headDiffers` / `tailDiffers`) is gone; each knob
  is proposed by `pushChange` (now returns boolean) when ≥ 10 edges on its side AND |fitted − current| > 30 ms (> 1 dB
  margin). Notes when nothing moves: "Your lead-ins fit head X s, within 30 ms of the current Y s (median offset from
  the style's lead-ins …): head unchanged." · "Your tails fit within 30 ms and 1 dB of the current tail knobs (median
  offset from the style's tails …, … dB): tail knobs unchanged." Header + `studio-cut-learn.ts` Q4 comments updated.
  Head grid unchanged (10 ms = the preset form's `step: 0.01`, `cut-style-labels.ts:18`).
- Joins (`src/shared/studio/cut-learn-joins.ts` `collectCutLearnJoins` + `mergeIntoTrimJoin`): a proposal-drag join
  whose touched edge(s) equal a trim join's edge(s) (same asset, ±2 ms) is merged into it (touched flags OR-ed,
  `source: 'trim'`, the trim's `ref`).
- Card (`PresetUpdateCard.tsx:84-86`): no knob changes + cut lines → "No knob changes proposed — the cut lines below
  say what was measured."; PRESET.md (`preset-learn-format.ts` `buildLearnedSection`): "- Knobs: unchanged — no knob
  moved past the learning thresholds" when cut lines exist.
- Tests: `cut-learn.test.ts` 11 (own-style note regexes updated; NEW 40-seed ±40 ms jitter on fitted-tight edges over
  24 synthetic joins → fit within 0.15 ± 0.03 in 40/40, proposed iff |fit − 0.11| > 30 ms, 32/40 proposed, 60 s
  timeout; NEW own-style ±20 ms → no head in 8/8). **With the old `cut-learn.ts` the jitter test FAILS** (seed 7: fit
  0.15, not proposed). `cut-learn-joins.test.ts` 10 (NEW: dragged head + trimmed tail → ONE join; a lone drag stays).
- HASAN-STEP.md: Snap off (magnet "Snap to edges and playhead", right-hand toolbar group left of the magnifiers; ON at
  every open; why small trims snapped back); zoom in at each join (ruler click → playhead; Zoom in / Ctrl+scroll 4–5×
  → 320 / 640 px/s; Shift+Z back); how a registered trim looks (edge stays, ripple shifts the rest) vs not (springs
  back); a missing `Cut lead-in` row → note "head X s" from the Lead-in line; time 25–30 min. Wording from source
  (`TimelineToolbar.tsx:128-138`, `timeline-view.ts:4-5`, `snapping.ts:9`, `TimelinePanel.tsx:342-366`); no UI drive.
- Scratch `.vidtsx-temp/end-to-end/B4/jitter.b4.test.ts` (`B4_JITTER=1`): the station's 33 joins (`station.json`
  fitted / start edges) + seeded jitter, the station's real transcripts + v3 waveforms via `readTranscriptFile` /
  `loadRmsEnvelope` (read-only cache, `generateWaveform` mocked to throw), start style = cut-style.json tight + the old
  knobs → `learnCutKnobs`. Output `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\jitter-station.json` (new gate) and
  `jitter-station.old-gate.json` (the same run with HEAD's `cut-learn.ts`, restored after).

**Fix round 2 (builder #10, 2026-10-22; code + docs in one commit, see LOG.md).**

- HASAN-STEP.md §2 rewritten (§1/§3/§4 numbering kept): **Snap OFF first, before anything is clicked in the
  timeline** (why: the 8 px pull to the neighbour edge AND to the playhead, which stands on the nearest frame); then a
  numbered per-join routine — playhead on the join (ruler click), **Zoom in 4×** (320 px/s; a 5th click = 640 px/s
  can put the join at the right edge of the timeline → drag the scrollbar under the tracks), **read the total**
  (`/ MM:SS.FF`, frames, 1 frame ≈ 17 ms), **drag from the clip's LOWER half** (the mid-height 12 px "Add transition"
  square `data-join-for` — `TransitionJoins.tsx:73-95`, `onPointerDown` stops propagation — and the 9 px top-corner
  "Fade in"/"Fade out" dots do not trim), **the total is the sign for both edges** (± the trim, 30–50 ms = 2–3
  frames; a tail edge stays where dropped; a lead-in edge comes back to the join with ripple on — normal,
  `ripple-ops.ts:266-279`; total unchanged = not registered (Snap lit, square/fade dot grabbed, < 2 px —
  `useClipDrag.ts:216-222`) → drag again; moved too much → Ctrl+Z), then Shift+Z. The join table says its times are
  seconds with hundredths while the clock is MM:SS.FF in frames (join 2 at 0:10.25 = clock `00:10.15`, seen live);
  the Provider dropdown's "App default (active provider)" is display only; time 25–30 min everywhere (the routine sums
  to ≈ 21–25 min of joins).
- Card (`src/features/studio/components/PresetUpdateCard.tsx:66-71`): the stats sentence renders only when it differs
  from the summary (`statsSummary !== summary`; with no summary model `learn-from-project.ts:125-127` sets
  summary = the stats sentence) — shown once; hook `[data-preset-update-stats]`.
- Status.md B4 row: the per-knob gate (≥ 10 edges AND |fitted − current| > 30 ms / > 1 dB) replaces the stale median-gate
  text (:22, :33); the fix-1 trim check marked wrong; the EXIT bullet carries pass rule (a) + the new routine; a fix
  round 2 bullet (live drag table, verifier round 2's jitter numbers). TESTING §18.10: the exit item rewritten (rule (a),
  the gate, the total cue, 25–30 min); the negatives' note text = the post-fix-1 wording; fix round 1's trim check marked
  wrong; a fix round 2 item.
- Kit (gitignored): `.vidtsx-temp/end-to-end/B4/fix2-prep.mjs` (B2-root V1 = the station's 36 start clips, read
  read-only from B1-verify-root; backup `…\vidtsx-e2e\B4\backup\B2-root-project.before-fix2.json`, 66,636 B),
  `fix2-launch.sh` (CDP 9301, B2 profile, log `…\B4\app-fix2.log`), `fix2-drag.mjs` (`open` · `state` · `snap` ·
  `ruler <s>` · `zoomin <n>` · `fit` · `drag <clipId> <start|end> <ms> <tag>` — real `Input.dispatchMouseEvent`
  press/move/release; rows → `…\vidtsx-e2e\B4\fix2-drags.json`).

## Verified (exact commands + outputs)

Fix round 2 (C: 19.28 GB / D: 33.37 GB free before launch; no electron.exe and no listener on 5173 / 9222 / 9301 /
9311 / 3200 before; Hasan's station NOT touched — only its `project.json` READ by `fix2-prep.mjs`):

- `node fix2-prep.mjs` → `backup …B2-root-project.before-fix2.json 66636` · `settings {"width":1920,"height":1080,
  "fps":60,"agent":{"providerId":"b4-no-model"},"presetId":"b4-start-old-tight"}` · `tracks v1:36,a1:0 proposals 0
  end 106.787`.
- `bash fix2-launch.sh` (background) → `node fix2-drag.mjs open` → root `C:/Users/hasan/AppData/Local/vidtsx-e2e/B2-root`,
  ripple `[true,true]`, `{"snapOn":true,"pps":20,"clock":"00:00.00","total":"/ 01:46.47"}`, disk V1 36, end 106.787
  (still `stills\b4-fix2-00-open.png`).
- Following the NEW HASAN-STEP.md: `snap` → `snapOn:false` (Snap off FIRST) → `ruler 10.25` → clock `00:10.15`
  (= 10.25 s; the join 0369_02 | 0369_03 at 10.245) → `zoomin 4` → `pps 320`, the join at x 356 of a ~1185 px
  viewport (`b4-fix2-01-zoom320.png`) → `zoomin 1` → `pps 640`, the join at x ≈ 1186 = the RIGHT EDGE (the driver's
  `scrollIntoView` brought it back; Hasan: the scrollbar).
- Real-mouse drags (`node fix2-drag.mjs drag …`; `fix2-drags.json`; stills `stills\b4-fix2-<tag>.png`), Snap off unless
  said; "edge x" = the dragged handle's CSS x before → after; disk = B2-root `project.json`:

  | # | edge (clip) | drag | px/s | total before → after | edge x | disk edge | tag after |
  |---|---|---|---|---|---|---|---|
  | 1 | lead-in (0369_03 start) | −40 ms (−13 px), lengthen | 320 | `/ 01:46.47` → `/ 01:46.50` | 356 → 356 (back at the join) | sourceIn 20.450 → 20.409 (−41 ms) | `edges.start: 'trim'`, `op: 'trim'` |
  | 2 | lead-in (0369_03 start) | +40 ms (+13 px), shorten | 320 | `/ 01:46.50` → `/ 01:46.47` | 356 → 356 | sourceIn 20.409 → 20.450 (+41) | kept |
  | 3 | tail (0369_02 end) | +50 ms (+32 px), lengthen | 640 | `/ 01:46.47` → `/ 01:46.50` | 352.8 → 384.8 (stays where dropped) | end 10.245 → 10.295 (+50) | `edges.end: 'trim'` |
  | 4 | tail (0369_02 end) | −30 ms (−19 px), shorten | 640 | `/ 01:46.50` → `/ 01:46.48` | 384.8 → 365.8 | end 10.295 → 10.265 (−30) | kept |
  | 5 | lead-in (0369_03 start) | −40 ms (−26 px), lengthen | 640 | `/ 01:46.48` → `/ 01:46.51` | 367.4 → 367.4 | sourceIn 20.450 → 20.409 (−41) | kept |
  | 6 | lead-in (0369_03 start) | +40 ms (+26 px), shorten | 640 | `/ 01:46.51` → `/ 01:46.48` | 367.4 → 367.4 | sourceIn 20.409 → 20.450 (+41) | kept |
  | 7 | **failed on purpose:** tail (0369_03 end), **Snap ON**, playhead away (10.25 s, the edge at 13.842) | +6 ms (+4 px) | 640 | `/ 01:46.48` → `/ 01:46.48` (**unchanged = the doc's "not registered"**) | 1186.3 → 1186.3 | end 13.842 → 13.842 | no `edges.end` (only the start tag from rows 1–2/5–6) |
  | 8 | tail (0369_03 end), Snap ON, ruler at 13.822 (clock `00:13.49`; the join had moved to 13.842 by row 4's ripple, so the playhead was 16 px off) | +8 ms (+5 px) | 640 | unchanged | 681.5 → 681.5 | unchanged | none — snapped back to the neighbour; the verifier's Snap-to-playhead case (−4.7 ms) was NOT re-created here |

  Grabs that did NOT trim (recorded in `fix2-drags.json` before the routine above; each showed total unchanged): 2 at
  the handle's mid-height — the pointer log (`pointerdown` capture on `window`) and `elementFromPoint` = `<button
  data-join-for="clip_b4st0369_02" title="Add transition">` (12 × 12 px, z-20, `top: 50%`); 1 at 640 px/s mid-height
  on the square again; 2 at the end handle's top (y = top + 8) → target `div[title="Fade out"]` (9 px dot,
  `top-[1px]`, z-10); and 2 lead-in grabs at y = top + 8 at 320 px/s whose target was not logged (the same point
  then trimmed in rows 1–2's runs — not explained; the total cue catches it). From the lower half (y = top + 38 of
  48.4 px): 4/4 registered (rows 3–6).
- App stopped by `--remote-debugging-port=9301` / the B2 profile path / `fix2-launch.sh` command lines (13 processes)
  → `left: 0`; no listener on 5173 / 9301.
- `npm run check:types` (log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\check-types-fix2.log`) →
  `tsconfig.web.check.json: 26 errors (baseline 26) ok` · `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Full `npx vitest run` (no exclusion: C: 19 GB; app stopped; log
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\vitest-full-fix2-run1.log`) → **run 1 green, COUNTED: `Test Files 457
  passed | 5 skipped (462)` · `Tests 3866 passed | 34 skipped (3900)`, 51.88 s, exit 0.** (No new test: the card had
  none — step 4's rule; the change is a render condition.)

Fix round 1 (C: 19.1–19.5 GB / D: 5.1–5.3 GB free; no electron.exe running; no app launched; station not touched):

- `npx vitest run src/shared/studio/cut-learn.test.ts src/shared/studio/cut-learn-joins.test.ts
  src/main/services/studio/agent-tools/preset-tools.test.ts …preset-knob-apply.test.ts …learn-from-project.test.ts
  …preset-learn-stats.test.ts src/main/ipc/preset-learn-handlers.test.ts src/features/studio/services/clip-edit-tags.test.ts`
  → `Test Files 8 passed (8) · Tests 59 passed (59)`.
- Old gate check: HEAD's `cut-learn.ts` swapped in → `cut-learn.test.ts` `Tests 2 failed | 9 passed (11)` (the
  own-style note wording + "seed 7: fitted head 0.15: expected false to be true"); fixed file restored → 11 passed.
- `$env:B4_JITTER='1'; npx vitest run --config .vidtsx-temp/end-to-end/B4/vitest.b4.config.ts jitter` → 1 passed.
  New gate: `33 joins, fitted ±40 ms: head proposed 9/10, fitted head 0.14–0.16` · `±30 ms: 10/10, 0.15–0.16` ·
  `±20 ms: 10/10, 0.15–0.16` · `first 21 joins, fitted ±40 ms: 8/10, 0.13–0.16` · `START edges ±20 ms: 0/10,
  0.1–0.11` · `START edges ±40 ms: 0/10, 0.08–0.12` (tail false positive: seed 8 minTail 0.14 → 0.1). Misses: 33 joins
  seed 9 fit 0.14 (median lead-in 0.143); 21 joins seed 6 fit 0.13, seed 9 fit 0.14. Old gate, same seeds: 2/10 ·
  4/10 · 7/10 · 4/10 · 0/10 · 0/10.
- `$env:B4_NEG='1'; npx vitest run --config .vidtsx-temp/end-to-end/B4/vitest.b4.config.ts negatives` → `Tests 3
  passed (3)`; (1) changes head 0.11→0.15, minTail 0.14→0.08, maxTail 0.4→0.5, margin 5→12; (2) `[]`, fitted = the
  current knobs, the two new "unchanged" lines; (3) `[]` + "Learned from 9 joins — …".
- `npm run check:types` (log `…\B4\check-types-fix1.log`) → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Full `npx vitest run` (no exclusion: C: ≥ 4 GB) run 1 (log `…\B4\vitest-full-fix1-run1.log`) → `1 failed | 456
  passed | 5 skipped (462) · Tests 1 failed | 3865 passed` — the NEW 40-seed test, `Test timed out in 5000ms` under
  load (alone 4.3 s for the file); given `60_000` → alone `Tests 11 passed (11)`. **Run 2 (COUNTED, log
  `…\B4\vitest-full-fix1-run2.log`) → `Test Files 457 passed | 5 skipped (462) · Tests 3866 passed | 34 skipped
  (3900)`, 43.09 s.**

Step 7 (C: 2.26 GB / D: 4.98 GB free before the runs, C: 2.26 / D: 4.88 before run 2; no electron.exe running, no
listener on 5173 / 9222 / 9301 / 9311 / 3200; other sessions' Remotion studios + MCP servers kept the CPU at 100 %):

- Run 1: `npx vitest run --exclude src/main/services/python-models/service.test.ts --maxWorkers=4` (log
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\vitest-full.log`) → `Test Files 2 failed | 454 passed | 5 skipped (461)
  · Tests 2 failed | 3850 passed | 34 skipped (3886)` (86.95 s): `flow-render.test.ts:255` (`vi.waitFor` → `expected 0
  to be greater than 0`) and `shot-module-resolver.test.ts:151` ("a changed transpiler fingerprint misses every
  tier": `never written: …\shot-module-cache-jyHmPF\…\v1.json` from the test's 100 × 10 ms `waitForFile`) — both on
  DRIVING.md's known-load list.
- Alone: `npx vitest run src/main/services/studio/shot-module-resolver.test.ts src/main/services/flows/flow-render.test.ts`
  (log `…\B4\vitest-alone-run1.log`) → `Test Files 2 passed (2) · Tests 15 passed (15)`.
- **Run 2 (COUNTED):** the same command (log `…\B4\vitest-full-run2.log`) → `Test Files 456 passed | 5 skipped (461)
  · Tests 3852 passed | 34 skipped (3886)`, `Duration 96.02s`, exit 0.
- `npm run check:types` (log `…\B4\check-types.log`) → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Station read-only re-check (no launch, no script): `B1-verify-root\projects\video-14-raw\project.json` (22,253 B,
  17:33) settings `{"width":3840,"height":2160,"fps":60,"agent":{"providerId":"b4-no-model"},"presetId":"b4-start-old-tight"}`,
  tracks `v1:36,a1:0`, proposals 0, clips with `origin` 0; `profiles\B1-verify\profile\assets\presets\b4-start-old-tight\preset.json`
  `style.cut {"base":"tight","head":0.11,"minTail":0.14,"maxTail":0.4,"margin":5}`, `learned[]` 0.

Step 6 (C: 2.27 GB / D: 5.29 GB free before launch; no electron/vite/9311/5173 listener before):

- `$env:B4_STATION='1'; npx vitest run --config .vidtsx-temp/end-to-end/B4/vitest.b4.config.ts station`
  → `Test Files 1 passed (1) · Tests 2 passed (2)` (2.70 s). `station.json`: `clips 36, perAsset
  {0369:6, 0370:10, 0371:20}, merged 0, joins 33, act1Seconds 106.787, tracks v1:36,a1:0, proposals 0`,
  settings `{"width":3840,"height":2160,"fps":60,"agent":{"providerId":"b4-no-model"},"presetId":"b4-start-old-tight"}`.
  Dry run (`station-dryrun.json`): `ops 66, moved 60`; tool text `… 1:44 long, 20.2 cuts/min … Cut
  knobs: learned from 33 trimmed joins (30 lead-ins, 30 tails), 4 cut knob changes.`; medians
  `leadIn 0.15 (style 0.11) · tail 0.21 (0.4) · tailDb 11.2 (6)`; fitted `head 0.15, minTail 0.08,
  maxTail 0.5, margin 12`; knobChanges exactly `cut.head 0.11→0.15 · cut.minTail 0.14→0.08 ·
  cut.maxTail 0.4→0.5 · cut.margin 5→12` (no flat change, also none at the start state).
- Launch through the launcher: `powershell -NoProfile -ExecutionPolicy Bypass -File
  docs\studio\end-to-end\B4\hasan-station.ps1 -CdpPort 9311` (log
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\station-app.log`: Vite on 5173, `DevTools listening on
  ws://127.0.0.1:9311`, main init 269 ms).
- `CDP_PORT=9311 node station-check.mjs open` → `studio root before
  {"root":"C:/Users/hasan/AppData/Local/vidtsx-e2e/B1-verify-root"}` (already set), `ripple mode
  before null` → set `all` + reload → `all`; Auto ripple + "Ripple all tracks — …" active; live `tl`
  V1 36 = disk 36; Inspector (nothing selected) → `PROJECT` section "Preset B4 start — old tight" +
  enabled "Learn from this video" (heads `Project / AI Assistant`). Stills
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\stills\b4-station-open.png` (36 clips, 01:46.47, both
  ripple buttons lit), `b4-station-inspector.png`.
- `node station-check.mjs readout` → `tight + 4 overrides · preset “B4 start — old tight”`, title
  `internalGap 0.4 · head 0.11 · minTail 0.14 · maxTail 0.4 · margin 5 · softGap 99 · …`
  (`b4-station-readout.png`); probe `window.api.llmGenerate({ providerId: 'b4-no-model' })` →
  `{"success":false,"error":"Provider \"b4-no-model\" not registered"}`.
- `node station-check.mjs trim` → join 1 "Code. | But" tail 7.568 → 7.328 through `tl.dispatch('trim',
  rippleAllTracks: true)` → disk `end 7.328, origin {"by":"user","op":"trim","edges":{"end":"trim"}}`,
  next clip pulled 5.812 → 5.572 (`b4-station-one-trim.png`); `undo` → `end 7.568, origin null, next
  5.812, clips 36`.
- Stopped by `--remote-debugging-port=9311` / the B1-verify profile path / `hasan-station.ps1` command
  lines (11 processes: launcher, npx, electron-vite, electron + children) → `left: 0`, no listener on
  5173 / 9311 / 3200.
- Reset through the launcher: `hasan-station.ps1 -Reset` → `Saved … station-runs (*.20261022-173323.json)`
  (project 22,253 B, preset 1,086 B), `Tests 2 passed (2)`; disk after: settings as above, `v1:36,a1:0
  proposals 0 tagged 0 end 106.787`.

Step 5 (e) (C: 2.40 GB / D: 5.32 GB free before the run; no app launched):

- `B4_NEG=1 npx vitest run --config .vidtsx-temp/end-to-end/B4/vitest.b4.config.ts negatives` →
  `Test Files 1 passed (1) · Tests 3 passed (3)` (3.22 s).
- (1) `joins 21, headEdges 19, tailEdges 20`; medians `leadIn 0.15 (style 0.11) · tail 0.22
  (style 0.4) · tailDb 11.4 (style 6)`; fitted `head 0.15, minTail 0.08, maxTail 0.5, margin 12`;
  changes `cut.head 0.11→0.15 · cut.minTail 0.14→0.08 · cut.maxTail 0.4→0.5 · cut.margin 5→12`;
  tool text `… Cut knobs: learned from 21 trimmed joins (19 lead-ins, 20 tails), 4 cut knob
  changes.`; card lines identical to the live card's (step 5 (c)).
- (2) `joins 21, headEdges 19, tailEdges 20`; medians `leadIn 0.11 (style 0.11) · tail 0.393
  (style 0.4) · tailDb 6.1 (style 6)`; fitted `head 0.11, minTail 0.14, maxTail 0.4, margin 5`;
  `changes []`; lines add "Your lead-ins sit within 30 ms of the style's (median +0 ms): head
  unchanged." · "Your tails sit within 30 ms and 1 dB of the style's (median +0 ms, +0.1 dB):
  tail knobs unchanged."; tool text `… (19 lead-ins, 20 tails), 0 cut knob changes.`
- (3) `joins 9, headEdges 8, tailEdges 9`; medians `leadIn 0.15 (0.11) · tail 0.18 (0.4) · tailDb
  10.5 (5.9)`; fitted `{}`; `changes []`; lines end "Learned from 9 joins — at least 10 touched
  joins are needed before the cut knobs change."; tool text `… from 9 trimmed joins (8 lead-ins,
  9 tails), 0 cut knob changes.`
- Station facts read for step 6 (read-only): `B1-verify-root\projects\video-14-raw\project.json`
  settings `{"width":3840,"height":2160,"fps":60,"agent":{}}`, tracks `v1:1, a1:0`, 2 proposals;
  0369/0370/0371 assets present with the SAME ids as B2-root (`6290a63b…`, `904f9373…`,
  `0c105962…`), v3 waveforms, transcripts 44 / 97 / 207 words. `profiles\B1-verify\profile\assets\presets`
  holds only the three built-ins (no B4 preset yet).

Step 5 (a)–(d) (C: 1.81 GB / D: 5.55 GB before launch; C: 2.43 / D: 5.46 after; app stopped by
`--remote-debugging-port=9301` / profile path, 0 processes left):

- `node setup.mjs` → `settings {"width":1920,"height":1080,"fps":60,"agent":{"providerId":"b4-no-model"},"presetId":"b4-start-old-tight"}`
  · `tracks v1:0,a1:0 proposals 0`.
- `node drive.mjs ready` → readout `tight + 4 overrides · preset “B4 start — old tight”`, title
  `internalGap 0.4 · head 0.11 · minTail 0.14 · maxTail 0.4 · margin 5 · softGap 99 · …`.
- No-model proof BEFORE the click: `node drive.mjs probe` → `window.api.llmGenerate({ providerId:
  'b4-no-model' })` = `{"success":false,"error":"Provider \"b4-no-model\" not registered"}`
  (`src/engine/llm-engine.ts:77-79` throws before any request). At the click, app.log:
  `[WARN] [LearnFromProject] Preset summary call returned nothing`. Home: "Providers 0 of 7
  configured" on this profile.
- `node drive.mjs cut` → 0369 `Apply 7 cuts` (6 segments), 0370 `Apply 15 cuts` (14), 0371
  `Apply 31 cuts` (30), every plan `head 0.11 minTail 0.14 maxTail 0.4 margin 5 softGap 99`; V1 =
  50 clips; 3 cut-plan proposals `applied`, `snapped` on 7/7, 15/15, 31/31 items.
- `B4_TARGETS=1 npx vitest run --config .vidtsx-temp/end-to-end/B4/vitest.b4.config.ts targets` →
  `Tests 1 passed (1)`; `act1-joins.json`: `joinsOnV1 47`, `usable 28`, `chosen 21`.
- `node drive.mjs trim trims-fitted-moved.json` → `trims 39 off-target/untagged 0 []`; disk: V1 50
  clips, 39 tagged edges (`origin {by:'agent', proposalId, op:'trim', edges:{…:'trim'}}`). Copy:
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\project.after-trims.json` (66,636 bytes).
- `node drive.mjs learn standin` → app.log `[LearnCutKnobs] Cut knobs measured`; card knob rows
  `Cut lead-in (s) 0.11 → 0.15 median lead-in 0.15 s at 19 joins (the style kept 0.11 s)` ·
  `Cut tail min (s) 0.14 → 0.08 median tail 0.22 s, 11.4 dB over the floor at 20 joins (the style:
  0.4 s, 6 dB)` · `Cut tail max (s) 0.4 → 0.5 at least 0.5 s — only known up to the longest tail
  you kept` · `Cut margin (dB) 5 → 12 …`; cut lines `Cut: learned from 21 joins you trimmed (19
  lead-ins, 20 tails) — …` · `Lead-in: you kept a median 0.15 s … head 0.15 s reproduces your
  edges.` · `Tail: you kept a median 0.22 s after the last word, cut 11.4 dB over the floor (the
  style: 0.4 s, 6 dB); minTail 0.08 s and margin 12 dB reproduce your edges; maxTail at least
  0.5 s.`; toggle `Show the 21 joins it measured` → 21 rows. **Exit check on the stand-in: head
  0.15 (target 0.15 ± 0.03), minTail 0.08 (0.08 ± 0.03), margin 12 (12 ± 1) — Δ 0 / 0 / 0.**
  Full card JSON: `.vidtsx-temp/end-to-end/B4/card-standin.json`.
- Stills (`C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\stills\`): `b4-card-standin.png`,
  `b4-card-standin-cutblock.png`, `b4-card-standin-joins.png` (the full card, before the fix),
  `b4-card-standin-joins-stacked.png` (after the fix: join list clientWidth 200 = scrollWidth 200,
  height 200 of 1212 scrollable, 22 children = header + 21 rows).
- `node drive.mjs accept` → `preset style.cut after {"base":"tight","maxTail":0.5}`; diff
  before/after: `cut` head/minTail/maxTail/margin 0.11/0.14/0.4/5 → maxTail 0.5 only.
- `npm run check:types` (after the card fix) → `tsconfig.web.check.json: 26 errors (baseline 26)
  ok` · `tsconfig.node.check.json: 10 errors (baseline 10) ok`.

Step 4:

- `npx vitest run src/shared/studio/cut-learn.test.ts src/shared/studio/cut-learn-joins.test.ts
  src/main/services/studio/agent-tools/preset-tools.test.ts` → `Test Files 3 passed (3) · Tests
  23 passed (23)`. Same file set with `cut-learn-fit.ts` stashed → `Tests 1 failed | 8 passed (9)`
  in `cut-learn.test.ts` (the new test; guard restored after).
- Subset `npx vitest run src/features/studio src/main/services/studio src/shared/studio
  src/main/services/agents src/main/ipc` (log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\vitest-step4-subset.log`)
  → `Test Files 1 failed | 239 passed | 2 skipped (242) · Tests 1 failed | 2048 passed | 23
  skipped (2072)` (36.61 s) — the one failure is the KNOWN load timeout
  `shot-module-resolver.test.ts` "a changed transpiler fingerprint misses every tier" (5032 ms);
  alone: `npx vitest run src/main/services/studio/shot-module-resolver.test.ts` → `Tests 10
  passed (10)` (593 ms). DRIVING.md load rule.
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Disk at step 4: C: 2.3 GB, D: 5.8 GB free. No app launched — the card is NOT yet seen live
  (step 5's click-through).

Step 3:

- `npx vitest run src/main/services/studio/preset-knob-apply.test.ts
  src/main/services/studio/agent-tools/preset-tools.test.ts …learn-from-project.test.ts
  …preset-learn-stats.test.ts src/main/ipc/preset-learn-handlers.test.ts
  src/shared/studio/cut-learn.test.ts src/shared/studio/cut-learn-joins.test.ts` →
  `Test Files 7 passed (7) · Tests 43 passed (43)` (2.33 s).
- Subset `npx vitest run src/features/studio src/main/services/studio src/shared/studio
  src/main/services/agents src/main/ipc` (log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\vitest-step3-subset.log`)
  → `Test Files 240 passed | 2 skipped (242) · Tests 2048 passed | 23 skipped (2071)` (31.52 s).
  No full run yet (session gate at the end, DRIVING.md rules).
- `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline 26) ok` ·
  `tsconfig.node.check.json: 10 errors (baseline 10) ok`.
- Disk at step 3: C: 2.26 GB, D: 6.09 GB free. No app launched.

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

**None for a builder — fix round 2 is DONE.** The orchestrator re-verifies (verifier round 3 — on `B2-verify-root` +
`profiles\B2-verify\profile`, never Hasan's station) or marks B4 `WAITING-HASAN`; Hasan's step = the updated
`docs/studio/end-to-end/B4/HASAN-STEP.md` (~25–30 min). Note for a verifier driving drags by CDP: grab the handle in
its LOWER half (y ≈ top + 38 of 48 px) — mid-height is the "Add transition" square, the top corners the fade dots.

(Fix round 2 brief, kept — DONE by builder #10:)
**FIX round 2 (orchestrator, 2026-10-22, after verifier round 2's FAIL — docs only; a THIRD FAIL
stops the run, so verify every sentence against the real UI before handing back):**
1. **HASAN-STEP.md:58-61 "Check each trim took" is wrong for lead-ins** (the FAIL). With ripple on
   (HASAN-STEP.md:34-37), a lead-in trim (the LEFT edge of the right-hand clip) never moves the
   visible edge — it slides back to the join by design (`ripple-ops.ts:270, 273-274`); only the
   waveform slides and the timeline total changes (verifier: join stayed at x = 796.6 before / mid /
   after; total 00:17.12 → 00:17.09). Rewrite the check with a cue that works for BOTH edges: the
   toolbar total ("/ mm:ss.ff") changes by about the trimmed amount (and the waveform under the
   join shifts); if the total did not change, the trim did not register — drag again; if it changed
   more than intended, Ctrl+Z. Say explicitly that a lead-in edge "comes back to the join" with
   ripple on and that this is normal.
2. **HASAN-STEP.md:41-46 Snap vs playhead:** turning Snap OFF must come BEFORE placing the playhead
   on the join (with Snap on, a small drag can snap to the playhead, which lands on the nearest frame,
   and commit a few-ms trim that looks like a spring-back). Order the steps so Snap is off first.
3. **Small doc notes:** the join table's times are seconds (hundredths) while the clock shows
   MM:SS.FF in frames — say so; one consistent time estimate everywhere (25–30 min); the Provider
   select showing "App default (active provider)" is display-only — don't touch it (already there?
   keep it).
4. **Status.md B4 row + TESTING §18.10:** state pass rule (a) (per knob: proposed in range, OR row
   missing and the card's fitted value in range) and the per-knob gate ≥ 10 edges AND |fitted −
   current| > 30 ms / > 1 dB; remove the stale median-gate text (Status.md ~:22 "median offset … >
   30 ms", ~:33 "The medians are the GATE", TESTING ~:414 "Your lead-ins sit within 30 ms of the
   style's"); fix the trim-check wording there too; "About 20–25 min" → 25–30. Add verifier round
   2's jitter numbers (rule (a) 39–40/40 at ±20/30/40 ms; own-style false positives 0/40 at ±20/30,
   5/40 minTail-only at ±40).
5. **Cheap, also do:** with no summary model the stats sentence appears twice on the card — show it
   once.
6. **Verify it yourself before DONE, live with REAL mouse drags** (CDP `Input.dispatchMouseEvent`),
   on `C:\Users\hasan\AppData\Local\vidtsx-e2e\B2-root` + `…\profiles\B2\profile` (CDP 9301; reset
   that scratch project if you need a clean timeline — it is scratch), following the NEW
   HASAN-STEP.md literally: Snap off, playhead on a join, zoom to 320/640 px/s, one lead-in trim and
   one tail trim each lengthened and shortened by 30–50 ms — record for each what the doc's cue
   shows (total before/after) and the disk edge + tag; one deliberately failed trim (Snap on, tiny
   drag, playhead away) recognisable by the cue. Stills to `C:\Users\hasan\AppData\Local\vidtsx-e2e\B4\`.
   NEVER Hasan's station. Gates (full vitest per DRIVING.md — the card change is code; types), commit,
   DONE.

(Previous text, kept:) **None for a builder — fix round 1 is DONE.** The orchestrator rules on "Fix round 1 — residual" (Open problems),
then re-verifies (verifier round 2) or marks B4 `WAITING-HASAN`; Hasan's step = the updated
`docs/studio/end-to-end/B4/HASAN-STEP.md` (~25–30 min, Snap off + zoom in).

(Fix round 1 brief, kept — DONE by builder #9:)
**FIX round 1 (orchestrator, 2026-10-22, after the verifier's FAIL — see Open problems "Verifier
round 1"):**
1. **HASAN-STEP.md (the FAIL):** before the trimming section, tell him to turn **Snap off first**
   (the magnet at the right end of the timeline toolbar — it is ON every time the editor opens,
   `TimelinePanel.tsx:95`) and to **zoom in to the highest levels** (+; at 20 px/s a 30–50 ms move is
   1 px, Snap swallows < 8 px) so 30–50 ms moves are visible and register; say what a trim that did
   not register looks like (the edge springs back) and how to check one took (the clip edge moved;
   optional: a tag appears on disk). Re-check every other instruction against the real UI.
2. **The head gate (DECIDED):** gate each knob on **|fitted − current| > 30 ms (> 1 dB for
   `margin`) with ≥ 10 touched edges on that side**, instead of the median offset from the style's
   own edges — the median is diluted by joins where the onset rule gives both styles the same
   lead-in (verifier: with ±40 ms seeded jitter the fit still read 0.14–0.16 while the median offset
   fell to 23–28 ms, so the head row vanished 5/5). Keep Q4's thresholds; the card keeps showing the
   medians AND the fitted values. Tests: the existing unit/handler tests stay green (own-style edges
   → no change; 9 joins → nothing); add a jitter test (seeded ±40 ms on fitted-tight edges over ≥ 20
   synthetic joins → head 0.15 ± 0.03 proposed in every seed) and run the same jitter on the
   station's real 33-join data in a scratch test (C: outputs), recording the per-seed results.
3. **Cheap, also do:** `PresetUpdateCard.tsx:85` "Knobs unchanged — the edit matched the preset"
   must not show above cut lines with changes; count physical joins once on the card when a join's
   head came from a proposal drag and its tail from a timeline trim (`cut-learn-joins.ts:96-123` +
   `clipLearnJoins`) — or say "edges" instead of "joins" if dedupe is not cheap.
4. Do NOT reset or launch on Hasan's station unless the fix changes what the station must hold (it
   should not — the station state is data, not code). Gates (full vitest per DRIVING.md, types),
   update Status.md B4 row + TESTING §18.10 with the fix, commit, return DONE.

(Previous text, kept:) None for a builder — B4 is DONE up to Hasan's step. The orchestrator marks B4 `WAITING-HASAN` and
moves on (a B4 verifier is the orchestrator's call; a verifier must NOT launch on, trim on or reset
Hasan's station — B1-verify-root + `profiles\B1-verify` — it is his). **Hasan's step:**
`docs/studio/end-to-end/B4/HASAN-STEP.md` (~20–25 min: run `hasan-station.ps1`, open `video-14-raw`,
trim about 21 of the 33 sentence joins by dragging edges, Inspector → PROJECT → "Learn from this
video", read the card: pass = `Cut lead-in` 0.12–0.18, `Cut tail min` 0.05–0.11, `Cut margin`
11–13). When he reports back: record his three numbers + "learned from N joins" in Status.md's B4
row and tick TESTING §18.10's first item; his trims stay in the station's `project.json` and can be
re-measured offline through the real handler (the `negatives.b4.test.ts` pattern) if needed.

## Open problems

- **Fix round 2 — findings (no ruling needed; for the orchestrator / a verifier):** (1) the timeline's join square
  ("Add transition", 12 px at mid-height, `TransitionJoins.tsx`) and the clips' top-corner fade dots sit ON the trim
  handles — a grab there does nothing to the edge; HASAN-STEP.md now says "lower half" (not a product fix — a
  follow-up could inset the square or raise the handles above it). (2) The 5th Zoom-in click (320 → 640 px/s) put the
  join at the viewport's right edge (x ≈ 1186 of ~1185 CSS px, window as launched) — the doc recommends 4 clicks and
  says to drag the scrollbar after a 5th. (3) Two lead-in grabs at the handle's upper part (y = top + 8) at 320 px/s did
  not trim and their target was not logged; the same point trimmed twice right after — unexplained; the total cue
  catches it. (4) The verifier's "Snap on + playhead on the join → −4.7 ms trim" was NOT re-created (row 8's playhead
  was 16 px off the moved join); the doc orders Snap off before the playhead as the brief asked. Still open from
  earlier rounds (not in any fix brief): `apply-cut-proposal.ts:174` tag drop, the clamped-speed end tag, the style
  edge at removed words.
- **Verifier round 2 — FAIL (2026-10-22), one deliverable:** HASAN-STEP.md:58-61's new "Check each
  trim took" gives the wrong signal for every lead-in trim (ripple keeps the edge at the join; the
  doc says that means "did not register — drag again", compounding changes). Secondary:
  HASAN-STEP.md:41-43 vs :46 (Snap on + playhead on the join → a 5 px drag commits a −4.7 ms trim
  that looks like a spring-back). Status.md / TESTING §18.10 lack rule (a) and keep stale median-gate
  text (Status.md :22, :33; TESTING :414) and the old trim-check wording; "20–25 min" in TESTING.
  Everything else PASSED: full vitest run 1 green (457 / 3866), types 26/10; Snap off → 30–50 ms
  real-mouse trims at 320/640 px/s register + tag; Snap/zoom/ripple/Learn button exactly where the
  doc says; no model call; station sha256 unchanged; rule (a) on the station's real 33 joins: 40/40
  (±20), 40/40 (±30), 39/40 (±40 — misses are minTail fitting 0.04); own-style false positives 0/40
  at ±20/±30, 5/40 at ±40 (minTail only); different targets 10/10; 9 joins → nothing; per-knob gate
  confirmed (8 lead-ins → head not proposed, tails proposed); stubs make it fail; card wording and
  one-join-once live. Still open (not in any fix brief): `apply-cut-proposal.ts:174` tag drop, the
  clamped-speed end tag, the style edge at removed words; the stats sentence shown twice without a
  summary model.

- **Fix round 1 — residual (for the orchestrator; not a Hasan question unless Q4 itself is reopened):** the brief's
  test "head 0.15 ± 0.03 proposed in EVERY seed" under ±40 ms jitter cannot hold with Q4's "> 30 ms" and this start:
  the station starts at head 0.11, 40 ms under 0.15, and the head grid is 10 ms (= the preset form's step), so a fit of
  0.14 is exactly 30 ms away (not proposed) and 0.13 is 20 ms. The fit itself is right every time (0.15 ± 0.03 in 40/40
  synthetic seeds, 0.13–0.16 on the station's real joins) — only the proposal drops: synthetic 32/40 proposed, station
  9/10 (33 joins) / 8/10 (21 joins) at ±40 ms, 10/10 at ±30 and ±20 ms. The unit test asserts what holds (fit in range
  every seed; proposed iff > 30 ms; 32/40) — NOT the brief's "every seed". Options (not taken — each changes a ruling
  or the station): (a) count a missing `Cut lead-in` row as a pass when the card's Lead-in line reads "head X s" with X
  in 0.12–0.18 (HASAN-STEP.md already tells Hasan to note X — the exit text says "proposes"); (b) start the station's
  head farther from 0.15 (e.g. 0.08: a reset of Hasan's station, ruling 7's start changes); (c) a 5 ms head grid —
  measured on the synthetic set: 35/40 instead of 32/40, and it would propose values off the form's 0.01 step. Also
  measured: gating on the fit lets one tail false positive through at ±40 ms on own edges (station seed 8: minTail
  0.14 → 0.10); ±20 ms → none.
  **RULED (orchestrator, 2026-10-22): option (a), for all three knobs.** The station keeps the old-tight start
  (ruling 7 — it is the real history). Hasan's step PASSES per knob when the row is proposed with its new value in
  range, OR the row is missing and the card's fitted value for that knob is in range (head 0.12–0.18, minTail
  0.05–0.11, margin 11–13); the record says which case it was. HASAN-STEP.md §4 updated by the orchestrator. A fit
  inside the range but ≤ 30 ms from the old value is Q4's threshold working as Hasan specified, and STATUS says so (a
  lower threshold is his call later). The one ±40 ms own-edge tail false positive is recorded, not fixed.
- **Verifier round 1 — FAIL (2026-10-22), one deliverable** (fixed in fix round 1, see Done): `HASAN-STEP.md:33-37` (Snap) — Snap is
  on at every editor open (`TimelinePanel.tsx:95` `useState(true)`, not persisted) and pulls an edge
  to any clip edge within 8 px (`snapping.ts:9`); the neighbour's edge sits where the trimmed edge
  started, so any trim < 8 px snaps back — no edit, no tag. At 20 px/s (default zoom,
  `timeline-view.ts:4-5`) 8 px = 400 ms; at 320 px/s 25 ms. Fitted-vs-old lead-in is +40 ms at almost
  every station join. Verifier live: 3–6 px drags silently did nothing; 10–12 px took. **Risk (head
  gate slack):** per-join gap 40 ms vs the 30 ms median-offset gate (`cut-learn.ts:62-65`); seeded
  jitter on fitted edges: ±20 ms → head proposed 5/5, ±30 ms 2/5, ±40 ms 0/5 (the fit still 0.14–0.16,
  median offset 0.023–0.028). Minor: a join with a proposal-dragged head + a trimmed tail counts as
  two "joins" (`cut-learn-joins.ts:96-123` + `clipLearnJoins`; live "4 joins" for 3);
  `apply-cut-proposal.ts:174` overwrites `origin` and drops tags on edges a later cut does not
  rewrite (loses signal, never invents it); a speed change clamped by the next clip moves the end
  edge and keeps its tag (`clip-update-ops.ts:128`); `PresetUpdateCard.tsx:85` "Knobs unchanged —
  the edit matched the preset" shows above cut lines with large differences; the measurement's
  "style edge" ignores the planner's clamp at removed words (`cut-learn-measure.ts:105-108`) — noise
  the fit absorbs. Everything else PASSED: gates first try (456 / 3852), the diff review, 10/10
  own controls on real M2 data incl. a DIFFERENT target (0.22 / 0.12 / 8 → head 0.22, margin 8;
  0.20 / 0.22 / 9 → exactly that), own-style → 0 changes, 9 joins → nothing, text-delete only → no
  samples, maxTail never lowered, the proposal-drag path → 0.15 / 0.08 / 12, a stubbed fit fails
  control (a); live `snapped` / tags / undo / the card at 200 px; the station on disk and
  `hasan-station.ps1` correct.

**RULED (orchestrator, 2026-10-22, after builder #5 — for step 6, Hasan's station):**
- **His timeline = his own hand plan, not Auto Cut.** The 21 joins he trimmed on 10-15 were
  sentence joins of preview-tight (his `cuts.json` keeps, retakes already out). Build the station's
  Act-1 timeline (the raw span behind preview-tight 0:00–1:55, clips 0369…0371 as in
  `act1-joins.json`) from `cuts.json`'s keeps planned through Studio's planner with the START
  preset (old tight over base tight) — B3's hand-plan harness does this — written into the
  station project's `project.json` as clips (no proposal needed: the learner reads trimmed clip
  edges). Record how many sentence joins it contains.
- **Ripple on** in the station (the setting or the state the trim reads), so lengthening a lead-in
  is not stopped by the neighbour clip; HASAN-STEP.md says so.
- **The start preset carries only `style.cut`** (old tight) and as few flat knobs as possible, so
  the card does not show unrelated flat-knob changes; if the flat learner still proposes some,
  HASAN-STEP.md says "ignore the non-cut lines — they come from the scratch preset".
- **Trigger = the Inspector → Project → "Learn from this video" BUTTON** (no assistant chat): the
  station's project uses a provider id that is not registered (as `b4-no-model`), so no model call
  happens; the card reads "(numbers only — no summary model was available)". HASAN-STEP.md names
  the button and says not to use the Assistant chat in this project.
- Step 5 (e) negatives first, then the station, then the gates (full vitest per DRIVING.md, types),
  a short live click-through of the station (open it, see the timeline + the readout, do ONE trim,
  undo it), STATUS + TESTING §18.10, DONE.

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

Step 3 objections (built this way; the orchestrator to rule; none needs Hasan; 7 matters for
step 5 and Hasan's station):

7. **A project override makes accept a near no-op for the preset.** The card is measured against
   the RESOLVED style (right: that is what the joins were snapped with, and the Q4 gate needs it),
   but accept writes the PRESET, the way the preset form writes a knob (`withPresetCutKnob`: a
   value equal to the base's drops the override). With ruled 6's start (old tight as a PROJECT
   override over a base-tight preset), the card proposes head 0.11→0.15, minTail 0.14→0.08,
   margin 5→12 (the exit is met: "the card proposes"), but accepting changes nothing on the
   preset except `maxTail 0.5` (the other three already equal base tight), and the project keeps
   its override (the card says so). **Recommendation:** for the stand-in AND Hasan's station put
   the old tight on the station project's PRESET (a scratch user preset in that isolated profile's
   library, `cut: { base:'tight', head:0.11, minTail:0.14, maxTail:0.4, margin:5 }`, no project
   override) — same starting geometry (softGap 99), and accept then visibly moves the preset back
   to the fitted tight (the preset-tools test does exactly this). Without a ruling, step 5 follows
   ruled 6 as written.
8. **Accept takes every change on the card, `maxTail` included.** From the old tight the fit
   returns `maxTail 0.5` ("at least 0.5 s" — the cap nearest the current 0.4 that reproduces every
   tail), so accepting writes a lower cap than the fitted tight's 0.7. Not in the exit; the card
   says "at least". A per-knob opt-out on the card would be new UI — not built.

**RULED (orchestrator, 2026-10-22 18:05):**
- **7 — accepted (supersedes ruling 6's "project override" for BOTH the stand-in and Hasan's
  station):** the start style lives on the station project's PRESET — a scratch user preset in that
  isolated profile (e.g. "B4 start — old tight": `style.cut = {base:'tight', head:0.11,
  minTail:0.14, maxTail:0.4, margin:5}`), assigned to the project, NO `settings.cutStyle`. Accept
  must then visibly move that preset to the fitted tight (head 0.15 / minTail 0.08 / margin 12 —
  the base values, so the overrides drop); record the preset.json before/after.
- **8 — accepted as built:** `maxTail` is a lower bound — it is only ever RAISED (to the longest
  tail the user kept), never lowered below the current cap; the card says "at least N s". Add a
  unit test that a user whose tails are all shorter than the current cap gets no `maxTail`
  change. No per-knob opt-out (follow-up).

Step 4 notes (no ruling needed; for step 5 and Hasan's step):

- **The deterministic path exists:** Inspector → Project → "Learn from this video"
  (`PresetLearnSection.tsx`, IPC `preset-learn-handlers.ts:42` → `learnFromProject`) computes every
  number in code and puts the same card in the Assistant tab — HASAN-STEP.md should name it (or
  "ask the assistant: learn from this video"). Its one-sentence `summary` IS a model call
  (`learn-from-project.ts:50`, the project's agent provider) unless `summary` is passed (the tool
  path's argument); on failure the card says "numbers only". Fine for Hasan; for OUR stand-in it
  means the button may only be clicked with a provider that cannot reach a model (step 5 (c)).
- The card's per-join rows name the asset by file name only when `AgentPanel` gets `assets`
  (EditorShell passes them); anywhere else they fall back to the first 8 chars of the asset id.

Step 5 notes (no ruling needed; for step 6, Hasan's station):

- **Retakes are still in after Auto Cut.** Studio's Auto Cut is pause-only; preview-tight (where
  Hasan trimmed his 21) had the retakes removed by `cuts.json`. On a station made with Auto Cut
  alone his Act-1 span holds 47 joins, 28 of them sentence joins. Before writing HASAN-STEP.md,
  check B3's "hand plan" (B3 HANDOFF / TESTING §18.9: a cut plan built from `cuts.json` keeps on
  eight clips) — if it can be applied on the station as the old-tight-snapped starting proposal,
  his timeline matches preview-tight's joins; else HASAN-STEP.md must tell him which joins to
  skip (into / out of a retake) and the stand-in's 21 (`act1-joins.json`) are the list.
- **Ripple:** the stand-in trims used `rippleAllTracks: true`. Without ripple, lengthening a lead-in
  clamps at the left neighbour's end (`trimClip`, `timeline-ops.ts:225-239`) unless the tail was
  shortened first by at least as much. HASAN-STEP.md: turn the ripple toggle on (timeline toolbar)
  or trim the tail before the head.
- **Flat knobs on the card:** a station preset copied from youtube-long-form makes the card also
  propose eight flat knob changes (see step 5 (d)). For a cleaner card, seed the station preset's
  flat style with the values the stand-in card proposed (pacing tight, shots 0, SFX 0, music none,
  captions none, transitions [], intro 0, outro 0) — `setup.mjs` would need that option.
- **No model on the station:** `setup.mjs` sets `settings.agent.providerId = 'b4-no-model'` — fine
  for the button path ("numbers only" summary). If HASAN-STEP.md tells him to "ask the assistant",
  that id breaks the chat: name the button path (Inspector → Project → "Learn from this video")
  and leave the station on the no-model id, or clear it in setup for his station.

Step 6 notes (no ruling needed; for step 7's STATUS row):

- **The station's Act 1 holds 33 joins, not 21.** His hand plan (`cuts.json` keeps, retakes out)
  under the old tight gives 36 clips over 1:46.8 — the planner also splits a keep at internal pauses
  (≥ `internalGap` 0.4 s), so some joins are mid-sentence ("Simply, | uh", "locally | on", "both |
  My", "Code | or", "focus | on"). HASAN-STEP.md lists all 33 and says "about 21": joins he leaves
  alone teach nothing. The dry run proves the station can reach the pass if he lands the fitted
  tight's edges; his own ears decide the real numbers.
- **The Inspector's AI Assistant "Provider" dropdown shows "App default (active provider)"** for the
  unregistered `b4-no-model` id (display only — the probe still fails locally). Re-picking a provider
  there would make the learn button's summary a real model call; HASAN-STEP.md says not to touch it.

## Do-not-redo

- B1, B2, B3 are DONE — do not re-port the snapper, change the resolver/precedence, or the QA
  checks. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY.
- Step 1 is DONE: the schema fields and the four `src/shared/studio/cut-learn*.ts` modules + their
  17 tests — extend them, do not rewrite them (unless the stand-in on M2 disproves the fit; then
  record the numbers first).
- Step 2 is DONE (`c5a6f4c`): edge tags on trim / text-delete, tag drops in split / span cut /
  restore, `snapped` on first drag and at creation, 12 reducer-level tests. Do not re-wire them.
- Step 3 is DONE (`2865675`): `StudioPresetKnobKey` widened, `learnProjectCutKnobs`,
  `cut-learn-format.ts`, `preset-knob-apply.ts` (applyKnobChanges moved there), accept through it
  with B2's check, the tool-result line, the shared fixtures, 8 tests. Do not re-wire the main
  learn path; the card UI only reads `cutLines` / `cutLearn`.
- Step 4 is DONE: `CutLearnBlock.tsx` + its place on `PresetUpdateCard` + the `assets` →
  `assetNames` plumbing (EditorShell → AgentPanel → card); ruling 8's guard in `fitTails` + its
  test. Change the card only if the live click-through shows a real defect.
- Step 5 (a)–(d) is DONE live on M2 (B2-root + B2 profile, CDP 9301): start preset, Auto Cut +
  apply, 21 joins trimmed through the reducer, the button learn with no model, accept, before/after
  preset.json, stills, the card's stacked-row fix. Do not redo them. The scratch preset in the B2
  profile is now `{base:'tight', maxTail:0.5}` (accepted); re-run `setup.mjs` only if a later step
  needs the live start state again (it rewrites the preset and empties the timeline).
- Step 5 (e) is DONE (no `src/` change): `negatives.b4.test.ts` on the M2 data through the real
  handler — (1) as trimmed = the live card, (2) own-style edges → 0 cut changes at 21 joins,
  (3) 9 joins → 0 + the "at least 10" line. Re-run it (3 s) only if `src/shared/studio/cut-learn*`
  or the learn path changes.
- Step 6 is DONE: Hasan's station (B1-verify-root + B1-verify profile) is at its START state
  (36 untagged clips, 33 joins, preset "B4 start — old tight", no proposals, provider `b4-no-model`),
  click-checked through `hasan-station.ps1 -CdpPort 9311` and reset with `-Reset`. Do not launch on
  it, trim on it or re-run `station.b4.test.ts` (that IS the reset) unless the station must change —
  it is Hasan's now. The backup `…\B4\backup\B1-verify-root-project.before-b4.json` is the only copy
  of the station as B1's verifier left it — never overwrite it.
- Step 7 is DONE: the counted full vitest (run 2, `--exclude python-models --maxWorkers=4`) and types
  26/10; the Status.md B4 row, TESTING §18.10 and the B3 doc debt (decision 7) are written. Re-run the
  gates only if `src/` changes.
- Fix round 1 is DONE: the per-knob gate on |fitted − current|, the join merge, the card / PRESET.md wording, the 3
  new tests, HASAN-STEP.md Snap + zoom, `jitter.b4.test.ts` + its two JSONs, gates (457 / 3866, 26/10), Status.md +
  TESTING §18.10. Do not re-run the old-gate comparison (it swaps `cut-learn.ts` in the working tree). The station was
  NOT touched (no launch, no reset).
- Fix round 2 is DONE: HASAN-STEP.md §2 routine (Snap first, 4× zoom, total as the sign, lower-half grab), the card's
  stats-once condition, Status.md / TESTING §18.10 rule (a) + gate wording, the live real-mouse drag table on B2-root
  (`fix2-drag.mjs`, `fix2-drags.json`, stills `b4-fix2-*.png`), gates (457 / 3866 first run, 26/10). B2-root's
  `video-14-raw` now holds the station's 36 clips with the rows' trims (0369_02 end +20 ms net, 0369_03 start tagged
  at its original second) — scratch; `fix2-prep.mjs` re-lays the start clips. The station was only READ.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~37 calls · step 1: schema + pure join collector / measurement / fit /
  report with 17 unit tests; types 26/10; no app launch.
- 2026-10-22 · builder #2 · ~42 calls · step 2: the signal wired (reducer tags, tag drops,
  `snapped` on drag + creators), 12 tests; subset vitest green; types 26/10; no app launch.
- 2026-10-22 · builder #3 · ~40 calls · step 3: the learn path in main (knob key widened,
  learnProjectCutKnobs, card lines, accept writes `style.cut` with B2's check), 8 tests through the
  real tool + accept handlers; subset vitest green; types 26/10; no app launch.
- 2026-10-22 · builder #4 · ~30 calls · step 4: the card's cut block + collapsed per-join list
  (`CutLearnBlock.tsx`), asset names plumbed from EditorShell; ruling 8 (`maxTail` never fitted
  below the cap) + a test that fails without it; subset vitest green bar the known load timeout
  (passes alone); types 26/10; no app launch.
- 2026-10-22 · builder #5 · ~55 calls · step 5 (a)–(d) live on M2: start preset (old tight on
  the preset, no-model provider id), Auto Cut + apply on 0369–0371, Act 1 mapped through
  `cuts.json`, 21 sentence joins trimmed through the reducer to the fitted-tight edges (39 edges),
  the button learn → head 0.15 / minTail 0.08 / margin 12 (Δ 0), maxTail "at least 0.5"; accept →
  `{base:'tight', maxTail:0.5}`; fixed the per-join list overflowing the Assistant column; types
  26/10; app stopped.
- 2026-10-22 · builder #6 · ~17 calls · step 5 (e): the two negatives on the M2 data through the
  real `propose_preset_update` handler (real v3 waveforms + transcripts, no model) — as trimmed =
  the live card's four changes; own-style edges → 0 cut changes at 21 joins; 9 joins → 0 + the
  "at least 10" line; read the station's start facts for step 6; no app launch, no `src/` change.
- 2026-10-22 · builder #7 · ~36 calls · step 6: Hasan's station — `station.b4.test.ts` (backup, start
  preset with zeroed flat knobs, V1 = his `cuts.json` keeps planned with the old tight: 36 clips / 33
  joins; in-memory dry run through the real reducer + handler → 0.15 / 0.08 / 12, no flat rows),
  `hasan-station.ps1` (+ `-Reset`, `-CdpPort`), HASAN-STEP.md; click-checked live on CDP 9311 (open,
  readout, no-model probe, one trim tagged + undone), app stopped (0 left), station reset; no `src/`
  change.
- 2026-10-22 · builder #8 · ~35 calls · step 7: gates — full vitest run 1 red only on the two known-load
  files (both green alone), run 2 green and counted (456 files / 3852 tests, python-models excluded for
  disk, 4 workers under 100 % CPU); types 26/10; Status.md B4 row, TESTING §18.10 (Hasan's step
  unchecked), decision 7 (B3 doc debt) from the B3 verifier's files; station re-read on disk at its
  start state; no app launch, no `src/` change.
- 2026-10-22 · builder #9 · ~50 calls · fix round 1: HASAN-STEP.md Snap off + zoom + "did it take"; the gate moved to
  |fitted − current| per knob (station ±40 ms jitter: head proposed 2/10 → 9/10); card / PRESET.md "unchanged"
  wording; drag + trim at one join = one join; 3 new tests (the jitter one fails on the old gate); full vitest run 2
  green (457 / 3866), types 26/10; residual (0.13 / 0.14 fits not proposed from 0.11) left to the orchestrator; no app
  launch, station untouched.
- 2026-10-22 · builder #10 · ~55 calls · fix round 2: HASAN-STEP.md §2 rewritten (Snap off first; per-join routine;
  the toolbar total as the sign for both edges — lead-in edges come back to the join; grab the lower half — the "Add
  transition" square and fade dots sit on the handles, found live); card stats sentence once; Status.md / TESTING
  §18.10 rule (a) + per-knob gate + verifier round 2's jitter numbers; live real-mouse drags on B2-root (CDP 9301):
  lead-in ±41 ms at 320 and 640 px/s, tail +50 / −30 ms at 640, a failed Snap-on trim — each read by the total, disk
  and tag; full vitest 457 / 3866 first run, types 26/10; station only read.
