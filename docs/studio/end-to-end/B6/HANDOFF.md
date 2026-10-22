# B6 — The content measurement: Auto Cut + editorial on all nine clips vs `cuts.json`
status: FIX (verifier round 1 FAIL: flags 4/6 not 5/6; miss-list float boundary — record only, see Next step) — was: DONE — the real run measured (overlap 90.5 %, miss list, proposed bar in Status.md 2026-10-23 + TESTING §18.12); gates green

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

Step 1 (builder #1, 2026-10-22, no `src/` change; kit gitignored under `.vidtsx-temp/end-to-end/B6/`):

1. **Material (decision 2).** `C:\Users\hasan\AppData\Local\vidtsx-e2e\B6-root\projects\video-14-raw`
   = a `cp -r` of `b-root\projects\video-14-raw` (580 MB; `project.json` sha256 `ebe94fd7…3dda`, equal
   to b-root's, still equal after step 1 — nothing opened yet). Profile
   `…\vidtsx-e2e\profiles\B6\profile` = a copy of `profiles\source\profile` (377 MB, 2,328 = 2,328
   files). Outputs folder `…\vidtsx-e2e\B6\` (`app.log`, `measure-synthetic\`). Disk before the
   copies: C: 15.91 GB / D: 31.49 GB; after the launch C: 15.52 / D: 31.59. The copy still carries
   b-root's `agent-chat.json` and timeline — reset both in step 2 (it is scratch).
2. **Kit:** `launch.sh` (CDP 9331, profile above, log `…\B6\app.log`; unsets `ELECTRON_RUN_AS_NODE`
   **and every `CLAUDE*` / `ANTHROPIC*` env var** — this agent's shell exports `CLAUDECODE`,
   `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_MESSAGING_SOCKET/TOKEN`, … which
   the app's `claude.exe` child would otherwise inherit; no `ANTHROPIC_API_KEY` was set, names checked
   only), `cdp.mjs` (B5's, port 9331), `probe.mjs ready|providers|turn` (readiness + `studioRootSet`
   to B6-root; provider list through the app's IPC, safe fields only; one keyless turn).
3. **How the assistant's provider is chosen (code):**
   - `src/main/services/studio/studio-agent.ts:76-84` — a turn uses `req.providerId` (the project's,
     sent by `src/features/studio/hooks/useStudioAgent.ts:226,249`) when registered, else the app's
     active provider (warn "Project provider not registered — using app default").
   - `src/main/services/llm-init.ts:82-90` + `:117-128` — with NO saved provider configs,
     `buildDefaultConfigs` registers the keyless `claude-subscription` and `local`, both enabled. With
     saved configs (`:44-80`) `claude-subscription` is registered only if saved (the presets loop
     registers only `local` and shared-key presets) — not our case.
   - `src/engine/presets.ts:4-10` — `claude-subscription` = type `agent-sdk`, authMode
     `subscription`, default model `claude-sonnet-5-5`. `src/engine/providers/claude-provider.ts:68-89`
     — no baseURL / no apiKey → empty env → no `env` option (`:164-167`), so the bundled `claude.exe`
     inherits main's `process.env` (hence the launcher's strip); `settingSources: []` (`:158`).
   - On the B6 profile: `llmProvidersGet` → saved providers `[]`, `activeProvider:
     "claude-subscription"` — **the keyless provider IS the app default on this profile as it is.**
     Step 2 must still check the project's `settings.agent.providerId` (absent, or
     `claude-subscription`; b-root never set a `b4-no-model`-style id as far as step 1 saw — verify).
4. **One probe turn (allowed):** `window.api.llmGenerate({ prompt: 'Reply with the single word OK.',
   providerId: 'claude-subscription' })` → `success: true`, text `OK`, model `claude-sonnet-5-5`,
   1 turn, wall 8,495 ms (API 5,487 ms), tokens in 901 / out 13; the SDK's notional `costUsd` 0.2313
   (claude-haiku-4-5 899/9 $0.0009 — the SDK's own side call; claude-sonnet-5-5 2/4 $0.2304, i.e. the
   system-prompt cache write). Keyless: no key anywhere in the env, `settingSources: []`, no
   credential file read or copied by us. **Not BLOCKED.**
5. **`measure.py`** (`python -I -B`, imports `cutlib` read-only for `active_keeps` only, refuses an
   out-dir inside the editor repo): input `{"items":[{"clip":"0370","kind":"autocut"|"editorial",
   "s":…, "e":…}]}` in raw-clip source seconds; per clip + total H, P, P∩H, overlap, precision (all /
   autocut / editorial); misses H \ P ≥ 0.3 s labelled `cat` of the overlapped `cuts[]` entry, else
   `pause` (gap `t: silence`), else `unlisted` with `where` = `head` / `gap:clip_end` / `gap:cut` /
   `in-keep`, plus the words inside; false cuts P \ H ≥ 0.3 s labelled `fluff:<status>` /
   `content` / `pause-in-keep` with their words, and `false_by_label_all` (every P \ H second, any
   length — Auto Cut compresses pauses INSIDE his keeps, which H does not count, so read precision
   with and without `pause-in-keep`); `judgment.flags` (each flag → the `cuts[]`/`keeps[]` entry it
   quotes within [at−5, at+15] s, its proposed fraction) and `judgment.fluff` (proposed fraction per
   suggestion). Words from Hasan's `work/transcripts/<clip>.json` (read-only). Outputs →
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\B6\measure\measure.json` by default.
   **H on video-14 = 813.315 s** of 1,283.0 s raw (his keeps = ~470 s; review.md's tight = 484 s).

Step 2 (builder #2, 2026-10-22/23, no `src/` change; kit gitignored; docs commit `30e52b2`):

6. **Setup** (`node run.mjs setup` on the relaunched app): root = B6-root, `video-14-raw` open, nine clips added to V1 in
   raw order → **1,283.148 s**; `settings` = `{width 3840, height 2160, fps 60, agent: {}}` (no providerId, no preset, no
   cutStyle → app default `claude-subscription`, cut style tight · default); 0 proposals; `agent-chat.json` already empty
   (0 messages); transcripts ready 27/44/97/207/183/602/40/330/290 = 1,820 words.
7. **The run** (`run.mjs loop "Cut this video."`, then `loop --resume`, `loop --continue`, `loop "Yes, run Auto Cut for the
   pauses on all nine clips."`): 17 turns, all `claude-sonnet-5-5`. Turns 1–8 = editorial (`get_transcript` +
   `propose_cuts` per clip; 0374 read in turn 7 with 0375, no cuts); turn 8's reply stopped and offered "run Auto Cut for
   the pauses, then plan shots and captions" → turn 9 typed (the user's yes, cut only) → turns 9–17 = one `run_auto_cut`
   per clip ("style tight · default"); turn 17 offered shots/captions (not taken). Every card captured BEFORE answering
   (`proposals-raw.json`), then Apply (real click; 0369's lone-fluff card had "Apply 0 cuts" disabled → "Reject all"; 0373's
   card "Apply 11 cuts" = 11 of 12, the fluff unchecked). Model time 337 s; tokens in 57,067 / out 17,621 / cache-read
   2,524,453; SDK notional $3.89. Final scratch edit 509.149 s (196 clips). One pass of the two allowed.
8. **The measurement** (`python -I -B measure.py …\B6\run\proposals.json …\B6\measure` and `proposals-accepted.json →
   …\B6\measure-accepted`): overlap **0.9051**, precision 0.9489 (accepted-only 0.9049 / 0.9510); autocut 0.6783 / 0.9397;
   editorial 0.4842 / 0.9893; misses by cat {retake 4 / 5.153, repeat 4 / 5.133, manual 1 / 9.699, dead_air 1 / 4.03,
   filler 1 / 1.036, pause 31 / 12.957, unlisted 8 / 3.42}; false ≥ 0.3 s 35.679 s = pause-in-keep 44 / 33.997 + content 7 /
   4.271 + fluff:suggested 3 / 1.395. Written up in Status.md (2026-10-23 B6 row) with the proposed bar, and TESTING §18.12.
9. **Driver bug found and fixed (not product):** the first loop read the Assistant's `agent` props from the textarea's
   `__reactFiber$` — a STALE alternate: busy / pending stayed frozen at "I proposed cuts for" for ~12 min while main had
   finished the turn in 25.9 s (the AI-usage row, 20:55:04Z, and a visible Send button proved it). `run.mjs` now reads
   busy from the visible Stop button and the props from `root.current` downward (`findCur`); evaluate calls time out and
   reconnect; `wake()` restores the window (`restore.ps1`) and sets `Page.setWebLifecycleState active` once a minute.
   DRIVING.md "Learned" 2026-10-23 · B6.

## Verified (exact commands + outputs)

- Step 2: `node run.mjs setup` → `length s 1283.148 settings {"width":3840,"height":2160,"fps":60,"agent":{}} proposals 0`;
  loops → `…\B6\run\loop1.log` … `loop5.log` (loop1/2 = the stale-fiber driver, killed by their own command line
  `run.mjs loop`; loop3 recorded turns 1–2; loop4 turns 3–8 ending "applied, no auto-continue (no [next:] marker)"; loop5
  turns 9–17, same end). `turns.jsonl` 17 lines.
- `python -I -B measure.py C:/Users/hasan/AppData/Local/vidtsx-e2e/B6/run/proposals.json C:/Users/hasan/AppData/Local/vidtsx-e2e/B6/measure`
  → totals `H 813.315 P 775.769 PH 736.106 overlap 0.9051 precision 0.9489 autocut 0.6783/0.9397 editorial 0.4842/0.9893`.
- App stopped: launcher `node … electron-vite dev -- --user-data-dir=C:/…/profiles/B6/profile --remote-debugging-port=9331`
  tree `taskkill /T /F` → `left: 0` (filter `--remote-debugging-port=9331` / `profiles/B6/profile`). C: 15.64 / D: 31.82 GB.
- `npx vitest run` (app stopped) → `Test Files 465 passed | 5 skipped (470)`, `Tests 3920 passed | 34 skipped (3954)`, exit 0,
  first run; log `C:\Users\hasan\AppData\Local\vidtsx-e2e\B6\vitest-run1.log`. `npm run check:types` → web 26 (baseline 26)
  ok, node 10 (baseline 10) ok.
- Editor repo: `tools/__pycache__` newest 2026-10-16. `b-root` `project.json` sha256 starts `ebe94fd77f178959` (unchanged).
  `git status` clean before the docs commit (no `src/` change).

- `python -I -B .vidtsx-temp/end-to-end/B6/measure.py --selftest` → `selftest OK: P=H, P=empty,
  P=keeps, 0370 hand case; H total 813.315 s over 9 clips; 0370 miss {… 's': 3.0, 'e': 7.732, 'cat':
  'retake' …}; false {'clip': '0370', 's': 8.0, 'e': 9.0, 'label': 'content', 'text': 'Last week I
  built this'}` (asserts: P=H → overlap 1.0 / precision 1.0 / no misses / no false; P=∅ → overlap
  0, misses = all H spans ≥ 0.3 s; P=keeps → overlap 0, precision 0; the hand case's exact numbers).
- `python -I -B measure.py synthetic-proposals.json C:/…/B6/measure-synthetic` (0370 autocut 0–3,
  editorial 8–9; 0373 editorial 33.0–37.3 = fluff #1; 0366 autocut whole clip) → `overlap 0.0287
  precision 0.8171 H 813.32 s P 28.59 s P∩H 23.36 s`; autocut precision 1.0, editorial 0.0132;
  per clip 0366 1.0/1.0, 0370 0.0587/0.75; false cuts = `content` 1.0 s + `fluff:suggested` 4.23 s;
  fluff #1 proposed_fraction 1.0. Flags map to: 1 → 0375 143.41 keep ("and he's sharing…"), 2 →
  0373 112.306–121.903 cut ("So this boilerplate…"), 3 → 0373 365.551–370.432 cut ("Just the first
  scan…"), 4 → 0375 32.99 keep, 5 → 0376 78.186 keep, 6 → 0373 91.276 keep — 2/3/6 checked by text;
  4 and 5 are nearest-entry guesses (eyeball them when writing STATUS).
- `ls -la tools/__pycache__` in the editor repo: newest file 2026-10-16 — nothing written by B6.
- `node probe.mjs ready` → ready after 24.7 s, root `C:/Users/hasan/AppData/Local/vidtsx-e2e/B6-root`;
  `node probe.mjs providers` → `{"active":"claude-subscription","providers":[]}`;
  `node probe.mjs turn` → as Done 4.
- App stopped: processes selected by `--remote-debugging-port=9331` / `profiles/B6/profile` only,
  `taskkill /T /F` on the launcher's node → `left: 0`.

## Next step (ONE concrete instruction)

**FIX round 1 (orchestrator, 2026-10-23, after the verifier's FAIL — docs + the scratch measure
script only; NO new model run, NO app launch):**
1. **Flag 4 was cut, not "untouched"** — flag 4 = clip 0375 @00:30 "'Please focus.' … default
   keep", his keep 30.500–31.255; the run's editorial `false_start` item 28.909–31.700 "Please
   focus." (status accepted) covers it, plus Auto Cut 28.909–30.350 / 31.375–31.700. Correct count:
   **4 of 6** at his default (1, 3, 5, 6 at default; 2 (default cut) not proposed; 4 (default keep)
   cut). Fix Status.md (~:50-53 — line 50-51 already lists "Please focus." as a false cut, line 53
   contradicts it; ~:68-69 the failed-bar list must now include the flags item) and TESTING.md
   (~:447, ~:449 "5 / 6 ✓" → "4 / 6 ✗"). Match flags by their quoted text + clip + time, not nearest
   entry.
2. **Miss-list boundary:** spans of exactly 0.300 s were dropped when float gave 0.29999999999999716
   (0376 119.084–119.384 unlisted; 0376 122.840–123.140 pause). Fix `measure.py` (compare in integer
   ms or with an epsilon) and re-run it on the SAME captured `proposals-raw.json` → expected **52
   spans / 42.03 s**, pause **32 / 13.26 s**, unlisted **9 / 3.72 s**, slivers **35.18 s**, pause median
   **0.38 s**, pause range **0.30–0.64 s** — record the re-run's own numbers, and fix Status.md
   (~:39, ~:48-49, ~:63) and TESTING.md (~:447).
3. **Minor (correct them):** "content 7 / 4.3 s" is labelled "P \ H ≥ 0.3 s" but counts ALL
   editorial P\H pieces (incl. 0.05 s and 0.17 s) — at ≥ 0.3 s it is 5 / 4.05 s (accepted only 3 /
   2.30 s); say which one each number is. Model time 222.723 + 114.441 = 337.164 s. Clip 0366 overlap
   79.15 %.
4. **Add (verifier finding, not recorded):** Auto Cut ran AFTER the editorial cuts were applied but
   planned over the whole source — 199.5 s of its 587.1 s fall inside already-applied editorial
   spans (94 of 261 items wholly), so its card headlines (e.g. 0373 "−171.2 s of 396.3 s") count
   seconds already removed. A follow-up finding for STATUS (not fixed in B6). Also say in the bar
   paragraph how "≤ 6 s total" was derived (today 11.32 s; 2.93 s left after the fixes named for the
   overlap bar), and that the bar now fails 4 of 5 items today (overlap, content misses, false cuts,
   flags) and passes precision.
5. Gates are unaffected (no src change) — say so; update HANDOFF.md (status DONE, fix round 1), one
   LOG.md line, commit (ending with the line "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"),
   return DONE.

(Previous text, kept:) B6 is DONE: the orchestrator sends a verifier (the exit is a measurement — let it rebuild H and P independently from
`…\B6\run\proposals-raw.json` and cuts.json, with its own negative/control cases) and puts the proposed bar to Hasan.

(Step 1's instruction, done in step 2, kept for the record:) Relaunch (`bash .vidtsx-temp/end-to-end/B6/launch.sh` from a background Bash call, then
`node probe.mjs ready`), and on B6-root's `video-14-raw` — app CLOSED on the project while editing
disk, or through the app — reset `agent-chat.json`, confirm `settings.agent.providerId` is absent or
`claude-subscription` and the resolved cut style is tight, lay all nine clips on V1 in raw order
(B5's long project: 1,283.148 s, see B5 HANDOFF / `B5/drive.mjs`), then write `capture.mjs` that
snapshots every proposal on the project (proposal items' clip + `sourceStart/sourceEnd`, kind
Auto Cut vs editorial) into `…\vidtsx-e2e\B6\run\proposals.json` in measure.py's format, and run the
real pass in the Assistant tab with real input — prompt exactly `Cut this video.` (record it, every
turn, model, wall time, usage from `debugLog`/`usage`); capture BEFORE any apply; then
`python -I -B measure.py …\B6\run\proposals.json`.

## Open problems

- **Verifier round 1 — FAIL (2026-10-23), record only:** flag 4 cut (4/6 at default, not 5/6 — the
  bar's flags item fails today); the miss list dropped two exactly-0.300 s spans to float (52 / 42.03 s,
  not 50 / 41.4 s); "content 7 / 4.3 s" mislabelled as ≥ 0.3 s; model time split; 0366 79.15 %.
  Everything else PASSED independently: H 813.315 s, P 775.769 s, P∩H 736.106 s, overlap 90.507 %,
  precision 94.887 % (99.25 % w/o in-keep pauses), accepted-only, Auto Cut alone 67.833 %, editorial
  alone 48.425 %, per-clip overlaps, content-category misses, the capture (17 cards = project.json
  proposals = turn log; 39 + 261 items), the keyless provider only (`claude-subscription` /
  sonnet-5-5, no key provider), controls (∅ → 0 %, H → 100 %, all → 63.391 % precision, ±1 s shift →
  lower). Hard entries confirmed: editorial 8 / 42 joins vs Auto Cut 1 / 164; editorial-first order
  confirmed (the app's workflow puts `run_auto_cut` first, `studio-agent-prompt-tools.ts:64-67`).
  Sensitivity: 4.519 s of his own `cuts[]` sit inside his active keeps (with them in H: 90.48 % /
  95.38 %). The verifier copied the B6 profile's `settings.db` into the orchestrator's scratchpad
  (never read — classifier blocked); the orchestrator deleted that copy.

- (for Hasan) **Confirm or change the proposed next-round bar** (Status.md 2026-10-23 B6 row; TESTING §18.12): overlap ≥ 92 %;
  retake + repeat + filler + false_start misses ≤ 6 s, none > 1.5 s (flagged judgment calls excepted); false content cuts
  ≤ 3 s; precision without pause-in-keep ≥ 99 %; ≥ 5 of 6 flags at his default.
- (findings, not fixed — B6 is a measurement) cross-clip retake invisible to the per-clip pass (0366); four doubled-phrase
  first deliveries kept; a 3.8 s phantom "M" token keeps 4 s of dead air through both passes (0376 168–172); "Cut this
  video." → editorial first, Auto Cut only offered; editorial joins: hard entries 8 of 42 (E2's "hard entries 0" — the
  join-geometry half — is not met on editorial joins).
- (eyeball) flags 4 and 5 are mapped to the nearest `keeps[]` entry by `measure.py` (step 1 note); both read 0 % proposed
  either way.
- (note, not blocking) The SDK reports a notional `costUsd` even on the subscription ($0.23 for the
  1-turn probe, mostly a system-prompt cache write); on a subscription it is not billed per token
  but counts against Hasan's plan limits. Record `usage` for every turn of the real run (decision 1
  caps it at two full editorial passes).
- (definition) H counts only time OUTSIDE his keeps; his tight plan also compresses pauses ≥ 0.4 s
  INSIDE keeps. Those Auto Cut spans show up as `pause-in-keep` false cuts — report precision both
  with and without them in STATUS.

## Do-not-redo

- B1–B3 DONE; B4/B5 WAITING-HASAN — never touch their stations (`B1-verify-root` +
  `profiles\B1-verify`; `B5-station-root` + `profiles\B5-station`). Track A DONE. Do not touch
  `main`. The editor repo is READ-ONLY.
- Step 1 done: the B6 copies exist (do not re-copy); the provider question is answered (keyless
  `claude-subscription` is the B6 profile's default and ran a turn — do not probe again);
  `measure.py` + selftest exist.
- Step 2 done: the ONE real pass ran (17 turns) and is applied on B6-root's scratch — do not run another pass to "improve"
  the numbers (decision 1 allows one retry only for a FAILED pass; this one completed). Re-measure from
  `…\B6\run\proposals.json` / `proposals-raw.json` instead.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~40 · step 1: B6 copies + profile, launcher (env strip), provider choice
  from code, one keyless probe turn (OK, 8.5 s), `measure.py` + selftest + synthetic run.
- 2026-10-22/23 · builder #2 · ~95 · step 2: setup, the real 17-turn pass (stale-fiber driver bug found and fixed in the
  kit), measurement, gates, Status.md row + TESTING §18.12 → DONE.
