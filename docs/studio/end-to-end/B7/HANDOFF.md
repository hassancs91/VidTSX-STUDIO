# B7 — Editorial cuts leave no hard entries
status: BUILDING (steps 1–4 done and committed — `a31080a`, item 5 `eaf682d`, item 4 `2102419`; next: the decision-4 kits, then the live exit run when the resource guard allows)

> **Resource guard (orchestrator, 2026-10-23 13:55) — in force:** the machine sits near its memory
> commit limit (98.5–98.9 of 100.2–101.3 GB, other workloads) and Windows grows `C:\pagefile.sys` onto C:.
> Before EVERY test / type-check command run
> `powershell -NoProfile -Command "$os=Get-CimInstance Win32_OperatingSystem; '{0:N1} GB C: free; commit {1:N1} / {2:N1} GB' -f ((Get-PSDrive C).Free/1GB), (($os.TotalVirtualMemorySize-$os.FreeVirtualMemory)/1MB), ($os.TotalVirtualMemorySize/1MB)"`.
> C: ≥ 3 GB: code, targeted `npx vitest run <files> --maxWorkers=2`, `npm run check:types` only.
> Scratch copies, any app launch, the full `npx vitest run`, the live pass: only once C: ≥ 8 GB AND commit
> headroom ≥ 6 GB. C: < 3 GB: stop and hand off at once. (Builder #5 saw C: 5.4 → 4.4 GB during its run:
> the page file grew 100.2 → 101.3 GB while `check:types` ran.)

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

## Next step (ONE concrete instruction)

Step 5 = the decision-4 kits (orchestrator decision 4; Open problems › "Decision-4 kits"), read-only: first check
whether B1's `.vidtsx-temp/end-to-end/B1/compare.b1.test.ts` and B2's `textdel.b2.test.ts` copy any project data
(read their source only; if either copies a project root it waits for the guard's C ≥ 8 GB AND headroom ≥ 6 GB — hand
off saying so); if not, copy each kit into `.vidtsx-temp/end-to-end/B7/`, re-point every output to
`C:\Users\hasan\AppData\Local\vidtsx-e2e\B7\` (never overwrite B1's `compare-report.json` or `…\vidtsx-e2e\B2`), run them
with the resource guard before each, and record B1's join count (expect 348/352 unchanged — `cut-planner.ts` is untouched
by B7) and every edge B2's text-delete pass moved (expected only where `landCutEnd` fires). After that: the live exit run
(decision 5) once C: ≥ 8 GB and commit headroom ≥ 6 GB.

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

- **Resource guard (blocks the live pass, scratch copies, the full suite):** builder #5 read C: 5.4 → 4.4 GB and
  commit 98.5–98.9 of 100.2–101.3 GB (headroom ~1.5–2.4 GB; the page file grew while `check:types` ran). The live
  exit run needs C: ≥ 8 GB AND headroom ≥ 6 GB. Not caused by this run (no app, no copies, no full suite).
- **Decision-4 kits not yet re-run (do before the exit, read-only):** (1) B1's cutlib reproduction
  `.vidtsx-temp/end-to-end/B1/compare.b1.test.ts` (`$env:B1_COMPARE='1'; npx vitest run --config
  .vidtsx-temp/end-to-end/B1/vitest.b1.config.ts compare`) calls `planClip`/`tailFor` directly on Hasan's cuts —
  `cut-planner.ts` is untouched by B7 (`a31080a` changes only `cut-snap.ts`, `cut-snap-landing.ts`,
  `editorial-cuts.ts` + tests), so 348/352 cannot move, but it OVERWRITES B1's `compare-report.json` — copy the kit
  to `.vidtsx-temp/end-to-end/B7/` and re-point its output first. (2) B2's `textdel.b2.test.ts` (`B2_TEXTDEL=1`,
  `vitest.b2.config.ts`) DOES go through the changed code (`planTextDelete` + `snapEditorialCuts` on `B2-root`) and
  writes to `…\vidtsx-e2e\B2` — copy + re-point the output to `…\vidtsx-e2e\B7\` before running; a moved edge there
  is expected only where the landing rule fires (cut-in in a removed word's release) — report each moved edge.
  (3) B3's live Auto Cut numbers (hard 1/164) need the app — part of the live pass.
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
- New (step 4), not blocking the exit run: `run_auto_cut`'s keeps are the TURN-START timeline (`sourceKeeps` on the
  inventory). If one turn calls `accept_proposal` on an editorial card and then `run_auto_cut` (only when the user's
  message said to apply), the keeps are stale and Auto Cut re-proposes inside the just-applied spans (today's behaviour,
  no worse). Fix when needed: keep the created proposal on `StudioTurnState` and subtract its accepted items' spans from
  `sourceKeeps` after a successful `accept_proposal`. The exit run (cards answered by clicks, one card per turn) never
  hits it.
- Note (step 4): the Auto Cut card of a clip whose editorial card is applied now headlines "−X s of <seconds still on
  the timeline>"; the plan file's `stats.removedDuration`/`sourceDuration` are still whole-source numbers (`cut-planner.ts`
  untouched; nothing user-facing reads them now).
- New (step 3), for the live pass: B3's one Auto Cut true positive (0373 @ 323.198, hard 1/164) will now start
  UNCHECKED on its card, so that pause stays in the produced cut (decision 1's rule; decision 4 allowed the true
  positive to stay — it now stays off the timeline instead). A hard entry at a clip's FIRST segment unchecks the
  leading-silence item `[0, seg0.start]` (keeps the head room tone, no join).

## Do-not-redo

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
