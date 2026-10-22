# B6 — The content measurement: Auto Cut + editorial on all nine clips vs `cuts.json`
status: NEW

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety, disk rules, the RESERVED stations,
the vitest gate rules, every "Learned" line incl. the 200 ms project.json poll rule, the
process-kill lesson) and the **"Track B decisions"** section of
`docs/studio/end-to-end/ORCHESTRATOR.md`. B1–B3 DONE; B4 and B5 WAITING-HASAN — read their Status.md
rows (top of `Status.md`): B2 makes Auto Cut, `run_auto_cut`, the editorial snap and Transcript
deletes use the project's resolved cut style (tight = Hasan's fitted tight by default); B3 puts hard
entries / tails on a release on the cut cards.

**Never hand back while a job you started (the app, an agent turn, a check) is still running —
wait for it inside your own session.**

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **B6** | The content measurement: Auto Cut + editorial on all nine clips vs `cuts.json` — proposed cut seconds ∩ his cut seconds / his cut seconds, and the spans he cut that the pass did not propose, listed by category | the overlap number and the miss list recorded in STATUS; **the bar for the next round is set from this run**, not invented here |

Session gates (plan §3 head): `npx vitest run` green (DRIVING.md rules), `npm run check:types` at or
below baseline (web 26 / node 10), a live CDP click-through (the real assistant run IS the
click-through), the Status.md row (git: `Status.md`), the TESTING.md §18 block (`### 18.12 B6`).
B6 is a MEASUREMENT: code changes only if the measurement needs a small tool (or a real bug blocks
the run).

## Plan context (§1.x facts, §2 decision, §5 items to read)

- **§0 E2:** "The cut lands where Hasan's hand audit landed — Auto Cut + editorial on the nine raw
  clips vs `cuts.json`; join geometry at every cut vs his fitted style — hard entries 0; median
  lead-in / tail at joins within ±30 ms of the fitted tight; content overlap reported, bar set after
  the first run (§3 B6)." B6 owns the content-overlap half.
- **§1.1:** the Auto Cut button / `run_auto_cut` / the editorial pass (`propose_cuts` →
  `snapEditorialCuts`, `cut-tools.ts`) — after B2 all on the resolved style; the editorial pass is
  the Studio assistant (an LLM turn) following the `studio-clean-cut` skill (§1.2: "a faithful port
  of the reference clean-cut policy (slates outrank, always cut retakes, doubled phrase cuts the
  first, fluff suggest-only, the transcript lies about time) plus two rules of its own").
- **Hasan's reference (READ-ONLY):** `D:\repos\claude-youtube-editor\videos\video-14\work\analysis\cuts.json`
  — per clip `keeps[] {s, e, text, gap{d, t}}` and `cuts[] {s, e, cat, text, note}` (`cat` e.g.
  `retake`, `repeat`, …), `fluff_suggestions[]`, top-level `flags[]` (judgment calls); `review.md`
  beside it (raw 21:23 = 1283 s; estimated tight 08:04 = 484 s). Use cutlib's `active_keeps` for
  what he KEPT (Python `-I -B`, read-only, the B1 pattern `.vidtsx-temp/end-to-end/B1/cutlib_joins.py`).
- **The 2026-10-22 lessons:** an assistant turn uses the user's provider; the isolated profiles so
  far had NO provider configured (B4/B5 used an unregistered provider id on purpose).

## Orchestrator decisions (DECIDED — follow them; raise objections under Open problems)

1. **The model call is allowed in B6 — on Hasan's Claude subscription** (his overnight instruction,
   ORCHESTRATOR "Stops" 2026-10-21 ~23:20: "the editorial pass runs on his subscription from a COPY
   of his settings on an isolated profile"). **Use only the app's own keyless Claude provider**
   (Agent SDK / bundled `claude.exe`, the path the app itself takes) on the isolated B6 profile.
   **Do NOT read, copy or inspect any credential store** — not `%APPDATA%\VidTSX Studio` (his
   `settings.db` holds encrypted provider credentials), not `~/.claude` credential files, not any
   other profile's `settings.db` (the permission classifier refused this plan as credential
   exploration; respect that). If the keyless provider cannot run a turn on the isolated profile
   as it is, STOP and return BLOCKED with what it needs — Hasan decides. Never use a paid API key
   provider. Bound the spend: at most two full editorial passes (one + one retry); record model,
   turns, wall time and any usage numbers the app logs.
2. **Material:** a NEW scratch copy `C:\Users\hasan\AppData\Local\vidtsx-e2e\B6-root\projects\video-14-raw`
   (from the shared `b-root`) + profile `…\profiles\B6\profile` (from `profiles\source`), CDP 9331.
   The timeline = all nine clips on V1 in raw order (the B5 "long project"). Check C: > 5 GB first.
3. **The run:** through the real Assistant tab with real input — ask for the edit the way Hasan
   would ("cut this video" / the clean-cut pass; record the exact prompt), let it run Auto Cut and
   the editorial pass, and capture every proposal it makes (proposal items' source spans per clip).
   Do NOT apply anything you have not captured; applying on the scratch is allowed after capture.
   If the assistant stops between steps ("never chain past an open proposal"), continue it the way a
   user would and record each turn.
4. **The measurement (a scratch script, outputs on C:), per clip and total:** H = Hasan's cut
   seconds = the clip's raw time NOT inside his active keeps; P = proposed cut seconds = the union
   of the run's proposal spans (Auto Cut + editorial) in source time. Report **overlap = |P ∩ H| /
   |H|** (the exit number), also precision |P ∩ H| / |P|, and the same two for Auto Cut alone and
   editorial alone. **Miss list** = the maximal spans of H \ P of ≥ 0.3 s, each labelled with the
   `cat` of the `cuts[]` entry it overlaps, else `pause` (inside a keep gap `t: silence`), else
   `unlisted`; totals by category (count, seconds). Also the **false-cut list** P \ H (spans the
   pass removed that he kept), ≥ 0.3 s, with their text. Account separately for the `flags[]`
   judgment calls and `fluff_suggestions` (suggest-only in his policy).
5. **The bar for the next round:** from the numbers, propose a concrete next-round bar (e.g.
   "overlap ≥ X % with no `retake` miss > Y s, false cuts ≤ Z s") with a one-paragraph reason, in
   STATUS — labelled as the proposed bar; Hasan confirms it later.
6. **No product changes to make the numbers look better.** If the run exposes a bug that blocks the
   measurement (crash, a tool error), fix it test-first and say so; policy/prompt quality issues
   are findings for STATUS, not fixes in B6.

## Done (file:line, commit hashes)

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Set up the B6 scratch copy + profile (decision 2), find out from the provider CODE how the
assistant's provider is chosen for a project and whether the keyless Claude provider can run a turn
on the isolated profile as it is (one tiny probe turn is allowed; no credential files read or
copied — if it cannot, return BLOCKED), and
write `.vidtsx-temp/end-to-end/B6/measure.py` (or `.mjs`) that computes H per clip from `cuts.json`
with cutlib's `active_keeps` and can take a proposals JSON — test it on a synthetic proposal set —
then hand off before the real run.

## Open problems

(none yet)

## Do-not-redo

- B1–B3 DONE; B4/B5 WAITING-HASAN — never touch their stations (`B1-verify-root` +
  `profiles\B1-verify`; `B5-station-root` + `profiles\B5-station`). Track A DONE. Do not touch
  `main`. The editor repo is READ-ONLY.

## Agents so far (date · approx tool calls · what they covered)

(none yet)
