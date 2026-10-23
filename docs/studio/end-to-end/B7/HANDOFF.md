# B7 — Editorial cuts leave no hard entries
status: BUILDING (step 1 done; step 2 fix WRITTEN, NOT YET RUN — C: under 1.0 GB, uncommitted)

> **Disk override (orchestrator, 2026-10-23) still in force:** C: had 0.25–0.32 GB free all through
> builder #4 (checked 4×). Until C: ≥ 5 GB: code + targeted unit tests only; check `Get-PSDrive C`
> before each test command and stop/hand off under 1.0 GB. Builder #4 ran NO test (C: < 1.0 GB).

## Goal (the row — added 2026-10-23 by Hasan's session-3 instruction — + the exit)

**Row:** the produced cut of the assistant's real pass leaves no hard entries. Scope = the
mechanisms the track-B exit found (`docs/studio/end-to-end/ORCHESTRATOR.md` "TRACK B EXIT"):

1. **The 1.0 s silent-sliver merge** — `MERGE_SILENT_KEEP_MAX = 1.0`
   (`src/shared/studio/cut-snap.ts:66`, used at `:138`). An editorial removal's wordless gap is
   merged away only up to 1.0 s; a longer gap keeps the removed word's release, and Auto Cut
   (planned later over the whole clip) removes only the quiet middle and leaves the release as a
   blip. Four of the six hard entries are such WORDLESS slivers (0.15–0.5 s); 15 wordless segments
   exist in the produced cut (0.06–0.5 s), all inside spans Hasan cut.
2. **Editorial cut-ins on leftover sound** — a cut-in landing in a removed word's release, or the
   head pad landing on leftover sound (0373 204.069: the 0.15 s head pad before "so").
3. **The planner's cut clamp slicing an onset** — 0375 122.7: the model's retake span ends 34 ms
   before "And" and the clamp keeps that end, slicing the onset.
4. **Auto Cut planning over spans the editorial pass already removed** — in B6, 199.5 s of Auto
   Cut's 587.1 s fell inside already-applied editorial spans (94 of 261 items wholly), and its card
   headlines over-count (0373 "−171.2 s of 396.3 s", 85.6 s of it already cut).
5. **Whether the assistant may apply a card its own QA flags** — all six hard entries were flagged by
   the card's own QA (B3) before Apply, within 0.5 dB, and were applied anyway.

**Exit:** the real assistant pass — `Cut this video.` on all nine M2 clips, the app's keyless
Claude subscription provider, ONE pass, run shape as B6 — gives:
- **0 hard entries** on the applied cut (real joins, measured as the track-B exit measured them);
- **content overlap ≥ 90.5 %** (|P∩H| / |H| vs Hasan's `cuts.json`, measured as B6 — no regression);
- **median lead-in / tail at joins within ±30 ms of the fitted tight** (as the track-B exit).

## Plan context

- Plan §0 E2 ("hard entries 0; median lead-in / tail within ±30 ms of the fitted tight"), §1.1 (the
  cut facts), T1 (the cut decision: one resolver `resolveCutStyle` for all four consumers — Auto
  Cut button, `run_auto_cut`, the editorial snap, Transcript deletes). Read the plan's §3 Track B
  rows and the ORCHESTRATOR sections "From B3", "From B6", "TRACK B EXIT".
- Code entry points (verify, don't trust): `src/shared/studio/cut-snap.ts` (merge, snap),
  `src/shared/studio/cut-planner.ts` (`planClip` :130, `planCuts` :224, the clamp),
  `src/main/services/studio/editorial-cuts.ts` (`snapEditorialCuts` :38), the `run_auto_cut` /
  `propose_cuts` handlers and the B3 card QA (`analyze` readouts on the cards), the agent prompt
  workflow (`studio-agent-prompt-tools.ts:64-67` puts `run_auto_cut` first; B6's assistant ran the
  editorial pass first anyway).
- Hasan's own reference: `D:\repos\claude-youtube-editor\videos\video-14\work\analysis\cuts.json`,
  `tools/cutlib.py`, `tools/analyze_cut.py` (`entry_check`) — READ-ONLY; run Python `-I -B`.

## Orchestrator decisions (DECIDED — follow them; objections go under Open problems)

1. **Item 5 (QA-flagged items):** a hard entry the card's QA can see must not reach the timeline
   silently. The pass first FIXES what it can before the card is shown (re-snap the join so the
   cut-in lands on quiet before the onset / the merge takes the wordless sliver). An item still
   flagged after that stays on the card but is **unchecked by default** (like fluff today), with its
   reason on the row, and the assistant's reply names it. Apply then takes only clean items unless
   the user checks one. Find first how a card reaches Apply (the user's click; any auto-apply path)
   and apply the same rule there.
2. **Item 4:** Auto Cut plans over what is ON the timeline, not the whole source — spans an applied
   cut already removed are not proposed again and do not count in the card's headline. Same rule for
   `run_auto_cut` and the button (one code path).
3. Fix the mechanism, not the measurement: every change is in the shared planner / snap / editorial
   code that all consumers use (T1's one-resolver rule); unit tests first, each red before the fix,
   built from the six real cases (clip, time, words — in "TRACK B EXIT") as fixtures.
4. **No regression elsewhere:** B1's ±20 ms cutlib reproduction (348/352 joins), B3's live Auto Cut
   numbers (hard 1/164 on all nine clips at tight — the 0373 @ 323.198 true positive may stay), and
   B2's per-style edges must still hold — re-run their tests / kits and say so.
5. **The live exit run** = B6's run shape, ONE pass, on a FRESH scratch copy: copy the shared M2
   (`C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root`, never modify it) to
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7-root` and a profile from `…\profiles\source\profile`
   to `…\profiles\B7\profile` (check C: ≥ 5 GB first). Kit: copy `.vidtsx-temp/end-to-end/B6/`
   (`run.mjs`, `measure.py`, `launch.sh` — strips every `CLAUDE*` / `ANTHROPIC*` env var, `cdp.mjs`,
   `probe.mjs`) to `.vidtsx-temp/end-to-end/B7/` and re-point it. Provider = the profile's default
   keyless `claude-subscription` (no saved providers → `llm-init.ts` registers it; B6 HANDOFF
   "How the assistant's provider is chosen"). Type exactly `Cut this video.`; answer every card with
   a real click (Apply = the accepted items; "Reject all" when 0 are accepted); if the assistant
   offers Auto Cut instead of running it, answer exactly as B6 did: `Yes, run Auto Cut for the pauses
   on all nine clips.` Capture every card from `project.json` BEFORE answering it. Budget: one pass
   (a second only if the first is broken by the harness, not by the result — say so).
6. **Measure** with copies of `C:\Users\hasan\AppData\Local\vidtsx-e2e\track-B-exit\exit_check.py`
   (hard entries = analyze_cut `entry_check` on real joins, `REAL_JOIN 0.75`; lead-in / tail medians)
   and B6's `measure.py` (overlap), re-pointed at B7's project + capture, outputs in
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\`. Report per-join detail for any hard entry left.
7. Hasan's hands are NOT available (he defers hands-on checks to a real-video test later): nothing in
   B7 may wait on him. If a decision is truly his, write it under Open problems and return BLOCKED.

## Done (file:line, commit hashes)

### Step 1 — where the five mechanisms live, and how each of the six arises (builder #3, 2026-10-23, commit `31feae2`)

The authored spans are in B6's turn log (`C:\Users\hasan\AppData\Local\vidtsx-e2e\B6\run\turns.jsonl`,
each `propose_cuts` call's `args`; snapped cards in `…\B6\run\proposals-raw.json`). The model authors
spans at the transcript's segment bounds and leaves the pauses between them alone (its prompt says
silence is Auto Cut's job). Tight knobs (`resources/skills/studio-clean-cut/cut-style.json`): head 0.15,
maxHead 0.3, minTail 0.08, maxTail 0.7, margin 12, softGap 99, softMaxTail 0.6, softMargin 6, minSkip 0.12.

1. **Wordless merge cap** — `src/shared/studio/cut-snap.ts:66` (`MERGE_SILENT_KEEP_MAX = 1.0`), used at
   `:138`. A wordless keep between two cuts survives when > 1.0 s; `planClip` (`cut-planner.ts:71-74`)
   keeps a wordless keep WHOLE as one atom, its start clamped to the cut's end (`:164`), so it begins on
   the removed word's release. Auto Cut (whole clip) then removes its middle, leaving both ends.
   - **0366 4.83** (+28.9): authored `2.28–4.83` retake ("…applications." ends 4.834) and `5.89–12.63`
     retake; the 1.06 s gap has no words → kept → produced slivers 4.83–5.074 (the release) + 5.745–5.89.
   - **0366 12.63** (+23.7): authored `5.89–12.63` and `14.34–…` ("Other take." cue); 1.71 s wordless gap →
     slivers 12.63–12.775 + 14.194–14.34.
   - **0373 247.86** (+36.1): editorial `243.716–247.86` false start ("this—" ends 247.860) and the next span
     at 249.35; 1.49 s wordless gap → slivers 247.86–248.36 + 249.205–249.35.
2. **Cut-in on leftover sound** — the lead-in clamp `cut-planner.ts:164` (`segStart = cut.end` when the
   cut ends inside the lead-in) and `snapHead` (`:147-159`, maxHead 0.3) treat the AUTHORED end as the end
   of the removed sound. Nothing measures where the removed word's release actually stops.
   - **0373 204.069** (+15.9): removed "So that's—" (ends 203.809), kept "so" 204.219; the cut-in is the
     plain head pad 204.219 − 0.15 = 204.069, which lands in sound that never decays between the two words
     (+14–17 dB across 203.97–204.09). Hasan's hand: 204.209 (10 ms before "so").
   - **0373 391.59** (+22.0): removed `356.718–391.59` retake (its last word "on." ends 391.588); the
     editorial cut-in sits ON the authored end — the head walk-back ran into "on."'s release and the clamp
     stopped it there. Auto Cut (whole clip) kept "on."'s tail to 391.768 → produced sliver 391.59–391.768.
     Hasan: 391.788.
3. **Clamp slicing an onset** — same clamp, `cut-planner.ts:164`. **0375 122.7** (+37.2): authored retake
   `103.095–122.7`, last removed word "take." ends 121.883, kept "And" at 122.734 by the transcript but the
   real onset is ~122.62 (20 ms buckets: +0.4 dB at 122.60, +34.2 at 122.62). The head pad wants 122.584
   (= Hasan's plan segment start) and the clamp moves it to the authored 122.7 → onset sliced.
   The clamp itself must stay (B1's cutlib reproduction relies on it for Hasan's own cuts, e.g. 204.209);
   the fix belongs in the editorial snap (`cut-snap.ts`), on the authored edges, before `planClip`.
4. **Auto Cut over the whole source** — `src/main/services/studio/cut-plan-runner.ts:81-110`
   (`planCuts` with no `keeps`, QA keeps `[0, duration]`), called by the IPC `studio-handlers.ts:481`
   (the button, `src/features/studio/hooks/useAutoCut.ts:71` builds the card) and `run_auto_cut`
   (`agent-tools/workflow-tools.ts:150-157`). `buildCutProposal` (`src/shared/studio/cut-proposal.ts:69-121`)
   inverts the segments over `[0, sourceDuration]` and the headline is `−removed of sourceDuration`
   (`:103-110`), so already-cut spans come back as items and in the headline. `planCuts` already takes
   `keeps`/`cuts` (`cut-planner.ts:215-229`); what's missing is the timeline's keeps reaching it, and
   `buildCutProposal` proposing only inside the keeps.
5. **QA-flagged items reach Apply** — the snapped card's QA is computed (`cut-snap.ts:208`), stored on the
   proposal (`editorial-cuts.ts:96`) and shown (`CutQaReadout.tsx`), but item status is by category only
   (`editorial-cuts.ts:65`: all accepted except fluff; Auto Cut `cut-proposal.ts:91`: all accepted). Both
   Apply paths take `status === 'accepted'` items only (`src/features/studio/services/apply-cut-proposal.ts:38`):
   the user's click (`EditorShell.tsx:621`) and the agent's `accept_proposal` (`delivery-tools.ts:68`,
   applied renderer-side `EditorShell.tsx:544`). So "unchecked by default" = status `rejected` at build
   time covers both paths.

Corrections found on the way (facts, not guesses):
- **0373 391.59 is NOT between two applied cuts**: the next editorial span is `393.36–394.6` **fluff**
  ("Okay,", status `rejected`), so the wordless keep `391.59–393.36` sits between an accepted retake and an
  unchecked fluff. An uncapped wordless merge would swallow the fluff into the accepted retake (dominant
  category) and cut "Okay," by default — the merge must not cross a status boundary. This case needs the
  cut-in rule (mechanism 2), not the merge.
- B6's `turns.jsonl` cuts each tool call's `args` at 600 chars, so the authored spans are only partly
  recoverable; the fixtures use the snapped editorial items from `proposals-raw.json` as the spans (for every
  one of the six the snapped edge at the join equals the authored edge or the plain head pad — re-snapping
  reproduces the produced join, see Verified).

### Step 1b — the failing tests (uncommitted on purpose: red by design; commit them WITH the fix)

- Fixture `src/shared/studio/cut-snap-b7.fixture.json` (21.5 KB, committed): per clip assetId, 50 buckets/s,
  bucket count, measured floor (0366 −52.75, 0373 −53.11, 0375 −53.43 dBFS); per case the real `rmsDb` + `zcr`
  buckets of a 3–8 s window, the real transcript words in it, and the editorial spans. Made by
  `.vidtsx-temp/end-to-end/B7/extract-b7.mjs <out.json>` (read-only over `b-root` + `…\B6\run\`).
- Test `src/main/services/studio/editorial-cuts-b7.test.ts` (**untracked — red**): pads each clip at its floor
  (sanity test), snaps the spans with `snapEditorialCuts` + `buildEditorialProposal` at `TEST_TIGHT_STYLE`, then
  simulates the produced cut = the card applied by default + Auto Cut over the remaining keeps (`planCuts` with
  `keeps` + `cuts` — decision 2's shape). Per case: no hard entry within 1 s of the join on (a) the card's QA,
  (b) the produced cut; (c) no wordless produced segment near it; mechanism 1: the 0366 4.83–5.89, 12.63–14.34
  and 0373 247.86–249.35 gaps sit inside one item; 0373 391.59's fluff stays its own `rejected` item.

### Step 2 — the fix for mechanisms 1–3 (builder #4, 2026-10-23, WRITTEN, NOT RUN, NOT COMMITTED)

Working tree (all uncommitted): `M src/shared/studio/cut-snap.ts`, `M src/main/services/studio/editorial-cuts.ts`,
`?? src/shared/studio/cut-snap-landing.ts` (new), `?? src/main/services/studio/editorial-cuts-b7.test.ts` (builder #3's
red test, edited). Commit all four together once the run below is green.

- **(a) merge key** — `cut-snap.ts`: new optional `mergeKey?: (category: C) => string` on `SnapCutSpansInput` (:51-58, field :58).
  Step 2 (:154-181): a wordless gap merges when ≤ `MERGE_SILENT_KEEP_MAX` (today) OR when both sides' dominant
  categories share a key AND `loudSeconds(gap) ≤ LOUD_GAP_MAX_S = 1.0` (the orchestrator's guard: seconds above
  floor + `QA_HARD_ENTRY_DB` (15 dB), 20 ms steps — `loudSeconds` :115-125, `LOUD_GAP_MAX_S` :80). `editorial-cuts.ts:37-48` (key :41, wrapper :46-48):
  `snapEditorialCuts` passes `editorialMergeKey` (`fluff` → 'fluff', else 'cut'); a caller's own key wins.
  Text-delete (`text-delete.ts:161`) passes no key → today's ≤ 1.0 s rule unchanged there.
- **(b) cut-in landing** — new `src/shared/studio/cut-snap-landing.ts` `landCutEnd` (the 300-line rule forced the
  split; cut-snap.ts is 271 lines), called from new step 2b in `cut-snap.ts:187-209` on every merged span, after
  the merge, before the keeps. Rule: `a` = last removed word's end, `kept` = next word if it starts before the next
  cut; `lo = min(a + snapTail(a, minTail, softMaxTail, softMargin, fricZcr, fricMargin) + QA_ENTRY_LOOKBACK_S (0.06),
  cap)` with `cap = min(kept.start − 0.01, nextCutStart − MIN_CUT_SPAN)` (or `nextCutStart − MIN_CUT_SPAN` with no
  kept word); `hi = kept.start − (planClip's own lead-in: head, roomier on the first atom, ≥ snapHead when maxHead)`;
  **end = max(lo, min(end, hi))** — pushed forward only out of the release, pulled back only out of the lead-in; an
  end already between the two is left alone (so an end the author put over untranscribed sound is not pulled back).
  No-op when the span removes no word, ends mid-word, or `cap ≤ a`. A note "N cut ends moved off …" joins `notes`.
  The +0.06 = the QA entry lookback, so the cut-in's QA window reads exactly the window snapTail found decayed.
- **The cut-OUT mirror** (open problem below) is NOT fixed: it needs `tailFor`'s gap-dependent tail (not the same
  few lines); none of the six needs it. Left listed.
- **Test edits** (`editorial-cuts-b7.test.ts`, now 226 lines): (1) **the style is now the SHIPPED tight**
  (`resources/skills/studio-clean-cut/cut-style.json` `.styles.tight`, read like the fixture) instead of
  `TEST_TIGHT_STYLE` — builder #3's test used the test fixture style (head 0.11, no maxHead/fricZcr/minSkip), which
  is not what B6 planned with; every number in step 1 (204.069 = 204.219 − 0.15, 122.584) is the shipped knobs.
  Still red before the fix by the probe below (hard @ authored ends 29.1 / 24.2 / 15.9 / 36.0 / 21.9 / 37.1 dB).
  (2) new `describe('B7 guards …')`, three synthetic tests: 0.5 s of loud sound in a 3 s wordless gap → merged;
  **1.5 s of loud non-speech sound → NOT merged (the orchestrator's guard)**; an end placed past the release over
  untranscribed sound is not pulled back.
- **Expected by hand** (probe numbers, shipped tight, NOT a test run): 0366 4.83 / 12.63 and 0373 247.86 gaps hold
  0.26 / 0.26 / 0.44 s over +15 dB → merged; 0373 204.069 → end 204.209 (lo capped at "so" − 0.01; hard window
  +11.1 dB; Hasan's hand 204.209); 0373 391.59 → end 391.988 (+5.1 dB), fluff (key differs, gap 1.77 s) stays its own
  `rejected` item; 0375 122.7 → end 122.584 (= hi, +0.8 dB; Hasan's plan segment start). Existing tests checked by
  hand: `editorial-cuts.test.ts` (all assertions are ranges/counts; edges unchanged or inside them),
  `cut-tools.test.ts:107` (cut end 2.4 → 2.49, still the hard entry at `cut.sourceEnd`, +40 dB), text-delete /
  text-restore (assert surviving words and self-consistent sums; the end only moves inside the wordless gap).
- Analysis kit: `.vidtsx-temp/end-to-end/B7/probe-b7.mjs <fixture.json>` (prints only; replicates rms-envelope.ts
  with the shipped tight knobs: per case the release tails, head pads, hard-window dB at candidate cut-ins, 20 ms
  profile, loud seconds per gap).

## Verified (exact commands + outputs)

- 2026-10-23 · builder #4 · `node .vidtsx-temp/end-to-end/B7/probe-b7.mjs src/shared/studio/cut-snap-b7.fixture.json`
  (analysis, prints only) → the numbers quoted in step 2. **No vitest / check:types run by builder #4** —
  `Get-PSDrive C` read 0.32, 0.31, 0.25 GB free before each would-be test command (< 1.0 GB → stop, per the override).

- 2026-10-23 · `npx vitest run src/main/services/studio/editorial-cuts-b7.test.ts` (C: 1.10 GB free) →
  `Tests 17 failed | 6 passed (23)`. RED as intended: every case's card QA has a hard entry at its join
  (all six); produced cut hard at 0366 4.83, 0366 12.63, 0373 204.069, 0373 247.86, 0375 122.7; wordless
  produced slivers at 0366 4.83–5.89, 0366 12.63–14.34, 0373 247.86; the three merge tests fail. Passing:
  floor sanity; 391.59's fluff stays rejected; 391.59 produced cut already clean under Auto-Cut-over-keeps
  (its sliver came only from Auto Cut planning the whole clip); no sliver at 204.069 / 122.7 / 391.59.

## Next step (ONE concrete instruction)

When `Get-PSDrive C` shows ≥ 1.0 GB free, run (one command, from the repo root)
`npx vitest run src/main/services/studio/editorial-cuts-b7.test.ts src/main/services/studio/editorial-cuts.test.ts src/main/services/studio/agent-tools/cut-tools.test.ts src/features/studio/services/text-delete.test.ts src/features/studio/services/text-restore.test.ts src/shared/studio/cut-planner.test.ts src/shared/studio/cut-planner-knobs.test.ts src/shared/studio/cut-qa.test.ts src/main/services/studio/agent-tools/run-auto-cut.test.ts`
and `npm run check:types` (baseline web 26 / node 10); expect `editorial-cuts-b7.test.ts` 26 / 26 green (23 + the
three guards) and the rest unchanged; fix only inside `cut-snap.ts` / `cut-snap-landing.ts` / `editorial-cuts.ts`
if anything is red (the hand-expected numbers are in step 2); record both outputs under Verified and commit the
four files together ("fix(studio): B7 — editorial cuts merge wordless gaps and land cut-ins off leftover sound").
After that (later steps, in order): item 5 (QA-flagged items `rejected` with the reason, both card
builders, the agent's reply names them), item 4 (Auto Cut over the timeline's keeps: `runCutPlan` takes the
asset's kept source ranges from the button and from `run_auto_cut`; `buildCutProposal` proposes only inside
them and its headline counts only that), then the live exit run once C: ≥ 5 GB (orchestrator decision 5).

## Open problems

- **C: disk (blocks every test run):** 0.25–0.32 GB free during builder #4 (it was 1.10 GB for builder #3). The
  step-2 fix is unverified until a test run is allowed. Not caused by this run (no app, no copies, no vitest).
- Not fixed, left listed (orchestrator: fix only if the same few lines — it is not): the CUT-OUT side mirror (an
  authored START early in the gap after a kept word truncates that word's tail via `cut-planner.ts:163`). A
  mirror of `landCutEnd` needs `tailFor`'s gap-dependent tail (punchy vs soft, the next-atom clamp), not the
  release walk; none of the six needs it.
- New, not blocking (no fixture): when a removed word's sound runs straight into the kept word, `landCutEnd`
  lands the cut 10 ms before the kept word's TOKEN (Hasan's own hand at 0373 204.209). If that word's real onset
  starts earlier than its token, that cut-in can slice the onset; the card's QA still sees it (item 5 then
  unchecks it). A refinement would cap at the snapHead-walked onset instead.
- Not blocking: with Auto Cut over the timeline's keeps (item 4), `planClip` keeps a WORDLESS keep whole
  (`cut-planner.ts:72-74`). After (a) the editorial pass no longer leaves wordless keeps between two applied
  cuts, but one the user creates (unchecking one of two neighbouring items) would survive Auto Cut whole.
  Today's whole-clip Auto Cut trims it. Note it on the item-4 step; no fixture case hits it. Also left: the
  wordless gap between an accepted cut and an unchecked fluff (0373 391.988–393.36) is kept by the card and,
  once the fluff is applied too, is such a user-made wordless keep.

## Do-not-redo

- B6's measurement and the track-B exit's numbers are the baseline (overlap 90.51 %; 6 / 146 hard
  entries on the produced cut; lead-in 0.150 vs 0.150 s, tail 0.220 vs 0.214 s). Don't re-run B6.
- Never modify `b-root`, `profiles\source`, Hasan's stations (`B1-verify-root` + `profiles\B1-verify`,
  `B5-station-root` + `profiles\B5-station`), or the editor repo.

- The six cases' fixture is extracted (`cut-snap-b7.fixture.json`); don't re-extract unless a case is wrong.
- The mechanism map above (step 1) is done; don't re-read cut-snap / cut-planner / cut-qa / cut-proposal /
  cut-plan-runner / workflow-tools / cut-tools to re-derive it — read only what the fix touches.
- Step 2's code is written (see Done › Step 2): don't rewrite it — RUN it, then fix only what a red test shows.
  The per-case envelope numbers come from `probe-b7.mjs`; don't re-derive them by hand.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-23 · builders #1, #2 · died on API connection errors before writing anything.
- 2026-10-23 · builder #3 · ~45 calls · step 1 (mechanism map, corrections) + the fixture + the red tests;
  disk override in force (code + targeted tests only; C: 1.10 GB free at hand-off).
- 2026-10-23 · builder #4 · ~35 calls · step 2 code (merge key + loud-gap guard, `landCutEnd` in the new
  `cut-snap-landing.ts`), B7 test moved to the shipped tight style + three guard tests, `probe-b7.mjs`; ran NO test
  (C: 0.25–0.32 GB free, under the override's 1.0 GB stop); nothing committed (not a green checkpoint).
