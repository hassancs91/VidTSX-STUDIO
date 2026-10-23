# B7 — Editorial cuts leave no hard entries
status: NEW

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

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Read the code at the five mechanisms above and write, under Done, where each lives (file:line) and
how each of the six track-B-exit hard entries arises in it; then write the failing unit tests from
those six cases.

## Open problems

(none yet)

## Do-not-redo

- B6's measurement and the track-B exit's numbers are the baseline (overlap 90.51 %; 6 / 146 hard
  entries on the produced cut; lead-in 0.150 vs 0.150 s, tail 0.220 vs 0.214 s). Don't re-run B6.
- Never modify `b-root`, `profiles\source`, Hasan's stations (`B1-verify-root` + `profiles\B1-verify`,
  `B5-station-root` + `profiles\B5-station`), or the editor repo.

## Agents so far (date · approx tool calls · what they covered)

(none yet)
