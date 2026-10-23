# B7 — Editorial cuts leave no hard entries
status: BUILDING — exit NOT MET yet (steps 1–5 done — `a31080a`, item 5 `eaf682d`, item 4 `2102419`, step 4b `d1d253a`, step 5 = the decision-4 kits unchanged; step 6 = the live exit run, ONE pass, 2026-10-23 15:11–15:21: **hard entries 0 / 137 ✓, lead-in / tail medians 0 / −4 ms ✓, overlap 89.74 % all proposed / 87.23 % applied ✗ (bar 90.5 %)**; **step 7 DONE + committed** (both overlap mechanisms fixed, red-first; expected on the step-6 capture by arithmetic: applied **0.9123**, all proposed 0.9141); next: the orchestrator's fresh live pass — see Next step)

> **Resource guard (orchestrator, 2026-10-23 13:55) — in force:** the machine sits near its memory
> commit limit (98.5–98.9 of 100.2–101.3 GB, other workloads) and Windows grows `C:\pagefile.sys` onto C:.
> Before EVERY test / type-check command run
> `powershell -NoProfile -Command "$os=Get-CimInstance Win32_OperatingSystem; '{0:N1} GB C: free; commit {1:N1} / {2:N1} GB' -f ((Get-PSDrive C).Free/1GB), (($os.TotalVirtualMemorySize-$os.FreeVirtualMemory)/1MB), ($os.TotalVirtualMemorySize/1MB)"`.
> C: ≥ 3 GB: code, targeted `npx vitest run <files> --maxWorkers=2`, `npm run check:types` only.
> Scratch copies, any app launch, the full `npx vitest run`, the live pass: only once C: ≥ 8 GB AND commit
> headroom ≥ 6 GB. C: < 3 GB: stop and hand off at once. (Builder #5 saw C: 5.4 → 4.4 GB during its run:
> the page file grew 100.2 → 101.3 GB while `check:types` ran.)
> **Relaxed (orchestrator, Session 3, after step 5):** live steps may start at C: ≥ 3 GB AND C: free + commit headroom ≥ 6 GB,
> with the background watchdog (`B7/watchdog.ps1`, stops only the B7 app at C: < 1.5 GB); a full vitest run uses
> `--maxWorkers=2`. Step 6 ran under this form (C: min 2.811 GB while the app ran; the page file grew to 103.264 GB).

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
8. **(orchestrator, after step 6) The overlap bar is measured on the APPLIED cut** — what the user gets;
   the 0-hard-entries clause is on the applied cut too, so both clauses read the same cut. Report the
   all-proposed number beside it (B6's headline; B6 applied 0.9049 ≈ proposed 0.9051, so the baseline is
   the same either way). Unchecking a flagged cut must not be how the hard entries reach 0 while content
   is lost: the fix is to make the flagged cut land cleanly so it can stay checked.
9. **(orchestrator, after step 6) One fresh live pass per fix round is allowed** (step 7's exit run, on
   a fresh D: copy; the step-6 scratch is evidence — keep it). At most two more passes in B7 (this round
   + one more); a third miss goes to Hasan with the numbers. Turn 1's "Move on." (the model's reply had
   no `[next: …]` marker) is part of the run shape when it happens — record it, and record the marker
   miss as a finding (the editorial pass should continue on its own).
10. **(orchestrator) For (b), the straddled word belongs to the side that holds most of it** (inside the
   span → extend past it; mostly kept → retract before it), then land in that gap's quiet — check that
   "nearest quiet gap by time" gives the same answer on all six real cases; where they differ, use the
   word rule and list the case.

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

### Step 2 — the fix for mechanisms 1–3 (written by builder #4, run + fixed + committed by builder #5, 2026-10-23, commit `a31080a`)

Commit `a31080a` (5 files): `src/shared/studio/cut-snap.ts`, `src/shared/studio/cut-snap-landing.ts` (new),
`src/main/services/studio/editorial-cuts.ts`, `src/main/services/studio/editorial-cuts-b7.test.ts` (new, 229 lines),
`src/features/studio/services/text-delete.test.ts`.

**Builder #5's changes to builder #4's code (what the first run showed):**
- `cut-snap-landing.ts:51-56` — the release is now MEASURED: `envelope.snapTail(a, 0, softMaxTail, …)` (floor 0)
  instead of `snapTail(a, style.minTail, …)`. minTail is the tail a KEPT word is given; flooring the removed word's
  release with it made a short clean gap read as "never decays" (natural minTail 0.26 + 0.06 lookback > the 0.25 s
  gap after 'um' in the text-edit fixture → the cut landed 10 ms before 'to'). All 26 B7 tests stay green with it.
- `text-delete.test.ts:44-79` — **one expectation changed, provably wrong under B7:** B2's "snaps with the style it is
  given" asserted `tight.to > natural.to + 0.05` in the 0.25 s gap after 'um' (`text-edit-fixtures.ts`, um 1.95–2.20,
  to 2.45). There both styles' lead-ins (head 0.19 / 0.11 + styleForFeatures' +0.08 → 0.27 / 0.19) start inside um's
  release + the QA's 60 ms entry lookback, so pre-B7 both cut-ins were HARD ENTRIES by the shipped QA: natural 2.20
  (+40.0 dB over the floor at `rmsDb(cutIn − 0.06, 0.05)`), tight 2.26 (+36.0 dB) — measured with a throw-away
  vitest probe (deleted). The assertion required one of the two to stay a hard entry. Kept its intent (the style
  reaches the snap) on a roomier gap: the same test with 'um' ending 2.00 (0.45 s of quiet before 'to'), same
  assertions; plus a new pin `lands the cut-in past the removed word's release in a short gap, whatever the style
  (B7)` (both styles → 2.28, entry window under 15 dB).
- `editorial-cuts-b7.test.ts:97-103` — type-only: the accepted items' source bounds are optional on the proposal type;
  the cuts are now built with a `flatMap` guard (check:types node had 6 new TS errors there).

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

### Step 3 — item 5: QA-flagged cuts start unchecked, in both card builders, named in the tool results (builder #6, 2026-10-23, commit `eaf682d`)

How a card reaches Apply (step 1 › 5, re-checked): the user's Apply click and the agent's `accept_proposal`
(`delivery-tools.ts:68`, takes no item ids — applies the open card's `accepted` items) are the only paths; both take
`status === 'accepted'` only. So building a flagged cut `rejected` covers both; no auto-apply path exists.
- **New pure op** `src/shared/studio/cut-qa-flags.ts` (85 lines): `QA_FLAG_JOIN_TOLERANCE_S = 0.02` (:17);
  `hardEntriesAtItemJoins(items, report)` (:22) — per item, the QA `hard-entry` items whose `sourceTime` is the item's
  `sourceEnd` (±0.02 s; the snapper's `sourceEnd` = the next segment's start, `cut-snap.ts` step 5), same asset when both
  are stamped; `uncheckQaFlaggedItems(items, report)` (:39) — flagged items → `status: 'rejected'` + `qaFlag` = the
  loudest one; clean items returned as the same objects; `formatQaFlag` (:53, the row's text "Unchecked by QA: hard entry
  +15.9 dB where speech resumes — play it; tick to cut anyway"); `formatQaUncheckedNote` (:58, the card note's line
  "1 cut starts unchecked — …"); `formatQaUncheckedLine` (:68, names each: "203.50–204.21 s retake (+15.9 dB)");
  `formatQaUncheckedForAgent` (:86, that line + "Apply leaves it in the video unless the user ticks it — name it in your
  reply.").
- **Schema (optional field only):** `StudioProposalItem.qaFlag?: { kind: 'hard-entry'; sourceTime; overDb }`
  (`src/shared/types/studio.ts:342`). Old projects open untouched (absent = clean / pre-B7 card).
- **Both card builders call it:** `buildEditorialProposal` (`src/main/services/studio/editorial-cuts.ts:86-87`, note line
  :100) and `buildCutProposal` (`src/shared/studio/cut-proposal.ts:105-107`, note line in `agentNote`) — the Auto Cut
  button (`useAutoCut.ts:71`, via the features re-export) and `run_auto_cut` share it. Category rules unchanged (fluff
  still `rejected`; a flagged fluff gains the `qaFlag` reason). Headlines unchanged (item 4 changes the Auto Cut one).
- **Tool results:** `propose_cuts` (`agent-tools/cut-tools.ts:100`) and `run_auto_cut` (`agent-tools/workflow-tools.ts:167`)
  append `formatQaUncheckedForAgent(proposal.items)` after the QA line. The agent prompt's review paragraph
  (`studio-agent-prompt-tools.ts:85`) now says a QA-flagged cut also starts unchecked and the reply must name it.
- **Row:** `ReviewCutsSection.tsx:223-227` shows `formatQaFlag` in `text-accent-red` above the note (truncate + title).
- **Tests (each red before the fix — see Verified):** `src/shared/studio/cut-qa-flags.test.ts` (new, 10 tests);
  `editorial-cuts-b7.test.ts:230` (synthetic: "cut" runs straight into "kept", the cut-in stays +35 dB → item 0
  `rejected` + `qaFlag` > 15 dB, item 1 accepted, note says "1 cut starts unchecked"); `cut-proposal.test.ts:69`
  (hard entry at 8 s → item [5, 8] rejected, the other three accepted); `cut-tools.test.ts:133` (the real handler's
  continuous-speech retake: the cut starts unchecked, the agent's note survives, the result names "1.xx–2.xx s retake"
  and "name it in your reply"); `run-auto-cut.test.ts:161` (untranscribed sound 2.0–3.0 s before "Next": one hard entry,
  that cut rejected at its `sourceEnd`, the rest accepted, the reply names it). **No existing expectation changed.**

### Step 4 — item 4: Auto Cut plans over the timeline's keeps, one code path (builder #7, 2026-10-23, commit `2102419`)

- **New pure op** `src/shared/studio/cut-keeps.ts` (106 lines): `timelineKeepsForAsset(timeline, assetId)` (:41) — the
  asset's `video`/`audio` clips' source ranges `[sourceIn, sourceIn + duration × speed]` (the analysis-status rule),
  merged (gap ≤ `KEEP_JOIN_GAP_S = 0.05`, :19 — split halves join; linked audio duplicates fold); `normalizeKeeps` (:59)
  clamps to `[0, duration]` and returns `undefined` = whole source when none / none left / one keep covering the source
  (±0.05 s) — so an untouched clip plans byte-for-byte as before (same file name, no `keeps` field); `cutsBetweenKeeps`
  (:77), `keepsTotal` (:89), `keepsTag` (:98, FNV-1a over ms-rounded keeps).
- **Schema (optional only):** `StudioCutPlan.keeps?` (`src/shared/types/studio-cut-plan.ts:152`); IPC
  `StudioCutPlanRunRequest.keeps?` (`src/shared/ipc/types/studio.ts:406`); `StudioAgentAssetInfo.sourceKeeps?` (:468).
- **Deviation from the old Next step (on purpose):** `buildCutProposal` takes NO separate `keeps` input — it reads
  `plan.keeps`, so the card can never be built over keeps other than the ones the plan was made over. New
  `planCutSpans(plan)` (`src/shared/studio/cut-proposal.ts:82`) inverts the segments INSIDE each keep (a gap between keeps
  is not an item; a keep's own head/tail silence is; a segment is clipped to the keep) → `{ spans, removed, total }`;
  `buildCutProposal` (:107) uses it and the headline reads `−removed of total` (:141). Whole source when `keeps` is absent
  (pre-B7 plans unchanged).
- **One code path:** `runCutPlan(…, cut, timelineKeeps?)` (`cut-plan-runner.ts:77`): `normalizeKeeps` (:90), then
  `planCuts` with `keeps` + `cuts = cutsBetweenKeeps(…)` (the planner's clamp: no lead-in/tail reaches into an applied
  cut), the QA over the same keeps, `plan.keeps` stamped, and the file name gains `-<keepsTag>` (:128) — a keeps-limited
  plan never shares a file with the whole-clip plan (nothing reads plan files back today — grep: only writes + the
  project package — so no cache could serve the wrong one; the name keeps it that way). Callers: the IPC
  (`studio-handlers.ts:481` forwards `data.keeps`), the button (`useAutoCut.ts:59` — `timelineKeepsForAsset(tl.timeline,
  …)`; `tl` Pick gains `timeline`), `run_auto_cut` (`workflow-tools.ts:154` passes `asset.sourceKeeps`; its reply counts
  with `planCutSpans` (:155), "−X s of Y s still on the timeline" — it used `plan.stats.removedDuration` of
  `sourceDuration`, which also counted already-cut spans). The renderer stamps `sourceKeeps` per asset from the LIVE
  timeline at send time: `toAgentAsset(asset, timeline?)` (`agent-chat-format.ts:61`), `useStudioAgent` option
  `timeline` (read through `optionsRef` at send), `EditorShell` passes `tl.timeline`. `planCuts`/`cut-planner.ts` untouched
  (its `stats.removedDuration` still = duration − kept; nothing user-facing reads it now).
- **Orchestrator addition (readout) — done, a few lines:** `formatQaUncheckedSuffix(items)` (`cut-qa-flags.ts:102`) →
  " — N unchecked by QA" (QA-flagged items still `rejected`; a ticked one stops counting); `CutQaReadout.tsx:76` appends
  it to "Hard entries N of M joins".
- **Tests (red first where the behaviour existed — see Verified):** `cut-proposal.test.ts:88` (keeps [0,6]+[10,20]: items
  [0,1] [5,6] [10,10.5] [12,14.5] [19,20], headline "−6.0 s of 16.0 s") and `:113` (an empty keep is one item; a segment
  past a keep is clipped); `cut-keeps.test.ts` (new, 5 tests); `cut-plan-runner.test.ts:93` (keeps [0,1.5]+[2.95,5]:
  `plan.keeps` stamped, every segment inside a keep, segment 2 starts 2.95 not 2.89 = the clamp, own `-k…` file, the
  card has no item in 1.5–2.95, headline "of 3.5 s") and `:113` (a whole-source keep = the same path, no `keeps`, same
  segments); `studio-cut-plan-run-handler.test.ts:55` (forwards `keeps`); `run-auto-cut.test.ts:190` (two clips of `a1`
  → `timelineKeepsForAsset` → the real handler: every item inside a keep, reply "… of 3.3 s still on the timeline");
  `cut-qa-flags.test.ts:119` (the suffix).
- **One existing expectation changed:** `studio-cut-plan-run-handler.test.ts:41` — old
  `toHaveBeenCalledWith('proj', 'a1', 'C:/clip.mp4', RESOLVED)`, new `…, RESOLVED, undefined)`. Reason: `runCutPlan`
  gained the optional 5th parameter and the handler always forwards `data.keeps` (undefined in that request); vitest's
  arg match counts the explicit `undefined` (measured: the run failed with `expected "vi.fn()" to be called with
  arguments: [ 'proj', 'a1', 'C:/clip.mp4', …(1) ]`). Behaviour unchanged.

### Step 4b — `run_auto_cut` plans over the timeline as it is when the tool runs (builder #8, 2026-10-23, orchestrator addition, commit `d1d253a`)

Closes step 4's open problem (an `accept_proposal` then `run_auto_cut` in ONE turn planned over the turn-start keeps).
Better than the sketched fix (main subtracting its own copy of the card's accepted spans): the RENDERER — which owns the
document and performs the apply — reports every touched asset's source ranges AFTER the apply, computed with the same
function the reducer commits with. That also covers a card that was open before the turn (`req.openProposal`, which
carries no items to main), a card the user unticked / dragged mid-turn, and `insert_asset` with `apply`.
- **Pure op** `sourceKeepsAfter(before, after)` (`src/shared/studio/cut-keeps.ts:60`) — every asset with a video/audio
  clip on either timeline → its `timelineKeepsForAsset(after, id)` (`[]` = none left).
- **One apply function** `applyProposalByKind(timeline, proposal, shots, { rippleAllTracks })` (new
  `src/features/studio/services/apply-proposal.ts`, 21 lines) — now used by the reducer's `proposal-apply`
  (`useTimeline.ts:521`, same expression as before, moved), the Player's result preview (`EditorShell.tsx:543`) and the
  agent's apply (`EditorShell.tsx:1119-1127`: `sourceKeeps = sourceKeepsAfter(tl.timeline, applyProposalByKind(…))`,
  computed BEFORE the dispatch from the same `tl.timeline`, returned with the result). Unused imports dropped
  (`useTimeline.ts:72-76`, `EditorShell.tsx:48`).
- **Wire (optional fields only):** `StudioAgentActionResultRequest.sourceKeeps?` (`src/shared/ipc/types/studio.ts:556`);
  `AgentActionOutcome.sourceKeeps?` + forwarded (`useStudioAgent.ts:42`, `:201`); `AgentActionResult.sourceKeeps?`
  + `resolve` forwards it (`src/main/services/studio/agent-actions.ts:21`, `:90`). An older renderer sends none → the
  turn-start keeps, today's behaviour. EditorShell's handler is now typed `Promise<AgentActionOutcome>`.
- **Main:** `StudioTurnState.sourceKeeps?: Map` (`agent-tools/types.ts:42`, created on first use); `noteAppliedKeeps(state,
  result.sourceKeeps)` (`types.ts:117`) after a successful `accept_proposal` (`delivery-tools.ts:95`) and `insert_asset`
  apply (`insert-tools.ts:129`); `findProjectAsset` / `projectInventory` overlay them (`withTurnKeeps`, `types.ts:128`;
  `[]` → `sourceKeeps` absent = the inventory's rule for an asset not on the timeline = whole source). `run_auto_cut`
  (`workflow-tools.ts:154`) is unchanged: it reads `asset.sourceKeeps` from `findProjectAsset` → the same `runCutPlan`
  path as the button.
- **Tests (red first — see Verified):** `run-auto-cut.test.ts` new describe "B7 step 4b" (the REAL `accept_proposal` +
  `run_auto_cut` handlers on one ctx, the REAL action bridge answered by a stand-in renderer with `sourceKeeps {a1:
  [0,1.2] [2.9,5]}`; turn-start inventory = the whole clip `[0,5]` → `plan.keeps` = the post-apply keeps, every item inside
  one, reply "of 3.3 s still on the timeline"); `cut-keeps.test.ts` new describe `sourceKeepsAfter` (2 tests: a cut, a
  removed asset → `[]`, an inserted asset; non-media clips name no asset). **No existing expectation changed.**
- Not unit-tested: the `EditorShell` handler's two lines (a component; the pure pieces are tested and the reducer's apply
  tests in `shot-ops` / `apply-shot-proposal` ran green over the moved expression). The exit run (one card per turn,
  answered by clicks) does not exercise this path.

### Step 5 — the decision-4 kits, re-run from copies (builder #9, 2026-10-23; no `src/` change, kit gitignored)

Neither B1's nor B2's kit copies project data (source read): B1's `compare.b1.test.ts` reads `B1/cutlib-joins.json` + b-root's
`cache/waveforms` + `cache/transcripts` and WRITES `B1/compare-report.json` (would overwrite B1's); B2's `textdel.b2.test.ts`
only reads (`…\vidtsx-e2e\B2\textdel-{before,after,sel}.json`, `B2-root`'s caches, `profiles\B2`'s preset — no credential
store) and writes nothing; B3's offline `compare.b3.test.ts` reads `…\B3\analyze-cut-ref.json` and WRITES `…\B3\compare-b3-report.json`.
So no copy waited on the guard. Copies in `.vidtsx-temp/end-to-end/B7/` (gated `$env:B7_KITS='1'`, config `vitest.b7.config.ts` =
B1's with the include changed): `compare-b1.b7.test.ts`, `compare-b3.b7.test.ts` (logic byte-identical to the originals; only the
gate, the input dir and the output path changed — `diff` shows exactly those lines), `textdel-b2.b7.test.ts` (B2's logic + a JSON
report + `expect.soft`), `probe-textdel.b7.test.ts` (prints the landing inputs), `compare-kits.mjs` (diffs the reports). Every
output is in `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\` (`b1-compare-report.json`, `b3-compare-report.json`,
`b2-textdel-report.json`); B1's / B2's / B3's own files untouched.

| Kit | Part's recorded numbers | B7 now | Difference |
|---|---|---|---|
| B1 cutlib reproduction | 352 joins, **348 within ±20 ms**, 4 outside, **2 merge flips**; tail level diff median 0.16 / p95 0.62 / max 3.06 dB; head 0.49 / 11.42 / 30.75 | identical | **none — the whole report is equal as JSON** (every clip, component, atom) |
| B3 offline QA vs analyze_cut | hard entries ref 0 / Studio 0; clipped tails ref 181 / Studio 178 (both 178, ref-only 3, Studio-only 0) | identical | **none — whole report equal as JSON** |
| B2 Transcript delete, 0369 words 12–23 | live [7.328, 20.41]; tight [7.328, 20.41]; preset natural+head 0.25 [7.628, 20.31]; natural [7.628, 20.35]; editorial [7.328, 20.41] | identical (all five, 0 ms) | **none** (see the preset note below) |

Why none (not just "by luck"): B7 left `cut-planner.ts`, `cut-qa.ts`, `rms-envelope.ts`, `text-delete.ts` and `cut-style.json`
untouched (`git diff --stat 4b5f3e7..HEAD` lists only `cut-snap.ts` + `editorial-cuts.ts` among the cut code; `resources/` empty),
and B1's / B3's kits call `planClip` / `runCutQa` directly. The B2 delete DOES go through B7's code: `landCutEnd` fires (the editorial
note "1 cut end moved off a removed word's release or a kept word's lead-in"; probe: authored end 16.663 = "business." → landed
17.303 at tight, 17.423 at natural / natural+head — the measured release 0.58 / 0.70 s + 0.06 s lookback), but it lands inside a
3.9 s pause (16.663 → "And" 20.56; +1.4–10 dB over the floor from 17.0 s on), far before the kept word's lead-in, so `planClip`'s
segment start (20.56 − head: 20.41 / 20.31 / 20.35) is unchanged — the intended change, with no visible effect on this cut.

**Input drift found (not B7, not a regression):** the first run gave preset natural+head `to` 20.35 (+40 ms vs B2's 20.31) because
`profiles\B2\…\youtube-long-form\preset.json` no longer carries `style.cut` (mtime 2026-10-22 13:40:32; keys now `pacing,
shotsPerMinute, sfxPerMinute, musicBed, captions, transitions, introSeconds, outroSeconds`) — it resolves to plain natural
(`natural · preset “YouTube long-form”`, key `61f095ee`) = natural's own edges. B2 recorded with `style.cut {"base":"natural","head":0.25}`
(B2 HANDOFF.md:470-471). The B7 copy rebuilds that in memory (nothing written) → `natural + 1 override · preset “YouTube long-form”`,
key **`15b4f39a`** (= B2's plan file `…-natural-15b4f39a.json`, B2 HANDOFF.md:479) → [7.628, 20.31], equal to B2. The on-disk preset
is reported alongside (`presetOnDisk` → [7.628, 20.35]).

B3's LIVE Auto Cut numbers (hard 1 / 164 at tight, whole clips) cannot be re-measured without the app — see Open problems.

### Step 6 — the live exit run (builder #10, 2026-10-23; no `src/` change)

- **Gate** (orchestrator, relaxed: C: ≥ 3 GB AND C: free + commit headroom ≥ 6 GB): first reading 15:05 `3.848 GB C:; commit
  100.233 / 102.258` → 5.873 → wait loop (`B7/gate-wait.ps1`, every 5 min, ≤ 30 min) → met at its first check 15:05:46
  (`3.848; 100.102 / 102.258; sum 6.004`); before the launch 15:08:54 `3.831; 100.078 / 102.258; sum 6.011`.
- **Material on D:** `robocopy b-root\projects\video-14-raw → .vidtsx-temp/end-to-end/B7/root/projects/video-14-raw` (41 files,
  579.40 MB, exit 1 = copied); `project.json` sha256 `EBE94FD7…123DDA` = b-root's. `robocopy profiles\source\profile →
  .vidtsx-temp/end-to-end/B7/profile /XF settings.db settings.db-wal settings.db-shm` (2,325 of 2,328 files, 371.81 MB; the 3
  skipped = the credential store, never opened); `Test-Path` on the three → False.
- **Kit** (`.vidtsx-temp/end-to-end/B7/`, gitignored): `run.mjs`, `cdp.mjs`, `probe.mjs`, `launch.sh`, `restore.ps1`,
  `measure.py` copied from B6, `exit_check.py` from `…\vidtsx-e2e\track-B-exit\`; re-pointed by `repoint-kit.mjs` (exact
  replacements): port 9347, root `D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/B7/root`, OUT `…\vidtsx-e2e\B7\run`, profile
  `D:/…/B7/profile`, log `…\vidtsx-e2e\B7\app.log`, `measure.py` DEFAULT_OUT `…\B7\measure`, `exit_check.py` `RUN_PROJECT` = the B7
  project, `RUN_RAW` = `…\B7\run\proposals-raw.json`, OUT `…\B7\exit`. `grep -nE 'B6|9331|track-B-exit'` → only "copied from"
  comments. The launcher keeps `unset ELECTRON_RUN_AS_NODE` and the strip of every `CLAUDE*` / `ANTHROPIC*` var. Two driver
  additions in `run.mjs` (recording only, no change to how a card is answered): a turn that runs BOTH `propose_cuts` and
  `run_auto_cut` labels each card by its `agentNote` / categories (step 4b's path); each captured card records `accepted` and
  `qaUnchecked` (items with `qaFlag`); tool args / results kept to 4,000 / 2,000 chars (B6 cut args at 600).
  `python -I -B …/B7/measure.py --selftest` → `selftest OK: …H total 813.315 s over 9 clips…`.
- **Watchdog** `B7/watchdog.ps1` (background; every 10 s; C: < 1.5 GB → `taskkill /T /F` only electron.exe whose CommandLine
  contains `.vidtsx-temp/end-to-end/B7/profile`; log `B7/watchdog.log`; stops on `B7/watchdog.stop`), started 15:09:01.
- **Launch** `bash …/B7/launch.sh` (background) → `probe.mjs ready` `readyAfterMs 75475`, root echoed
  `D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/B7/root`; `probe.mjs providers` → `{"active":"claude-subscription",
  "providers":[]}`. **Setup** `run.mjs setup` → V1 = the nine clips in raw order, `length s 1283.148`, settings
  `{"width":3840,"height":2160,"fps":60,"agent":{}}`, proposals 0, transcripts ready 27/44/97/207/183/602/40/330/290, chat 0 —
  all equal to B6's. Guard after setup (app running) 15:11:31 `3.829 GB C:; commit 101.385 / 102.258`.
- **The pass (ONE, run to its end; the harness did not break it):** 17 turns, all `claude-sonnet-5-5` on the keyless
  `claude-subscription`, 15:11:45–15:21:10. Loops (logs `…\vidtsx-e2e\B7\run\loop1..3.log`):
  - `loop1` = `run.mjs loop "Cut this video."` → turn 1 (0366 editorial), Apply 1 cut, then "applied, no auto-continue": the
    reply did NOT end with the `[next: …]` marker (`agent-chat-format.ts:33`) — it ended "Review the card and apply it. Then tell
    me to move on and I'll start the next clip (0369)." (B6's turn 1 had the marker → the editor auto-continued). **Deviation from
    B6's shape, forced by the model, not the harness:** answered as the reply asked, typed exactly `Move on.`
  - `loop2` = `loop "Move on."` → turns 2–8 (turn 2 typed, 3–8 the editor's own "Review outcome" auto-continues), one editorial
    card per clip (0374 read with 0375 in turn 7, no cuts); turn 8 ended without a marker and offered "Auto Cut for the silences,
    then shots and captions".
  - `loop3` = `loop "Yes, run Auto Cut for the pauses on all nine clips."` (B6's exact answer) → turns 9–17, one `run_auto_cut`
    per clip, every reply with the marker → auto-continued; turn 17 first called `run_auto_cut` on 0375 again by mistake ("it
    found nothing to cut, because you had already applied that card" — item 4 working; no card made), then 0376; it ended
    offering shots / captions (not taken, as in B6).
  - Watchdog never fired: C: min **2.811 GB** (the page file grew 102.258 → 103.264 GB at launch), commit max 102.727 /
    103.264 GB. App stopped 15:22 (`taskkill /T /F` on the launcher's bash, `--remote-debugging-port=9347` / B7-profile filter →
    `left: 0`, `electron total: 0`); watchdog stopped by its stop file (`watchdog stop (stop file); min C: 2.811 GB`, 0 left).
- **The run table** (`node …/B7/summarize-run.mjs` → `…\B7\run\run-summary.json`; usage = the app's AI-usage rows per turn):

  | Turn | Source | Tool(s) | Model s | In / out tok | Card (clip, kind) | Items | Accepted | QA-unchecked | Answer → disk |
  |---|---|---|---|---|---|---|---|---|---|
  | 1 | typed `Cut this video.` | get_transcript, propose_cuts 4 | 18.0 | 904 / 1,235 | 0366 ed. | 1 (4 merged) | 1 | 0 | Apply 1 → applied |
  | 2 | typed `Move on.` | get_transcript, propose_cuts 1 | 29.9 | 1,107 / 901 | 0369 ed. | 1 fluff | 0 | 0 | Reject all → rejected |
  | 3 | auto | get_transcript, propose_cuts 3 | 21.8 | 1,401 / 1,163 | 0370 ed. | 3 | 3 | 0 | Apply 3 → applied |
  | 4 | auto | get_transcript ×4, propose_cuts 5 | 32.6 | 1,745 / 3,062 | 0371 ed. | 5 | 3 | **2** (named) | Apply 3 → partial |
  | 5 | auto | get_transcript, propose_cuts 4 | 26.5 | 2,217 / 1,960 | 0372 ed. | 4 (1 fluff) | 3 | 0 | Apply 3 → partial |
  | 6 | auto | get_transcript, propose_cuts 12 | 46.0 | 2,702 / 4,687 | 0373 ed. | 10 | 9 | **1** (named) | Apply 9 → partial |
  | 7 | auto | get_transcript 0374 + 0375, propose_cuts 7 | 38.0 | 3,442 / 2,669 | 0375 ed. | 7 | 5 | **2** (named) | Apply 5 → partial |
  | 8 | auto | get_transcript, propose_cuts 5 | 24.6 | 4,030 / 1,852 | 0376 ed. | 4 | 3 | **1** (named, +18.5 dB) | Apply 3 → partial |
  | 9 | typed `Yes, run Auto Cut …` | run_auto_cut 0366 | 12.4 | 4,554 / 427 | 0366 AC | 1 | 1 | 0 | Apply 1 → applied |
  | 10–17 | auto | run_auto_cut 0369…0376 (17: 0375 again + 0376) | 11.1 / 9.5 / 13.3 / 13.9 / 10.0 / 11.2 / 10.0 / 16.2 | 4,738–5,890 / 251–479 | AC 0369 0370 0371 0372 0373 0374 0375 0376 | 7 / 10 / 20 / 8 / 54 / 6 / 30 / 27 | all | 0 | Apply all → applied |

  Totals: **17 turns, model time 345.0 s** (editorial 237.4 s, Auto Cut 107.6 s; B6 337.2 s), tokens in **64,662** / out **20,298**
  / cache-read **2,629,604**, SDK notional **$4.01** (B6 $3.89). **198 items** (editorial 35, Auto Cut 163; B6 39 + 261), **190
  applied** (27 + 163). **6 items started unchecked by QA, all 6 named in their turn's reply, none ticked** (left in the video):
  0371 24.721–33.633 false_start +37.4 dB, 0371 167.064–182.37 retake +35.2, 0373 25.1–30.0 retake +39.0, 0375 15.3–18.3 retake
  +41.7, 0375 190.733–195.1 retake +36.3, 0376 116.465–119.374 retake +18.5. Unchecked fluff: 0369 (lone card → Reject all),
  0372 (1). Auto Cut cards: 0 QA hard entries on all nine; headlines now read "of X s still on the timeline" (0373 "95.8 s of
  279.9 s"; B6 "171.2 s of 396.3 s"). Final V1: **187 clips, 534.285 s** (B6 196 / 509.149 s).
- **Measured** (`exit_check.py` → `…\B7\exit\`; `measure.py` → `…\B7\measure\`, `…\B7\measure-accepted\`):

  | Exit clause | Target | B7 | B6 / track-B exit baseline | Verdict |
  |---|---|---|---|---|
  | Hard entries on the applied cut (analyze_cut `entry_check`, real joins `> 0.75 s`) | 0 | **0 / 137** (editorial-class 0 / 24, Auto Cut-only 0 / 107, clip starts 0 / 6) | 6 / 146 | **MET** |
  | Median lead-in at real joins incl. clip edges vs fitted tight | ±30 ms | **0.150 vs 0.150 s (0 ms)**; inner only 0 ms | 0.150 vs 0.150 | **MET** |
  | Median tail, same | ±30 ms | **0.210 vs 0.214 s (−4 ms)**; inner only 0.200 vs 0.200 (0 ms) | 0.220 vs 0.214 | **MET** |
  | Overlap \|P∩H\| / \|H\|, all proposed items (B6's headline) | ≥ 0.905 | **0.8974** (P∩H 729.857 of H 813.315 s; precision 0.9415) | 0.9051 | **NOT MET** |
  | Same, accepted (= applied) items only | ≥ 0.905 | **0.8723** (709.491 s; precision 0.9476) | 0.9049 | **NOT MET** |

  Also: Hasan's own plan 0 / 134 (unchanged); tight / natural knobs equal to cuts.json; produced speeds [1], monotonic; the
  V1 = raw − removals cross-check differs on the SAME six clips as B6's baseline (0369 0371 0372 0374 0375 0376, −0.009…−0.038 s,
  one segment fewer) — not a B7 change; wordless segments ≤ 0.3 s: 1 (0366 [0, 0.06], +13.3 dB, clip start; B6 had 15
  wordless segments 0.06–0.5 s). The B6 slivers B7 targeted are gone (gained vs B6: 0366 4.83–5.074, 5.745–5.89, 12.63–12.775,
  14.194–14.34, 2.129–2.28; 0373 247.86–248.36, 249.205–249.35, 391.59–391.768).
- **Where the overlap went** (`python -I -B …/B7/overlap-causes.py` → `…\B7\overlap-causes.json`; B6 applied 735.952 s of H →
  B7 applied 709.491 s: −33.727 lost, +7.266 gained):
  1. **15.049 s inside the six QA-unchecked items** (item 5's rule kept them in; 18.936 s of H inside them is unapplied). Per
     item — every one is an AUTHORED end the snap could not fix (the model's notes say "edges estimated, needs an ear"):
     - **0371 33.6 → 33.633** (+37.4): authored 31.38–33.6 ends on filler "uh" (33.55–33.60), which runs into the kept "a" at 33.643
       (43 ms gap) → no quiet point; `landCutEnd` caps at "a" − 0.01. The nearest quiet gap is BEFORE "uh" (website, 33.335 →
       uh 33.55); Hasan cut 32.446–33.535 (keeps "uh").
     - **0371 182.0 → 182.37** (+35.2): authored end inside "simply" (181.879–182.492) of the kept "so you can simply focus" (starts
       "so" 181.492). Quiet gap BEFORE: take, 181.153 → so 181.492; Hasan 181.413.
     - **0373 30.0** (+39.0): authored end inside "up" (29.944–30.138) of the kept redo "and clean up…" (starts "and" 29.461).
       Quiet gap BEFORE: take— 28.994 → and 29.461; Hasan 29.354.
     - **0375 18.3** (+41.7): inside "same" (18.151–18.49) of the kept "The same AI" ("The" 18.07). Quiet gap BEFORE: take.
       17.536 → The 18.07; Hasan 17.996.
     - **0375 195.1** (+36.3): inside the SLATE "other" (194.941–195.181; "take," ends 195.599) — the end is too EARLY. Quiet gap
       AFTER: take, 195.599 → before 195.839; Hasan 195.799 (the "lost" 195.1–195.689 is that slate).
     - **0376 119.374** (+18.5): authored 117.13–118.9 is in the 644 ms gap "you." 118.74 → "These" 119.384; `landCutEnd` measured a
       release that never decays and capped at "These" − 0.01 — the known open problem (an onset earlier than its token).
  2. **10.923 s of clip-HEAD silence kept whole** (0375 0–3.372, 0371 0–2.422, 0372 0–2.247, 0370 0–1.582, 0376 0–1.300) **+ 1.346 s
     at 0373's tail** (394.899–396.245): after the editorial apply, the stretch before a clip's first editorial cut (and after
     0373's last) is a WORDLESS keep on the timeline; Auto Cut now plans over the keeps (item 4) and `planClip` keeps a wordless
     keep whole (`cut-planner.ts:72-74` — the Open problem builder #7 noted). Produced V1 first segments: 0370 [0, 1.83], 0371
     [0, 2.67], 0372 [0, 2.5], 0375 [0, 3.62], 0376 [0, 1.55], all without words; 0373's last [394.899, 396.246] without words.
     Whole-clip Auto Cut (B6) removed them as the leading / trailing silence item.
  3. **Model variance, ≈ net 0:** 0373 365.651–370.432 "Just the first scan…" (his flag 3, `manual`) not proposed this time
     (4.781 s); gained 0376 168.05–172.08 the stray "M" (`dead_air`, 4.03 s, now cut). Rest of "lost": 0373 188.6–189.0 0.4 s,
     0375 15.1–15.3 0.2 s, three ≤ 0.15 s pieces.
  Counterfactuals (same capture, arithmetic only): applied + the six items → 0.8956; + the head / tail silences → applied
  0.8874, all proposed ≈ 0.9125; both → ≈ 0.9107 applied. **Both mechanisms must be fixed for the applied cut to reach 0.905.**

### Step 7 (b) — the probe, BEFORE coding (builder #11, 2026-10-23; analysis only)

Fixture: `.vidtsx-temp/end-to-end/B7/extract-b7-s7.mjs <old fixture> <out>` (read-only over the step-6 scratch
`B7/root` + `…\vidtsx-e2e\B7\run\`): adds clips 0371 / 0376 and `speechCases` = per case the real buckets of
`[snapped item start − 1.5, end + 3]`, the words, the AUTHORED spans (`turns.jsonl` args, complete this time — 1,265–1,735
chars) and the snapped items. Probe `.vidtsx-temp/end-to-end/B7/probe-b7-s7.mjs <fixture>` (replicates `rms-envelope.ts` +
`landCutEnd` at the shipped tight; a candidate gap = two consecutive words ≥ `head + QA_ENTRY_LOOKBACK_S` = 0.21 s apart, landed
by today's rule with the end at the gap's far word, quiet = the cut-in's QA window ≤ +15 dB):

| Case (authored span) | Trigger | Nearest quiet gap by time | Word rule (decision 10) | Lands (QA dB) | Hasan |
|---|---|---|---|---|---|
| 0371 31.38–33.6 | short gap "uh"→"a" 0.043 s | back 33.335–33.55 (0.05 s away) | no straddled word → nearest | **33.535** (+5.7) | 33.535 |
| 0371 174.86–182 | inside "simply" (0.121 in / 0.492 kept) | back 181.153–181.492 (0.508) | back (mostly kept) | **181.433** (+4.9) | 181.413 |
| 0373 25.1–30.0 | inside "up" (0.056 / 0.138) | back 28.994–29.461 (0.539) | back | **29.311** (+5.6) | 29.354 |
| 0375 15.3–18.3 | inside "same" (0.149 / 0.19) | back 17.536–18.07 (0.23) | back | **17.92** (+1.4) | 17.996 |
| 0375 190.8–195.1 | inside "other" (0.159 / 0.081) | fwd 195.599–195.839 (0.499) | fwd (mostly inside) | **195.779** (+5.8) | 195.799 |
| 0376 117.13–118.9 | none (0.644 s gap) | — | — | onset cap: **119.074** (+14.5; today 119.374 +18.5) | — |

**"Nearest quiet gap by time" and the word rule give the same gap on all five; no case differs.** 0376: the gap holds +14–19 dB
sound throughout (20 ms profile), "These"'s walk-back runs the full maxHead (onset 119.084); capping the landing at that onset − 0.01
lands it at +14.5 dB (under 15 by 0.5 dB — marginal, the real QA decides in the test). The onset cap moves NONE of the step-1 cases
(0373 204.069's walk stops at the token → 204.209 kept; all ten step-1 span ends equal).

### Step 7 — the two overlap mechanisms, red-first (builder #11, 2026-10-23, commit: the step-7 commit on top of `5c5434b`)

**(a) Wordless keeps under keeps-limited Auto Cut** — new pure op `keepsWithWords(keeps, words)` (`src/shared/studio/cut-keeps.ts:104`,
a keep stays when a word's MIDPOINT lies in `[start, end)`). `runCutPlan` (`src/main/services/studio/cut-plan-runner.ts:94`) hands
`planCuts` only the spoken keeps (`keeps: spoken, cuts: cutsBetweenKeeps(spoken, …)`, :112) and stamps ALL timeline keeps on
`plan.keeps` (unchanged line) → `planCutSpans` proposes each wordless keep as one item and the headline counts it. One path for the
button and `run_auto_cut` (both call `runCutPlan`). `planClip` untouched (B1's wordless-atom rule). **Deviation from the Next step's
wording (on purpose):** the plan's QA reads the SPOKEN keeps (:123), not all keeps — the QA re-derives the planner's atoms from its
keeps, and a wordless keep the plan does not keep would be checked for a clipped tail it does not have (the red test pins
`atomsChecked 1`); whole-clip Auto Cut's QA never had such an atom either.

**(b) An authored end in continuous speech** — `src/shared/studio/cut-snap-landing.ts` (129 lines): `landCutEnd` (:50) =
`landAt(input, seekQuietGap ? endOutOfSpeech(input) : span.end)`; `landAt` (:54) is the old body plus the **onset cap** (:63-70): with
`style.maxHead`, the kept word's walked onset (`snapHead(kept.start, 0, maxHead, …)`; a walk that reached maxHead → `kept.start −
maxHead`) − 0.01 caps the landing when it lies past the removed word's end `a` (else the old `kept − 0.01` stays, so a walk that runs
back into the removed word changes nothing). `endOutOfSpeech` (:103): only when the end is inside a word or in a gap shorter than
`style.head + QA_ENTRY_LOOKBACK_S` (and the word before it is inside the span); candidates = inter-word gaps ≥ that length whose near
word is inside the span and that start before the next cut, within `QUIET_GAP_SEEK_S = 1.5` s (:37) of the authored end; a straddled
word fixes the side (decision 10, :113: more of it inside → after it, else before); each candidate is landed by `landAt` with the end at
its far word and kept only if the landed cut-in's QA window (`rmsDb(landed − 0.06, 0.05)`) reads ≤ floor + `QA_HARD_ENTRY_DB`; the
nearest by time wins. **Editorial only:** new optional `SnapCutSpansInput.seekQuietGap` (`cut-snap.ts:61-64`, passed at :209);
`snapEditorialCuts` sets it (`editorial-cuts.ts:50`); Transcript deletes do not (the user picked the words — pinned by a test). The
onset cap applies to both.

**Real-code ends** (`print-s7.b7.test.ts` → `…\vidtsx-e2e\B7\s7-landed.json`; starts unchanged): 0371 33.633 → **33.535** (Hasan
33.535), 182.37 → **181.432** (181.413), 0373 30.0 → **29.311** (29.354), 0375 18.3 → **17.92** (17.996), 195.1 → **195.779** (195.799),
0376 119.374 → **119.084** (the item end = planClip's segment start, the full 0.3 s maxHead pad before "These"); card QA hard 0 at all
six joins; each starts **checked**.

**Tests (red first — Verified):** new `src/main/services/studio/editorial-cuts-b7-speech.test.ts` (170 lines, 20 tests: per case the
end lands in the expected gap and within 0.1 s of Hasan's hand, the card's QA has no hard entry at the join and the item is `accepted`
with no `qaFlag`, the produced cut — card applied + Auto Cut over the keeps — has no hard entry within 1 s; a Transcript delete without
the seek keeps 0373's mid-word 30.0); `cut-plan-runner.test.ts:113` (keeps [1.0, 2.5] wordless + [2.9, 5]: no segment in the
wordless keep, `segments[0].start 2.9`, `qa.atomsChecked 1`, the card has item [1.0, 2.5], headline "of 3.6 s");
`cut-keeps.test.ts:13` (2 tests: the step-6 run's 0375 head [0, 3.62] and 0373 tail dropped; a straddling word goes with its
midpoint). Fixture `src/shared/studio/cut-snap-b7.fixture.json` 21.5 → 63.6 KB (old content unchanged; + clips 0371 / 0376 and
`speechCases`), made by `.vidtsx-temp/end-to-end/B7/extract-b7-s7.mjs`. **No existing expectation changed.**

**Expected overlap on the step-6 capture (arithmetic, no model run):** `python -I -B .vidtsx-temp/end-to-end/B7/expected-overlap-s7.py`
(the six items re-landed by the real code and applied; every wordless keep the applied editorial items leave — 0366 [0, 0.06], 0370
[0, 1.83], 0371 [0, 2.67], 0372 [0, 2.5], 0373 [394.899, 396.245], 0375 [0, 3.62], 0376 [0, 1.55] — proposed by Auto Cut and applied,
as the run answered every Auto Cut card; scored by `measure.py`) → **applied 0.9123** (P∩H 742.017 of 813.315 s, precision 0.949),
**all proposed 0.9141**; (a) alone 0.8890, (b) alone 0.8956 — both clear the 0.905 bar only together, as step 6 predicted
(0.9107 estimated then). Model variance (step 6: ≈ net 0, ±4.8 s per call) is not in this number.

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

- 2026-10-23 · builder #5 · guard read `5.4 GB C: free; commit 98.5 / 100.2 GB` · HANDOFF's 9-file set
  (`npx vitest run …editorial-cuts-b7… …editorial-cuts… …cut-tools… …text-delete… …text-restore… …cut-planner…
  …cut-planner-knobs… …cut-qa… …run-auto-cut… --maxWorkers=2`) with builder #4's code as written →
  `Tests 1 failed | 118 passed (119)`: **editorial-cuts-b7.test.ts 26 / 26 green**; red = text-delete
  `snaps with the style it is given (B2…)` (`expected 2.44 to be greater than 2.49`). After the minTail→0 release
  fix: still red (`expected 2.28 to be greater than 2.33`) → the expectation change above.
- 2026-10-23 · builder #5 · guard `5.4 GB; commit 98.8 / 100.2` · every cut test file (23 files: the 9 above +
  apply-cut-proposal, cut-style-spec, cut-style-resolve, rms-envelope, cut-style-override,
  studio-cut-plan-run-handler, preset-cut, cut-style-handlers, cut-style-store, cut-plan-runner, cut-proposal-qa,
  cut-proposal, cut-learn-joins, cut-learn; `--maxWorkers=2`) → `Test Files 23 passed (23) · Tests 263 passed (263)`.
  This covers decision 4's unit side (B1's cutlib reproduction tests in cut-planner / cut-learn, B2's per-style
  edges in cut-planner-knobs / cut-style-*, B3's card QA in cut-proposal-qa / cut-qa); B3's LIVE Auto Cut numbers
  (hard 1/164) are NOT re-run — that is the live pass.
- 2026-10-23 · builder #5 · guard `5.4 GB; commit 98.6 / 100.2` · `npm run check:types` → first
  `tsconfig.node.check.json: 16 errors (baseline 10) FAIL` (6 in editorial-cuts-b7.test.ts:100-117), after the
  type-only test fix → `tsconfig.web.check.json: 26 errors (baseline 26) ok` · `tsconfig.node.check.json: 10 errors
  (baseline 10) ok`, exit 0.
- 2026-10-23 · builder #5 · guard `4.4 GB; commit 98.9 / 101.3` · `npx vitest run
  src/main/services/studio/editorial-cuts-b7.test.ts src/features/studio/services/text-delete.test.ts --maxWorkers=2`
  → `Test Files 2 passed (2) · Tests 44 passed (44)`. Then commit `a31080a`.
- 2026-10-23 · builder #6 · guard `4.4 GB C: free; commit 98.8 / 101.3 GB` · RED first: `npx vitest run
  src/shared/studio/cut-qa-flags.test.ts src/main/services/studio/editorial-cuts-b7.test.ts
  src/features/studio/services/cut-proposal.test.ts src/main/services/studio/agent-tools/cut-tools.test.ts
  src/main/services/studio/agent-tools/run-auto-cut.test.ts --maxWorkers=2` → `Test Files 5 failed (5) · Tests 4 failed |
  45 passed (49)`: cut-qa-flags `Cannot find module './cut-qa-flags'`; the B7 synthetic, cut-proposal and cut-tools tests
  `expected 'accepted' to be 'rejected'` (the B7 one's precondition — a hard entry at item 0's end — already held);
  run-auto-cut `expected [] to have a length of 1`. After the fix (guard `4.4 GB; 98.9 / 101.3`) → `Test Files 5 passed
  (5) · Tests 59 passed (59)`.
- 2026-10-23 · builder #6 · guard `4.4 GB; 98.8 / 101.3` · the 23-file cut set of builder #5 + `cut-qa-flags`,
  `run-auto-cut`, `studio-agent-prompt`, `CutQaReadout` (26 files, `--maxWorkers=2`) → `Test Files 26 passed (26) ·
  Tests 299 passed (299)`.
- 2026-10-23 · builder #6 · guard `4.4 GB; 99.0 / 101.3` · `npm run check:types` → first 1 new node error
  (`cut-qa-flags.test.ts(58,38)` excess property on the `Pick` type; test-only fix), then (guard `4.4 GB; 98.9 / 101.3`)
  `tsconfig.web.check.json: 26 errors (baseline 26) ok` · `tsconfig.node.check.json: 10 errors (baseline 10) ok`, exit 0;
  `npx vitest run src/shared/studio/cut-qa-flags.test.ts --maxWorkers=2` → `Tests 10 passed (10)`. Then the step-3 commit.
- 2026-10-23 · builder #7 · guard `4.4 GB C: free; commit 99.0 / 101.3 GB` · RED first (cut-keeps.ts already written, the
  proposal code not yet): `npx vitest run src/features/studio/services/cut-proposal.test.ts src/shared/studio/cut-keeps.test.ts
  --maxWorkers=2` → `Tests 2 failed | 20 passed (22)`: both new cut-proposal tests (`expected [ [ +0, 1 ], [ 5, 10.5 ], …(2) ]
  to deeply equal [ [ +0, 1 ], [ 5, 6 ], …(3) ]`; `expected [ [ +0, 8.5 ], [ 12, 20 ] ] to deeply equal [ [ 2, 4 ], [ 12, 13 ] ]`).
  (The runner / handler / run_auto_cut tests were written with the plumbing, not run red separately.)
- 2026-10-23 · builder #7 · guard `4.3 GB; commit 99.3 / 101.3` · after the fix: the same 2 files + cut-plan-runner,
  run-auto-cut, cut-qa-flags (`--maxWorkers=2`) → `Test Files 5 passed (5) · Tests 44 passed (44)`.
- 2026-10-23 · builder #7 · guard `4.3 GB; 99.3 / 101.3` · `npx vitest run cut- text-delete text-restore rms-envelope
  studio-agent-prompt CutQaReadout agent-chat-format editorial-cuts useStudioAgent --maxWorkers=2` (name filters: every
  `cut-*` test incl. editorial-cuts-b7, cut-planner*, cut-snap*, cut-style-*, cut-learn*, cut-qa*, apply-cut-proposal,
  studio-cut-plan-run-handler) → first `1 failed | 298 passed (299)` (the handler expectation above), then (guard
  `3.2 GB; 99.8 / 102.3`) `Test Files 26 passed (26) · Tests 300 passed (300)`.
- 2026-10-23 · builder #7 · `npm run check:types` → first `web 29 (baseline 26) FAIL` (3 test-only: `agentNote` possibly
  undefined ×2, a `StudioClip` cast) + `node 12 (baseline 10)` (2 casts in run-auto-cut.test.ts); after the test-only
  fixes (guard `3.2 GB; 99.6 / 102.3`) `tsconfig.web.check.json: 26 errors (baseline 26) ok` · `tsconfig.node.check.json:
  10 errors (baseline 10) ok`, exit 0; then (guard `3.9 GB; 99.7 / 102.3`) `npx vitest run
  src/main/services/studio/agent-tools/run-auto-cut.test.ts --maxWorkers=2` → `Tests 5 passed (5)`. Then the step-4 commit.
  **The page file grew 101.3 → 102.3 GB during this run and C: touched 3.2 GB** — the next builder should expect to sit
  near the 3 GB stop line.
- 2026-10-23 · builder #8 · step 4b · guard `3.9 GB C: free; commit 99.9 / 102.3 GB` · RED first (tests written, no code):
  `npx vitest run src/main/services/studio/agent-tools/run-auto-cut.test.ts src/shared/studio/cut-keeps.test.ts
  --maxWorkers=2` → `Test Files 2 failed (2) · Tests 3 failed | 10 passed (13)`: `sourceKeepsAfter is not a function` ×2;
  step 4b real-handler test `expected undefined to deeply equal [ { start: +0, end: 1.2 }, …(1) ]` (`plan.keeps` absent =
  planned over the whole source from the turn-start inventory). After the fix (same guard) → `Test Files 2 passed (2) ·
  Tests 13 passed (13)`.
- 2026-10-23 · builder #8 · guard `3.9 GB; 99.7 / 102.3` · `npx vitest run cut- text-delete text-restore rms-envelope
  studio-agent-prompt CutQaReadout agent-chat-format editorial-cuts useStudioAgent run-auto-cut useTimeline apply-
  agent-actions agent-tools studio-agent --maxWorkers=2` (log `.vidtsx-temp/end-to-end/B7/vitest-4b.log`) → `Test Files 37
  passed (37) · Tests 358 passed (358)`. Then (guard `3.9 GB; 99.9 / 102.3`) the reducer-apply + insert/accept users:
  `npx vitest run src/features/studio/services/shot-ops.test.ts src/features/studio/services/apply-shot-proposal.test.ts
  src/main/services/studio/agent-tools/audio-tools.test.ts src/main/services/studio/agent-tools/flow-tools.test.ts
  src/main/services/studio/agent-actions.test.ts --maxWorkers=2` → `Test Files 5 passed (5) · Tests 36 passed (36)`.
- 2026-10-23 · builder #8 · guard `3.9 GB; 99.9 / 102.3` · `npm run check:types` → `tsconfig.web.check.json: 26 errors
  (baseline 26) ok` · `tsconfig.node.check.json: 10 errors (baseline 10) ok` (first try). Then the step-4b commit.
- 2026-10-23 · builder #9 · step 5 · guard `3.8 GB C: free; commit 99.9 / 102.3 GB` · `$env:B7_KITS='1'; npx vitest run
  --config .vidtsx-temp/end-to-end/B7/vitest.b7.config.ts compare-b1 compare-b3 textdel-b2 --maxWorkers=2` (log
  `B7/kits-run1.log`) → `Test Files 3 passed (3) · Tests 3 passed (3)`; `node .vidtsx-temp/end-to-end/B7/compare-kits.mjs` →
  B1 `{"joinsTotal":352,"joinsWithin":348,"joinsOutside":4,"mergeFlips":2,…}` = recorded (2026-10-22T08:41Z), `whole-report
  differences: NONE`; B3 `{"refHard":0,"studioHard":0,"refTails":181,"studioTails":178,"tailsBoth":178,"tailsRefOnly":3,
  "tailsStudioOnly":0}` = recorded (2026-10-22T11:50Z), `NONE`; B2 four edges 0 / 0 ms, `presetNaturalHead was [7.628,20.31]
  now [7.628,20.35]` (the preset drift above).
- 2026-10-23 · builder #9 · guard `3.8 GB; 99.9 / 102.3` · probe `npx vitest run --config … probe-textdel --maxWorkers=2
  --silent=false --reporter=verbose` (vitest 4 hides a passing test's console without `--silent=false`) → words 16–21 s
  `real 15.96–16.238, business. 16.303–16.663, And 20.56–…`; tight `head 0.15 maxHead 0.3 release 0.58 lo 17.303 landed 17.303`;
  natural / preset-on-disk `head 0.21 maxHead 0 release 0.7 lo 17.423 landed 17.423`.
- 2026-10-23 · builder #9 · guard `3.8 GB; 100.1 / 102.3` · after rebuilding B2's recorded preset in the copy: the same 3-kit
  command (log `B7/kits-run2.log`) → `Test Files 3 passed (3) · Tests 3 passed (3)`; `compare-kits.mjs` → preset only
  `natural + 1 override · preset “YouTube long-form” 15b4f39a`; **all five B2 edges `d 0 / 0 ms`**; B1, B3 `NONE` again.
- No `npm run check:types` / targeted vitest needed for step 5: no tracked file changed except HANDOFF.md and LOG.md.
- 2026-10-23 · builder #10 · step 6 · guard (the orchestrator's relaxed form) `powershell -NoProfile -Command "$os=…"` →
  15:05 `3.848 GB C:; commit 100.233 / 102.258` (sum 5.873 → `B7/gate-wait.ps1` in the background) → `GATE MET` 15:05:46 (sum
  6.004); before the launch 15:08:54 sum 6.011; after setup (app up) `3.829; 101.385 / 102.258`. D: 30.3 → 29.4 GB.
- `robocopy …b-root\projects\video-14-raw …\B7\root\projects\video-14-raw /E` → `Files 41 41 … Bytes 579.40 m`, exit 1;
  `Get-FileHash` both `EBE94FD77F17895993F7D8159E294DB75E52FD515765B751C78EB2C635123DDA`, `equal: True`. `robocopy
  …profiles\source\profile …\B7\profile /E /XF settings.db settings.db-wal settings.db-shm` → `Files 2328 2325 3`, exit 1;
  `Test-Path` ×3 → `False`.
- `node .vidtsx-temp/end-to-end/B7/repoint-kit.mjs` → every replacement `ok` or already in place ("all replacements in place");
  `grep -nE 'B6|9331|track-B-exit'` over the seven kit files → only the "copied from" comment lines; `node --check run.mjs` ok;
  `python -I -B .vidtsx-temp/end-to-end/B7/measure.py --selftest` → `selftest OK: P=H, P=empty, P=keeps, 0370 hand case, 0.3 s
  boundary in ms, flag entries 1-6; H total 813.315 s over 9 clips; …`.
- `node …/B7/probe.mjs ready` → `{"readyAfterMs": 75475, "root": {"root": "D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/B7/root"}}`;
  `probe.mjs providers` → `{"active": "claude-subscription", "providers": [], "keys": ["providers","activeProvider","presets"]}`.
  `probe.mjs turn` NOT run (the budget is the pass).
- `node …/B7/run.mjs setup` (log `…\B7\run\setup.log`) → `V1 0366@0.000+20.288 | 0369@20.288+47.698 | … | 0376@1100.298+182.849`,
  `length s 1283.148 settings {"width":3840,"height":2160,"fps":60,"agent":{}} proposals 0 transcripts [["0366","ready",27],…,
  ["0376","ready",290]]`, `chat messages 0`.
- `run.mjs loop "Cut this video."` → `loop1.log` ends `loop ends: applied, no auto-continue (no [next:] marker)` after turn 1;
  `run.mjs loop "Move on."` → `loop2.log` turns 2–8, same end; `run.mjs loop "Yes, run Auto Cut for the pauses on all nine
  clips."` → `loop3.log` turns 9–17, same end. `turns.jsonl` 17 lines; `proposals-raw.json` 17 cards.
- `node …/B7/summarize-run.mjs` → `{"turns":17,"modelS":345,"inTok":64662,"outTok":20298,"cacheRead":2629604,"costUsd":4.01,
  "cards":17,"items":198,"itemsEditorial":35,"itemsAutocut":163,"qaUnchecked":6,"appliedItems":190,"editorialApplied":27,
  "autocutApplied":163,"finalV1Clips":187,"finalV1Seconds":534.285}` + the per-turn / per-card lines in the table above; writes
  `proposals-accepted.json` (190 items = the items still `accepted` on a card whose disk status is applied / partial).
- `python -I -B .vidtsx-temp/end-to-end/B7/exit_check.py` (stdout `…\B7\exit-run1.out`) → `hard_entries.produced_total 0`,
  `produced_real_joins_checked 137`, per clip all 0, `hasan_plan_total 0 / 134`; `by_join_class` autocut-only 0 / 107, clip-start
  0 / 6, editorial 0 / 24 (`over15_any_join` 2 — non-real joins ≤ 0.75 s); `card_qa_hard_entries` editorial 6 / autocut 0;
  geometry real joins incl. clip edges lead 0.15 vs 0.15, tail 0.21 vs 0.214 (`diff ms {'lead': 0.0, 'tail': -4.0}`), inner
  only `{'lead': 0.0, 'tail': 0.0}`.
- `python -I -B .vidtsx-temp/end-to-end/B7/measure.py C:/…/B7/run/proposals.json C:/…/B7/measure` → `"H": 813.315, "P": 775.213,
  "PH": 729.857, "overlap": 0.8974, "precision": 0.9415, "autocut_overlap": 0.4413, "editorial_overlap": 0.4945`; same on
  `proposals-accepted.json` → `…\B7\measure-accepted` → `"P": 748.725, "PH": 709.491, "overlap": 0.8723, "precision": 0.9476,
  "editorial_overlap": 0.4311`.
- `python -I -B .vidtsx-temp/end-to-end/B7/overlap-causes.py` → `{"H": 813.315, "b6": 735.952, "b7": 709.491, "b7_all": 729.857,
  "b7_plus_qa": 728.427, "lost": 33.727, "gained": 7.266, "lost_in_qa": 15.049, "lost_in_fluff": 0.0, "lost_rest": 18.678,
  "qa_H": 36.995, "qa_H_not_applied": 18.936, …}`; `lost (not QA / fluff) by cat: {"retake": {"n": 8, "s": 12.112}, "unlisted":
  {"n": 3, "s": 1.612}, "pause": {"n": 1, "s": 0.14}, "manual": {"n": 1, "s": 4.781}}`. Words at the six cut-ins from Hasan's
  `work/transcripts/<clip>.json` (scratch `…\B7\qa-items.py` + one inline read; read-only).
- Processes after the stop: `left: 0`, `electron total: 0`; watchdog `watchdog procs: 0`. `git status --short` → only
  `docs/studio/end-to-end/B7/HANDOFF.md` (no `src/` change). No vitest / check:types run (exit not met → no gates; no tracked
  code changed).
- 2026-10-23 · builder #11 · step 7 · `node .vidtsx-temp/end-to-end/B7/extract-b7-s7.mjs src/shared/studio/cut-snap-b7.fixture.json
  <scratchpad>/fixture-s7.json` → six cases, authored spans 31.38–33.6 / 174.86–182 / 25.1–30 / 15.3–18.3 / 190.8–195.1 / 117.13–118.9,
  `bytes 63642`; `node …/B7/probe-b7-s7.mjs <fixture>` → the table in Done › Step 7 (b) — the probe; copied over the tracked fixture.
- 2026-10-23 · builder #11 · guard `48.5 GB C: free; commit 101.3 / 103.3 GB` · RED first (tests written, no code): `npx vitest run
  src/main/services/studio/editorial-cuts-b7-speech.test.ts src/main/services/studio/cut-plan-runner.test.ts
  src/shared/studio/cut-keeps.test.ts --maxWorkers=2` → `Test Files 3 failed (3) · Tests 15 failed | 21 passed (36)`:
  `keepsWithWords is not a function` ×2; runner `expected true to be false` (a segment inside the wordless keep); speech cases
  `expected 33.633 to be less than 33.55`, `expected 182.37 to be less than 181.492`, `expected 30 to be less than 29.461`,
  `expected 18.3 to be less than 18.07`, `expected 195.1 to be greater than 195.599`, and the card-QA test for all six (`expected [
  { kind: 'hard-entry', …(3) } ] to deeply equal []`; 0376's end already lay in its gap); the Transcript-delete pin failed on a
  field name in the test (`i.start` → `i.sourceStart`, test-only). The produced-cut tests passed red too (an unchecked item is not
  applied → no join). After the fix (same guard) the 3 files + `editorial-cuts-b7.test.ts` → `Test Files 4 passed (4) · Tests 63
  passed (63)`.
- 2026-10-23 · builder #11 · guard `48.5 GB; 101.3 / 103.3` · `$env:B7_KITS='1'; npx vitest run --config
  .vidtsx-temp/end-to-end/B7/vitest.b7.config.ts print-s7 --silent=false --maxWorkers=2` → `Tests 1 passed (1)`, writes
  `…\vidtsx-e2e\B7\s7-landed.json` (ends in Done › Step 7). `python -I -B .vidtsx-temp/end-to-end/B7/expected-overlap-s7.py` →
  `applied_b_only overlap 0.8956` · `applied_a_and_b 0.9123 (P 781.92, PH 742.017, precision 0.949)` · `all_a_and_b 0.9141` ·
  `applied_a_only 0.889`; writes `…\vidtsx-e2e\B7\s7-expected-overlap.json`.
- 2026-10-23 · builder #11 · guard `48.1 GB; 102.8 / 103.3` · `npx vitest run cut- text-delete text-restore rms-envelope
  studio-agent-prompt CutQaReadout agent-chat-format editorial-cuts useStudioAgent run-auto-cut useTimeline apply- agent-actions
  agent-tools studio-agent --maxWorkers=2` (builder #8's set ⊇ builder #6's 26 cut files; log `B7/vitest-s7.log`) → `Test Files 38
  passed (38) · Tests 381 passed (381)` (= 358 + the 23 new).
- 2026-10-23 · builder #11 · guard `28.6 GB; 102.6 / 104.3` (C: fell 48 → 28.6 GB and the page file grew between two commands; no
  job of ours ran) · `$env:B7_KITS='1'; npx vitest run --config .vidtsx-temp/end-to-end/B7/vitest.b7.config.ts compare-b1 compare-b3
  textdel-b2 --maxWorkers=2` (log `B7/kits-run3.log`) → `Test Files 3 passed (3) · Tests 3 passed (3)`; `node
  .vidtsx-temp/end-to-end/B7/compare-kits.mjs` → B1 `joinsWithin 348 / 352, mergeFlips 2`, `whole-report differences: NONE`; B3
  `refHard 0, studioHard 0, studioTails 178 / refTails 181`, `NONE`; B2 live / tight / presetNaturalHead / natural / editorial all
  `d 0 / 0 ms` (the editorial delete's end 16.663 sits before a 3.9 s pause → no seek; the onset cap does not bind).
- 2026-10-23 · builder #11 · guard `28.6 GB; 102.7 / 104.3` · `npm run check:types` → `tsconfig.web.check.json: 26 errors (baseline
  26) ok` · `tsconfig.node.check.json: 10 errors (baseline 10) ok`, exit 0 (first try). Then the step-7 commit.

## Next step (ONE concrete instruction)

**The orchestrator's call (decision 9: this is the step-7 fix round's ONE fresh live pass; at most one more after it):** run the live
exit run on the step-7 code exactly as step 6 did (Done › Step 6 = the recipe; the kit is ready), but on NEW scratch — never the step-6
evidence: robocopy b-root's `projects\video-14-raw` and `profiles\source\profile` (`/XF settings.db settings.db-wal settings.db-shm`)
into EMPTY `.vidtsx-temp/end-to-end/B7/pass2/root/projects/video-14-raw` and `.vidtsx-temp/end-to-end/B7/pass2/profile`; copy the kit
(`run.mjs`, `cdp.mjs`, `probe.mjs`, `launch.sh`, `restore.ps1`, `measure.py`, `exit_check.py`, `summarize-run.mjs`, `overlap-causes.py`,
`watchdog.ps1`) into `B7/pass2/` and re-point every path (root, profile, `…\vidtsx-e2e\B7\pass2\run`, `…\pass2\exit`, `…\pass2\measure*`,
app log; port **9348**; grep the copies for `B7/root`, `B7/profile`, `9347`, `vidtsx-e2e\B7\run` → none left); same gate + watchdog
(matching the pass2 profile path); type exactly `Cut this video.` (and `Move on.` / B6's Auto Cut answer when the model asks, as in
step 6); measure with the pass2 copies of `exit_check.py` + `measure.py` (applied AND all proposed). **Expect:** hard entries 0, medians
within ±30 ms, overlap on the applied cut ≈ 0.91 (0.9123 on step 6's model choices) — model variance can move it a few seconds of H;
the six step-6 cases' kind (authored ends in continuous speech) should now start checked, and no clip should open on a wordless
Auto Cut keep. Any new QA-unchecked item → record its authored span, words and dB as step 6 did (the next fix's red test).

## Next step — superseded (kept for reference: builder #10's step 7 instruction, DONE as step 7)

**Step 7 — fix the two mechanisms that cost the overlap, each red-first from the live run's real cases (decision 3), in the shared
code every consumer uses; then hand back so the orchestrator decides the exit re-run** (a fresh live pass of the FIXED code is
the exit run of step 7, not a retry of step 6 — step 6's one pass is spent and was not broken by the harness). Both are needed:
the arithmetic in Done › Step 6 gives applied 0.8874 with (a) alone, 0.8956 with (b)'s six items alone, ≈ 0.9107 with both.

(a) **Wordless keeps under Auto Cut over the timeline.** In `runCutPlan` (`src/main/services/studio/cut-plan-runner.ts:77`, the
one path of the button and `run_auto_cut`): a timeline keep that holds no transcript word (by word midpoint) gets no segment —
leave it out of the keeps handed to `planCuts`, keep it in `plan.keeps` and the QA, so `planCutSpans` makes it one item ("an empty
keep is one item", `cut-proposal.test.ts:113`) — what whole-clip Auto Cut always did with the stretch before the first word and
after the last. NOT in `planClip` (`cut-planner.ts:72-74`: B1's cutlib reproduction relies on a wordless keep kept whole). Red test
in `cut-plan-runner.test.ts`: keeps [0, 3.62] (no word) + [7.928, 20] → no segment inside [0, 3.62], the card has item [0, 3.62],
the headline counts it. Real cases: 0375 [0, 3.62], 0370 [0, 1.83], 0371 [0, 2.67], 0372 [0, 2.5], 0376 [0, 1.55], 0373
[394.899, 396.246].

(b) **An authored end in continuous speech.** In `landCutEnd` (`src/shared/studio/cut-snap-landing.ts`, step 2b of `cut-snap.ts`;
today a no-op when the span ends mid-word): when the authored end lies inside a word, or in an inter-word gap too short for the
style's lead-in + `QA_ENTRY_LOOKBACK_S` (no quiet cut-in before the next word), move it to the NEAREST inter-word gap — backward
or forward, by time from the authored end — that is long enough and whose cut-in window reads ≤ `QA_HARD_ENTRY_DB` over the floor,
then let the existing rule land it in that gap. Where it must land (Hasan's hand in brackets): 0371 33.6 → before "uh" (gap
33.335–33.55) [33.535]; 0371 182.0 → before "so" (181.153–181.492) [181.413]; 0373 30.0 → before "and" (28.994–29.461) [29.354];
0375 18.3 → before "The" (17.536–18.07) [17.996]; 0375 195.1 → FORWARD after "take," (195.599–195.839) [195.799]. And 0376 119.374
(the open problem "onset earlier than its token"): cap the landing at the kept word's `snapHead`-walked onset, not token − 0.01.
Fixtures: add the six windows to `cut-snap-b7.fixture.json` with `extract-b7.mjs` re-pointed read-only at
`.vidtsx-temp/end-to-end/B7/root` + `…\vidtsx-e2e\B7\run\` (spans = the snapped items in `proposals-raw.json`; authored ends in
`turns.jsonl` args, kept whole this time). First run the rule on the fixtures by a probe: if "nearest quiet gap" does not give
all six, write what does under Open problems BEFORE coding.

Then, as after every snap change: the 26-file cut set (Verified, builder #6) + `editorial-cuts-b7.test.ts` green; the decision-4
kits (builder #9's one command + `compare-kits.mjs`: B1 348/352, B3 0/0 + 178/181, B2's five edges — expect unchanged; B2's delete
goes through `landCutEnd`); `npm run check:types` web 26 / node 10. Guard before every test command.

## Next step — superseded (kept for reference: builder #9's live-run instruction, DONE as step 6)

**Run the live exit run (decisions 5 + 6, with the orchestrator's 15:00 amendment) and measure it — but START ONLY when the
guard reads C: ≥ 3 GB AND (C: free + commit headroom) ≥ 8 GB** (headroom = total − used in the guard line). At builder #9's
hand-off: `3.8 GB C: free; commit 100.1 / 102.3 GB` → 3.8 + 2.2 = **6.0 GB → NOT yet**. If it is still under 8 GB, do nothing
else and hand back saying so. Re-check the guard before the copies, before the launch, before every `run.mjs loop` call and
before the measurement; C: < 3 GB at any point → stop the app (step 7) and hand off. D: stop line 1.0 GB (DRIVING.md).

0. **Pre-flight:** no `electron.exe` running (`Get-CimInstance Win32_Process -Filter "Name='electron.exe'"`; 0 at builder #9's
   hand-off) — if one is, it is Hasan's: follow DRIVING.md (never kill it, never a second `electron-vite dev`; run
   `electron.exe .` on its Vite server with your own profile + port). Port **9347** free (B7's CDP port; nothing listened on it,
   5173, 9222 or 9331 at hand-off). D: free ≥ 2 GB (30.3 GB at hand-off).
1. **Material on D: (never modify `b-root` or `profiles\source`):**
   `robocopy "C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root\projects\video-14-raw" "D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\B7\root\projects\video-14-raw" /E /NFL /NDL /NJH /NP`
   (~580 MB; robocopy exit 0–7 = success) → `project.json` sha256 must equal b-root's (B6 recorded `ebe94fd7…3dda`).
   `robocopy "C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\source\profile" "D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\B7\profile" /E /XF settings.db settings.db-wal settings.db-shm /NFL /NDL /NJH /NP`
   (~377 MB) — **the profile's credential store `settings\settings.db` (+ `-wal`, `-shm`) is NOT copied** (this run's rule: never
   copy a credential store; see Open problems); the app creates a fresh one → no saved providers → `llm-init.ts:82-90` registers the
   keyless `claude-subscription` as the active provider (B6 HANDOFF "How the assistant's provider is chosen"). Never open either
   folder's `settings\`.
2. **Kit:** copy `.vidtsx-temp/end-to-end/B6/{run.mjs,cdp.mjs,probe.mjs,launch.sh,restore.ps1,measure.py}` and
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\track-B-exit\exit_check.py` into `.vidtsx-temp/end-to-end/B7/`, then re-point (and grep
   each copy for `B6`, `9331`, `track-B-exit` afterwards — none may be left except in comments that say "copied from"):
   `cdp.mjs:7` PORT `9331` → `9347`; `probe.mjs:6` + `run.mjs:14` ROOT → `D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/B7/root`;
   `run.mjs:16` OUT → `C:/Users/hasan/AppData/Local/vidtsx-e2e/B7/run`; `launch.sh:11` `--user-data-dir="D:/repos/VidTSX-STUDIO/.vidtsx-temp/end-to-end/B7/profile"
   --remote-debugging-port=9347`, `:14` log → `/c/Users/hasan/AppData/Local/vidtsx-e2e/B7/app.log` (KEEP the `ELECTRON_RUN_AS_NODE`
   unset and the strip of every `CLAUDE*` / `ANTHROPIC*` env var); `restore.ps1` filter → `*--remote-debugging-port=9347*`;
   `measure.py:33` DEFAULT_OUT → `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\measure`; `exit_check.py:21` B6_PROJECT →
   `D:\repos\VidTSX-STUDIO\.vidtsx-temp\end-to-end\B7\root\projects\video-14-raw\project.json`, `:22` B6_RAW →
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\run\proposals-raw.json`, `:23` OUT → `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\exit`.
   `python -I -B .vidtsx-temp/end-to-end/B7/measure.py --selftest` must pass before the run.
3. **Launch:** `bash .vidtsx-temp/end-to-end/B7/launch.sh` in the background (a script FILE, DRIVING.md); then
   `node .vidtsx-temp/end-to-end/B7/probe.mjs ready` (waits for `window.api` + the Studio nav, `studioRootSet` → the B7 root,
   `studioRootGet` must echo it) and `node … probe.mjs providers` → expect `{"active":"claude-subscription","providers":[]}`. Do NOT
   run `probe.mjs turn` (the exit budget is the ONE pass). A minimized window: `powershell -File …/B7/restore.ps1`.
4. **Setup:** `node .vidtsx-temp/end-to-end/B7/run.mjs setup` → expect length **1283.148 s**, settings `{width 3840, height 2160,
   fps 60, agent: {}}` (no `providerId`, no preset, no `cutStyle` → tight · default), **0 proposals**, empty `agent-chat.json`,
   transcripts ready 27/44/97/207/183/602/40/330/290 = 1,820 words (B6 HANDOFF Done 6). Anything else → fix the copy (it is scratch),
   not the app.
5. **The ONE pass (B6's run shape):** `node .vidtsx-temp/end-to-end/B7/run.mjs loop "Cut this video."` — it types with real input,
   captures every NEW card from `project.json` BEFORE answering it (`proposals-raw.json`), answers with a real click (`Apply N cuts`
   = the accepted items; `Reject all` when 0 are accepted — with B7 a card whose cuts all start unchecked by QA is such a card), and
   lets "Review outcome" auto-continue. Resume as B6 did (`loop --resume`, `loop --continue`); if the assistant OFFERS Auto Cut instead
   of running it, `loop "Yes, run Auto Cut for the pauses on all nine clips."` (exactly). A second pass only if the harness broke the
   first (say so). Record per card: items, how many started unchecked by QA (`qaFlag` on the item), and whether the reply named them.
6. **Capture:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\run\` = `turns.jsonl`, `proposals-raw.json`, `proposals.json`; make
   `proposals-accepted.json` = `proposals.json` minus the items that were not `accepted` at Apply (B6 HANDOFF.md:179 did the same).
7. **Stop the app:** only processes whose command line has `--remote-debugging-port=9347` or `.vidtsx-temp/end-to-end/B7/profile`
   (+ the `electron-vite` you started) — `taskkill /T /F /PID <pid>`; confirm 0 left. Never select by a bare number.
8. **Measure:** `python -I -B .vidtsx-temp/end-to-end/B7/exit_check.py` → hard entries on the APPLIED cut (analyze_cut
   `entry_check` on real joins, `REAL_JOIN 0.75`) — **exit: 0** (baseline 6 / 146) — with per-join detail for any left; median
   lead-in / tail at joins vs the fitted tight — **exit: within ±30 ms** (baseline lead-in 0.150 vs 0.150 s, tail 0.220 vs 0.214 s).
   `python -I -B .vidtsx-temp/end-to-end/B7/measure.py C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\run\proposals.json C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\measure`
   and the same on `proposals-accepted.json` → `…\B7\measure-accepted` — **exit: overlap ≥ 0.905** (baseline 0.9051 all /
   0.9049 accepted-only); report both. Run every Python from the repo root, never from inside the editor repo.
9. Write it up: Done + Verified here (commands + outputs), a TESTING.md block in §17's shape, one LOG.md line; commit docs only
   (`docs(studio): B7 — …`). Any exit clause missed → Open problems with the per-join numbers; the fix is a NEW step (red test
   from the failing join first), not a second pass.

## Next step — superseded (kept for reference: builder #8's step 5 instruction)

Step 5 = the decision-4 kits (orchestrator decision 4; Open problems › "Decision-4 kits"), read-only: first check
whether B1's `.vidtsx-temp/end-to-end/B1/compare.b1.test.ts` and B2's `textdel.b2.test.ts` copy any project data
(read their source only; if either copies a project root it waits for the guard's C ≥ 8 GB AND headroom ≥ 6 GB — hand
off saying so); if not, copy each kit into `.vidtsx-temp/end-to-end/B7/`, re-point every output to
`C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\` (never overwrite B1's `compare-report.json` or `…\vidtsx-e2e\B2`), run them
with the resource guard before each, and record B1's join count (expect 348/352 unchanged — `cut-planner.ts` is untouched
by B7) and every edge B2's text-delete pass moved (expected only where `landCutEnd` fires). After that: the live exit run
(decision 5) — NB the orchestrator's 2026-10-23 15:00 decision (ORCHESTRATOR.md, end of "Session 3") supersedes
decision 5's C: paths and this file's header gate: the M2 copy and the profile copy go on **D:** under
`.vidtsx-temp/end-to-end/B7/` (not `…\vidtsx-e2e\B7-root` / `profiles\B7`), and the run may start when C: ≥ 3 GB AND
(C: free + commit headroom) ≥ 8 GB. At builder #8's hand-off: C: 3.9 GB + headroom 2.4 GB = 6.3 GB → not yet.

(Done — kept for reference) Old step 4 = item 4 (decision 2), pure op + red unit tests first: give `buildCutProposal`
(`src/shared/studio/cut-proposal.ts:72`) an optional `keeps?: Array<{ start; end }>` input (the asset's source ranges
still ON the timeline) — spans are inverted only INSIDE the keeps (a gap between two keeps is not a cut item; a keep's
own head/tail silence is), and the headline reads `−removed of <kept total>` (absent = today's whole-source behaviour,
so old callers and pre-B7 plans are unchanged); red tests in `src/features/studio/services/cut-proposal.test.ts` with
`makePlan()` + two keeps. Then the plumbing, one code path for both callers: `runCutPlan`
(`src/main/services/studio/cut-plan-runner.ts:81-110`) takes optional `keeps` and passes them to `planCuts` (it already
takes `keeps`/`cuts`, `cut-planner.ts:215-229`) and to the QA (today `[0, duration]`) — check the plan cache key/file
name so a keeps-limited plan never serves a whole-clip request (or vice versa); the IPC request
(`studio-handlers.ts:481`, its request type in `src/shared/ipc/types/`) gains optional `keeps`; the button
(`src/features/studio/hooks/useAutoCut.ts:71`) derives them from the timeline's clips of that asset (find an existing
helper that maps clips to source ranges in `features/studio/services/` before writing one) and passes them to both the
IPC and `buildCutProposal`; `run_auto_cut` (`agent-tools/workflow-tools.ts:152-158`) derives them the same way from the
project document it can load (find whether `req` carries the timeline or use `loadProject(req.projectId)` — the same pure
helper, moved to `src/shared/studio/` if both sides need it). A unit test each (cut-proposal, cut-plan-runner,
run-auto-cut real handler with a project whose timeline holds two clips of `a1`). Note on the item-4 step (Open
problems): `planClip` keeps a wordless keep whole.
Later steps, in order: the decision-4 kits (Open problems, read-only copies, outputs to `…\vidtsx-e2e\B7\`); then the
live exit run once C: ≥ 8 GB and commit headroom ≥ 6 GB (the resource guard; orchestrator decision 5).

## Open problems

- **NEW (step 7), for the orchestrator — choices made inside step 7 (not Hasan's; say if you want them otherwise):**
  (1) the quiet-gap seek is EDITORIAL ONLY (`seekQuietGap`, set by `snapEditorialCuts`): a Transcript delete keeps the words the user
  selected even when its end sits in continuous speech (QA still flags it; item 5's rule does not apply to text deletes). The 0376
  onset cap applies to both. (2) New constant `QUIET_GAP_SEEK_S = 1.5` s — how far from the authored end the seek looks either way;
  it also bounds how much kept speech a forward move can remove (all six real moves are 0.05–0.54 s). No gap within it → the end
  stays and the card's QA unchecks the cut as before. (3) Auto Cut over keeps: the plan's QA reads the SPOKEN keeps (Done › Step 7 (a)).
  (4) 0376 lands at +14.4 dB in a gap that never drops below +9 dB (breath / room) — 0.6 dB under the bar; the produced audio keeps
  0.3 s of that sound before "These". Clean by the shipped QA, marginal by ear (Hasan's real-video test).
- RESOLVED by step 7 (b) (pending the live pass): the six QA-unchecked authored ends of step 6. RESOLVED by step 7 (a): the wordless
  clip heads / 0373 tail, and the older note that a user-made wordless keep survives Auto Cut whole (Auto Cut now proposes any
  wordless timeline keep as one item; `planClip` itself still keeps a wordless keep whole for B1's cutlib reproduction). RESOLVED by
  the onset cap: "`landCutEnd` lands 10 ms before the kept word's TOKEN… if the onset starts earlier" (0376 is that case).
- **(step 6) — the exit is NOT met on overlap** (step 7 fixed both mechanisms; expected applied 0.9123 on the step-6 capture; needs
  the fresh pass — Next step): 0.8974 all proposed / 0.8723 applied vs ≥ 0.905 (hard entries 0 / 137 and
  the medians are met). Causes and per-cut numbers in Done › Step 6; the fix is step 7 (Next step). For the orchestrator: (1) a
  re-run of the exit after step 7 needs a new live pass (one more keyless subscription pass, ~345 s model time, ~$4 notional) —
  your call, as decision 5 budgeted one; (2) item 5's rule by itself costs overlap whenever a flagged cut stays unchecked — after
  step 7 (b) any still-flagged cut is a real bad join the user must hear, and the overlap bar is measured on the applied cut, so a
  cut the snap cannot fix will count against the bar. If you want the bar measured on all PROPOSED items (B6's headline) instead,
  say so; step 7 (a) alone brings that one to ≈ 0.9125.
- **NEW (step 6), model behaviour, not fixed:** turn 1's reply had no `[next: …]` marker although it was the first step of a
  multi-step run (the prompt rule `studio-agent-prompt-tools.ts:81`), so the editor did not auto-continue and the user had to type
  `Move on.`; turn 8 also ended without one (it offered Auto Cut — the same as B6). B6's turn 1 had it. Model variance; a finding
  for the prompt, not an exit item.
- **NEW (step 6), not fixed:** the 0373 tail after the unchecked fluff "Okay," — produced [394.899, 396.246] without words (1.35 s)
  — is the same wordless-keep mechanism as the clip heads (step 7 (a) covers it). The wordless gap 391.988–393.36 between the
  accepted retake and that fluff (noted before) stays as it was.
- **Resource guard (blocks the live pass, scratch copies, the full suite):** builder #5 read C: 5.4 → 4.4 GB and
  commit 98.5–98.9 of 100.2–101.3 GB (headroom ~1.5–2.4 GB; the page file grew while `check:types` ran). The live
  exit run needs (orchestrator 15:00, supersedes this file's header gate) C: ≥ 3 GB AND C: free + commit headroom ≥ 8 GB,
  scratch on D:. Builder #9's hand-off: 3.8 + 2.2 = 6.0 GB → not yet. Not caused by this run (no app, no copies, no full suite).
- RESOLVED (step 5, builder #9): the decision-4 kits — B1 348/352 + 2 merge flips, B3-offline 0/0 hard + 178/181 tails, B2's
  five Transcript-delete edges: all UNCHANGED (Done › Step 5). Correction to the old note: B2's `textdel.b2.test.ts` writes
  nothing (it only reads `…\vidtsx-e2e\B2`); B1's and B3's kits are the ones that overwrite their own reports.
- **For the orchestrator (not blocking, decide before the live run): the profile copy vs. the credential-store rule.** Decision 5
  says copy `profiles\source\profile`; that folder holds `settings\settings.db` (+ `-wal`, `-shm`; existence checked with
  `Test-Path` only, never opened) and B6's whole-folder copy carried it (`profiles\B6\profile\settings\settings.db` exists). This
  run's rule is "never read, copy or open a credential store (any settings.db)". The Next step therefore copies the profile
  WITHOUT those three files (`robocopy … /XF settings.db settings.db-wal settings.db-shm`): the app creates a fresh store, which by
  `llm-init.ts:82-90` makes the keyless `claude-subscription` the active provider — the same provider B6 ran with. Unknown: any
  OTHER app setting kept only in that db (B6 recorded `{"active":"claude-subscription","providers":[]}` and nothing else from it);
  the full-ffmpeg install lives in `<userData>/ffmpeg-full/` (a folder, copied) and the proxies in the project cache. If the
  orchestrator wants the db copied as B6 did, say so in the Next step; otherwise the exclusion stands.
- **B3's LIVE Auto Cut numbers (hard 1 / 164 at tight over whole, untouched clips) are not re-measured** — they need the app, and
  the exit run does not reproduce them (its Auto Cut cards plan over the timeline's keeps after the editorial cards, a different
  denominator). By construction they cannot move: the planner, QA and envelope code are untouched, and an untouched clip plans
  byte-for-byte as before (`normalizeKeeps` → whole source, pinned by `cut-plan-runner.test.ts:113`). The one visible change is
  that 0373 @ 323.198's cut now starts UNCHECKED on its card (step 3). If the orchestrator wants a live number, it is B3's
  `drive.mjs` Auto Cut step on its own fresh copy — not part of B7's exit.
- Found (input drift, outside B7): `profiles\B2\profile\assets\presets\youtube-long-form\preset.json` lost its `style.cut`
  (`{"base":"natural","head":0.25}` when B2 recorded) — mtime 2026-10-22 13:40:32. Anyone re-running B2's original
  `textdel.b2.test.ts` today gets preset natural+head [7.628, 20.35], not 20.31, and its `presetNat ≠ live` assertion still holds.
  Not touched (B2's scratch); B7's copy rebuilds the recorded preset in memory.
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

- RESOLVED (step 4): the card's QA readout counted the hard entries of cuts that start unchecked — it now reads
  "Hard entries 1 of 42 joins — 1 unchecked by QA" (`formatQaUncheckedSuffix`). The counts themselves are still the
  plan's (not recomputed over the accepted items).
- RESOLVED (step 4b, builder #8): `run_auto_cut`'s keeps were the TURN-START timeline, so `accept_proposal` then
  `run_auto_cut` in one turn re-proposed inside the just-applied spans. Now the renderer answers every apply with the
  post-apply source ranges (`sourceKeepsAfter` over `applyProposalByKind`, the reducer's own function) and main overlays
  them for the rest of the turn. Left: a hand edit by the USER on the timeline during a turn (not an apply the agent
  asked for) still isn't seen until the next turn — no tool reads the live timeline between applies.
- Note (step 4): the Auto Cut card of a clip whose editorial card is applied now headlines "−X s of <seconds still on
  the timeline>"; the plan file's `stats.removedDuration`/`sourceDuration` are still whole-source numbers (`cut-planner.ts`
  untouched; nothing user-facing reads them now).
- New (step 3), for the live pass: B3's one Auto Cut true positive (0373 @ 323.198, hard 1/164) will now start
  UNCHECKED on its card, so that pause stays in the produced cut (decision 1's rule; decision 4 allowed the true
  positive to stay — it now stays off the timeline instead). A hard entry at a clip's FIRST segment unchecks the
  leading-silence item `[0, seg0.start]` (keeps the head room tone, no join).

## Do-not-redo

- Step 7 is DONE, green and committed: don't rebuild `keepsWithWords`, the runner's spoken-keeps rule, `endOutOfSpeech` / the onset
  cap / `seekQuietGap`, or re-extract `speechCases` (`extract-b7-s7.mjs`). Touching cut-snap* / editorial-cuts / cut-plan-runner /
  cut-keeps again → the Verified 38-file set + the decision-4 kits (one command + `compare-kits.mjs`) + check:types. The expected
  overlap on the step-6 capture is `expected-overlap-s7.py` (re-run it only if a landing changes; it reads `s7-landed.json`).
- Step 6 (the live exit run) is DONE and measured — its ONE pass is spent (not harness-broken): don't re-run it on the same code
  and don't re-measure it; every number is in `C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\` (`run\` capture + `run-summary.json`,
  `exit\exit-check.json` + `produced-joins.json`, `measure\`, `measure-accepted\`, `overlap-causes.json`). The scratch
  (`.vidtsx-temp/end-to-end/B7/root`, `B7/profile` — no `settings.db`) now holds the APPLIED run: a new exit pass needs a FRESH
  copy (Done › Step 6's two robocopy commands into empty folders), never this one. The kit (`run.mjs` … `exit_check.py`,
  `repoint-kit.mjs`, `watchdog.ps1`, `gate-wait.ps1`, `summarize-run.mjs`, `overlap-causes.py`) is ready as is.
- Step 5 (the decision-4 kits) is DONE: B1 / B3-offline reports equal to the recorded ones as JSON, B2's five edges equal. Don't
  re-run them unless `cut-planner` / `cut-qa` / `rms-envelope` / `cut-snap*` / `text-delete` / `editorial-cuts` change again — then
  the one command in Verified (builder #9) + `node .vidtsx-temp/end-to-end/B7/compare-kits.mjs`.
- Step 4b is DONE, green and committed: don't rebuild `sourceKeepsAfter`, `applyProposalByKind`, the action result's
  `sourceKeeps` wire or `noteAppliedKeeps` / `withTurnKeeps`. Touching them → run builder #8's two Verified sets.
- Step 4 (item 4 + the readout suffix) is DONE, green and committed: don't rebuild `cut-keeps.ts`, `planCutSpans`, the
  runner's keeps/file-name rule or the `sourceKeeps` plumbing. Touching them again → run the Verified name-filter set.

- Step 3 (item 5) is DONE, green and committed: don't rebuild `cut-qa-flags.ts` or re-derive the Apply paths (only
  `accepted` items reach the timeline: the Apply click and `accept_proposal`).

- B6's measurement and the track-B exit's numbers are the baseline (overlap 90.51 %; 6 / 146 hard
  entries on the produced cut; lead-in 0.150 vs 0.150 s, tail 0.220 vs 0.214 s). Don't re-run B6.
- Never modify `b-root`, `profiles\source`, Hasan's stations (`B1-verify-root` + `profiles\B1-verify`,
  `B5-station-root` + `profiles\B5-station`), or the editor repo.

- The six cases' fixture is extracted (`cut-snap-b7.fixture.json`); don't re-extract unless a case is wrong.
- The mechanism map above (step 1) is done; don't re-read cut-snap / cut-planner / cut-qa / cut-proposal /
  cut-plan-runner / workflow-tools / cut-tools to re-derive it — read only what the fix touches.
- Step 2 is DONE, green and committed (`a31080a`): don't re-run its test set to "check" it unless your change
  touches cut-snap / cut-snap-landing / editorial-cuts / text-delete — then run the 23-file cut set in Verified.
  The per-case envelope numbers come from `probe-b7.mjs`; don't re-derive them by hand. The B2 text-delete
  expectation change is argued in Done › Step 2 (both pre-B7 cut-ins were hard entries) — don't revert it.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-23 · builders #1, #2 · died on API connection errors before writing anything.
- 2026-10-23 · builder #3 · ~45 calls · step 1 (mechanism map, corrections) + the fixture + the red tests;
  disk override in force (code + targeted tests only; C: 1.10 GB free at hand-off).
- 2026-10-23 · builder #4 · ~35 calls · step 2 code (merge key + loud-gap guard, `landCutEnd` in the new
  `cut-snap-landing.ts`), B7 test moved to the shipped tight style + three guard tests, `probe-b7.mjs`; ran NO test
  (C: 0.25–0.32 GB free, under the override's 1.0 GB stop); nothing committed (not a green checkpoint).
- 2026-10-23 · builder #5 · ~38 calls · ran step 2: B7 tests 26/26 green as written; fixed the landing's release
  floor (minTail → 0, measured release); changed B2's text-delete style expectation (proved both pre-B7 cut-ins were
  hard entries) + a B7 pin; type-only fix in the B7 test; 23 cut test files 263/263 green, check:types at baseline
  (web 26 / node 10); committed `a31080a`; wrote step 3 (item 5) as the next step. Resource guard in force.
- 2026-10-23 · builder #6 · ~40 calls · step 3 (item 5): `cut-qa-flags.ts` + optional `qaFlag`, both card builders
  uncheck QA-flagged cuts, both tool results name them, prompt line, row reason; 5 red tests → green; 26 cut test files
  299/299; check:types web 26 / node 10; committed; wrote step 4 (item 4). C: 4.4 GB, commit 98.8–99.0 / 101.3 GB.
- 2026-10-23 · builder #7 · ~50 calls · step 4 (item 4): `cut-keeps.ts`, `plan.keeps`, `planCutSpans`, keeps through
  `runCutPlan` (cuts + QA + own file), the IPC, the button and `run_auto_cut` (renderer-stamped `sourceKeeps`); the
  readout's "— N unchecked by QA"; 2 red → green, 26 test files 300/300, check:types web 26 / node 10; one handler
  expectation changed (explicit `undefined` arg); committed. C: 4.4 → 3.2 → 3.9 GB, page file 101.3 → 102.3 GB.
- 2026-10-23 · builder #8 · ~55 calls · step 4b (orchestrator addition): the renderer reports post-apply `sourceKeeps`
  with every apply result, main overlays them for the turn → `run_auto_cut` after `accept_proposal` plans over the
  timeline as it is; one `applyProposalByKind` for reducer / preview / agent apply; 3 red → green, 37 files 358/358 +
  5 files 36/36, check:types web 26 / node 10; no existing expectation changed; committed; step 5 not started. C: 3.9 GB
  throughout, commit 99.7–99.9 / 102.3 GB.
- 2026-10-23 · builder #9 · ~42 calls · step 5: copied B1's / B3's compare kits and B2's text-delete kit into `B7/` (outputs →
  `…\vidtsx-e2e\B7\`), ran them under the guard: B1 348/352 + 2 flips, B3-offline 0/0 + 178/181, B2's five edges — all unchanged
  (the landing fires on B2's delete but inside a 3.9 s pause); found B2's preset drift (input, not code) and the profile's
  `settings.db` vs. the credential rule (Open problems); wrote the live exit run as the Next step. No `src/` change, no app, no
  model call. C: 3.8 GB, commit 99.9–100.1 / 102.3 GB throughout.
- 2026-10-23 · builder #10 · ~60 calls · step 6: the live exit run under the relaxed gate (waited for sum ≥ 6 GB; watchdog armed, never
  fired, C: min 2.811 GB): M2 + profile (no `settings.db`) copied to D:, kit copied + re-pointed, keyless `claude-subscription`
  confirmed, B6's setup reproduced, ONE pass of 17 turns (typed `Cut this video.`, `Move on.` — the model's turn 1 had no `[next:]`
  marker — and B6's Auto Cut yes), every card captured before a real-click answer; measured: hard entries 0 / 137 ✓, medians 0 /
  −4 ms ✓, overlap 0.8974 / 0.8723 ✗; attributed the gap (six QA-unchecked authored ends in continuous speech; wordless clip-head
  keeps kept whole by Auto Cut over keeps); wrote step 7. No `src/` change; app, watchdog stopped (0 left).
- 2026-10-23 · builder #11 · ~40 calls · step 7: extracted the six step-6 cases (authored spans complete) + probed the rule BEFORE
  coding (nearest quiet gap = decision 10's word rule on all five; 0376 needs the onset cap; no step-1 case moves); (a) `keepsWithWords`
  + spoken keeps in `runCutPlan`; (b) `endOutOfSpeech` + onset cap in `cut-snap-landing.ts`, editorial-only `seekQuietGap`; 15 red →
  green (23 new tests), 38 files 381/381, kits unchanged, check:types web 26 / node 10; no expectation changed; expected overlap on
  the step-6 capture 0.9123 applied / 0.9141 all; committed. No app, no model call. C: 2.8 → 48.5 → 28.6 GB (not ours).
