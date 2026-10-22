# B4 — The learning signal: snapped span beside the final span; user trims and text deletes tagged; learn-from-video measures the joins and proposes the cut knobs
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read the four files named in "Learning today" + `proposal-ops.ts` + the clip trim reducer path,
then add the optional schema (decision 1) and the pure measurement module (decision 2) with unit
tests (touched-join detection from snapped vs final, lead-in / tail / tail-level, medians, the
30 ms / 1 dB / ≥ 10 thresholds, the per-join list) — then hand off before wiring the tags into the
reducers and the learn path.

## Open problems

(none yet)

## Do-not-redo

- B1, B2, B3 are DONE — do not re-port the snapper, change the resolver/precedence, or the QA
  checks. Track A is DONE. Do not touch `main`. The editor repo is READ-ONLY.

## Agents so far (date · approx tool calls · what they covered)

(none yet)
