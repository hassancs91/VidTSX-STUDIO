# Assistant timeline read — orchestrator state

> Run brief: Hasan's paste-in in `docs/studio/assistant-timeline/NEXT-SESSION.md` (the fenced "Paste-in" block, :24-126),
> following `docs/studio/END_TO_END_RUN.md`'s loop (builders with the 30 % hand-off rule, an independent verifier, ≤ 3 FAIL rounds,
> the stop report, "things you never do") with the paste-in's overrides. Parts T1 → T3 run in order with NO stop between them unless a
> STOP rule fires (a BLOCKED builder, three verifier FAILs, or T3's PASS).

- Branch: `library-search` (not pushed, not merged; its S4 PASS is recorded at `cf7d550`), worktree
  `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt`. This slice adds to it from `0df9e9c` (the NEXT-SESSION paste-in commit).
- Code base at the start: `git log -1 -- src/` = `3f08759` (library search S3). Gates there (S4 verifier round 1): worktree vitest
  `Test Files 28 failed | 509 passed | 6 skipped (543)` = the 25 LS-r1c + 3 E-d2a suites; tsc web 25 / node 10.
- Start state (15:45–15:52 +0200, 2026-10-30): main checkout `end-to-end-p0` @ `5d77600` still lists the other session's 20 changed paths
  (14 ` M` + 6 `??`; untouched); **Hasan's dev app NOT running** (0 `electron.exe`, no VidTSX process); the decision-models worktree
  `.vidtsx-temp\decisions\wt` did not exist at 15:45 and exists at 15:52 (`c14b180`, branch `decision-models` — that session started;
  never touched; 0 `electron.exe`, so none of its instances on 9300–9309 run); this worktree `git status --short` clean at `0df9e9c`.
  Resources 15:45: C: 29.4 GB, D: 39.6 GB, memory commit 61.2 / 99.7 GB (headroom 38.5 GB).

| Part | Status | Builders spawned | Verifier result | Commit | Numbers | Started / Finished |
|---|---|---|---|---|---|---|
| T1 — the design note + THE BAR (orchestrator) | **DONE** | — | — | `docs/studio/ASSISTANT_TIMELINE_DESIGN.md` `b382288` | the bar = design §8 (unit 1–7, gates, the smoke, the four turns: ≥ 3 / 4 place the allowed clip starting in [2.00, 3.10] s, 0 claims, 0 generated) | 2026-10-30 15:52 / 15:57 |
| T2 — build (red-first, hand-off-sized) | BUILDING | 4 | — | step 1 `307f96f` · step 2 `99c35b1` · step 3 `cf4fb0c` `021a2d6` | — | 2026-10-30 15:58 / |
| T3 — verify (independent; ≤ 3 FAILs) | TODO | — | — | — | — | |

## Answers in force (Hasan's paste-in, 2026-10-30)

- **SCOPE ("lets do the 3"):** (1) a `get_timeline` read tool — every lane's clips (timeline start / end, source in / out, asset), the cut
  points (joins) on the master video track, gaps, the shots / overlays / audio over them; compact, paged / capped so a long project
  (video-14) never floods the context; (2) one line in the system prompt's "State of the edit" (the first few cuts, capped, "+N more");
  (3) a cut anchor for `insert_asset`: `at: { cut: n, offset? }` (n 1-based along the master track; offset seconds, negative = before)
  resolved in code — preferably to `{ anchorAssetId, sourceStart }` on the clip after the cut so it survives later edits; out of range /
  no cut → a plain error naming the cut count. The prompt lines pinned by tests.
- **T1** = the orchestrator's design note `docs/studio/ASSISTANT_TIMELINE_DESIGN.md` with THE ACCEPTANCE BAR, fixed before any verifier.
  **T2** = build, red first, (1) → (2) → (3); rebuild `wt/out`; the builder's own CDP smoke (open the 2-clip project, one `get_timeline`
  call through the real handler, NO model turn); the full gates; no Status.md / TESTING.md records in T2. **T3** = an independent
  verifier (the bar + the commit range + DRIVING's safety rules, never the builders' conclusions), ≤ 4 keyless turns per round; reports
  come back as text and the orchestrator saves them; past ~60 calls → INCOMPLETE + a continuation that reads only that report; three
  FAILs → stop. On PASS: Status.md entry at the top + TESTING.md **§19.5** (inside §19; §18.18+ reserved for tracks C / D / F) + the
  LS-r8 line in `docs/studio/search/ORCHESTRATOR.md`; then STOP with the stop report.
- **Overrides:** model calls only the verifier's ≤ 4 keyless `claude-subscription` turns (+1 retry each on an API error); no paid-key
  call; no other model / provider call (never choose "Smart + AI rerank" live — LS-r7); never read / copy / open a credential store
  (`settings.db*`, `~/.claude`, any profile's). Isolated profiles only. Never Hasan's `%APPDATA%\VidTSX Studio` library or projects,
  his stations (`B1-verify-root`, `profiles\B1-verify`, `B5-station-root`, `profiles\B5-station`) or B6 / B7 scratch; `profiles\E3`,
  `profiles\source`, `profiles\search-*` are read-only. Never the decision-models session's worktree, profiles or ports (9300–9309).
  Resource guard (C: ≥ 3 GB, C: + headroom ≥ 6 GB; `--maxWorkers=2` while headroom < 10 GB; DRIVING's load rules / E-d13). Work only in
  this worktree; never npx / npm there; never git stash; no new npm package. DEFERRED-HASAN for anything needing his hands / ears / keys.
  The orchestrator writes only docs, commits after each update, logs real-clock times, commits nothing while a builder or verifier runs;
  never push, never merge.
- **Ports / profiles:** builders `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\timeline-T\profile` (CDP 9296); the verifier
  `profiles\timeline-verify\profile` (CDP 9297; round N → `timeline-verifyN`). Either may be a copy of `profiles\search-S4-verify\profile`
  WITHOUT `settings\settings.db*` (model, Smart, the 51-clip library), or a fresh copy of `profiles\source\profile`; library root
  `<profile>\assets`; Studio root set in the first CDP call. The 2-clip test project: a copy of
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S4\r1\p2\pristine\` (+ its clip `…\search\S4\r1\media\e3v-clip.mp4`, read-only sources)
  in the agent's own scratch root. Kits `D:\repos\VidTSX-STUDIO\.vidtsx-temp\timeline\<PART>\`; big outputs
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\timeline\<PART>\`.

## Stops

(one line per stop: what was reported, what Hasan said)

## Log

- 15:45 · start checks: main checkout's 20 uncommitted paths still there; Hasan's dev app not running (0 `electron.exe`); no
  `.vidtsx-temp\decisions\wt` yet; worktree clean at `0df9e9c`; C: 29.4 GB, D: 39.6 GB, headroom 38.5 GB.
- 15:52 · `.vidtsx-temp\decisions\wt` now exists (`c14b180`, the parallel session) — not ours, never touched. This file created; T1
  (the design note) starts.
- 15:52–15:59 · **T1 — the design note** `docs/studio/ASSISTANT_TIMELINE_DESIGN.md` written by the orchestrator: one shared model (§2 —
  the master = `masterLane`; a cut = a join where the picture changes, a through edit (continuous split) is not one, gaps listed apart,
  cuts numbered over the whole timeline); `get_timeline(fromSec?, toSec?)` (§3 — the exact text for the 2-clip project; caps 40 master
  clips / 20 per other lane, the `+N more … get_timeline(fromSec: x)` line); the cuts line from a new request field `timelineCuts`
  computed by the renderer with the same shared function (§4); the cut anchor (§5 — offset ≥ 0 → the clip after the cut, < 0 → the clip
  before, kept as `{ anchorAssetId, sourceStart }` only when the shared source→timeline mapping lands it on `t` within 1 ms, else the
  fixed `{ timelineStart }`; the exact errors); the prompt lines (§7); **§8 THE ACCEPTANCE BAR** (unit 1–7, gates, the smoke, the four
  turns with the [2.00, 3.10] s window and ≥ 3 / 4 placing). Facts checked for it: `mapCutItemToTimeline`
  (`features/studio/services/cut-proposal.ts:44-67`) ignores speed and takes the first region over ALL tracks — hence the mapping check;
  no `insert-tools.test.ts` exists — hence the characterization tests first; video-14's copy = V1 35 video clips + 55 TSX shots on one
  overlay lane + A1 empty (the caps fit it in one page). `T2/HANDOFF.md` + `LOG.md` created. T2 builder #1 to spawn. (Clock: the
  commit `b382288` landed at 15:56:49; this entry first said "15:59", an estimate — corrected.)
- 15:58 · T2 builder #1 spawned (HEAD = this commit). Brief: END_TO_END_RUN's builder brief adapted to this slice + the paste-in's "every
  builder brief adds" (kept below under "Builder brief" so a resumed session reuses it verbatim).

- 16:10 · **T2 builder #1 HANDOFF** (49 calls, ~12 min; **§9 step 1 DONE**): `307f96f` — `src/shared/studio/timeline-cuts.ts` 130 (the §2
  model, `summarizeMasterCuts`, `formatTimelineTc`; exported via `src/shared/studio/index.ts`), `agent-tools/timeline-listing.ts` 165 (§3,
  caps 40 / 20), `agent-tools/timeline-tools.ts` 49 (`get_timeline`, `loadProject`, read-only), `index.ts` (`'get_timeline'` last :70,
  group :104), `studio-agent-prompt-tools.ts:20` (the §7 line before `insert_asset`'s), pins in a NEW
  `studio-agent-prompt-timeline.test.ts`; red 4 files failed / 2 tests → green 5 files / 50 tests; tsc 25 / 10; docs `5a784ac`. Its
  find: any test importing `agent-tools/index.ts` reaches `stream/promises` only through `./flow-tools` → a 26th `<wt>\stream` suite (a
  REAL gate failure) — the pin test mocks `./agent-tools/flow-tools`; tracer `.vidtsx-temp\timeline\T2\stream-chain.mjs`. **Orchestrator
  re-check (16:10):** tree clean at `5a784ac`; `60869b9..HEAD` = 12 files +984 −9 (the step's 10 + HANDOFF / LOG); matcher diff vs
  `7967c6f` empty; the 5 files → 5 passed / 50 tests (16:10:34); 0 `electron.exe`; `timeline-listing.ts:92-124` read.
- **Ruling AT-r1 (orchestrator, 16:12) — a gap never falls between pages:** builder #1's open note "a gap that ends exactly at a page's
  `fromSec` is on neither page" is a loss of information, not a reading of the design: `masterRows` checks the cap (:103) before it
  prints the gap row (:107-110). Fix in step 2's first commit, red first: the gap row (when it intersects the window) prints BEFORE the
  cap check, so page 1 ends with that gap row and then `… +N more`; a §8.1 2 case pins it (and page 2 does not repeat it). The design's
  §3 caps text already says "Gap rows do not count toward the cap" — unchanged. The builder's other small choices (flagless empty-lane
  line, `(nothing in this window)` for a gap-only window, `<kind> clip`, `String()` numbers) are accepted. T2 builder #2 (AT-r1, then §9
  step 2) to spawn.
- 16:13 · T2 builder #2 spawned (HEAD = this commit; the same brief). (Clock: that commit `71c03cf` landed at 16:11:11 and builder #2
  spawned right after; "16:12" / "16:13" above were estimates.)
- 16:17 · **T2 builder #2 HANDOFF** (52 calls, ~6 min; **AT-r1 + §9 step 2 DONE**): `99c35b1` — AT-r1 (`timeline-listing.ts` gap row
  :105-111 before the cap check :112; test `timeline-listing.test.ts:136`, `synthetic()` gained a `gapAt` default, no assertion edited);
  `formatMasterCutsLine` `timeline-listing.ts:177` (`CUTS_LINE_SHOWN` 5); `StudioAgentTimelineCuts` `src/shared/ipc/types/studio.ts:474` +
  `StudioAgentSendRequest.timelineCuts?` :509; `EditorShell.tsx:489` → `useStudioAgent.ts:62,256` → `studio-handlers.ts:552` →
  `studio-agent-prompt.ts:64,96-97`; tests `studio-agent-prompt-timeline.test.ts:44,94`; red 2 files / 8 failed → green 5 files / 59;
  tsc 25 / 10; tracer: `studio-agent-prompt.ts` reaches no `stream` importer; docs `32bcf30`. Over-300 files grown: `EditorShell.tsx` +2,
  `useStudioAgent.ts` +4, `src/shared/ipc/types/studio.ts` +14, `studio-handlers.ts` +1. No handler test for the one-spread pass-through
  (tsc only) — accepted; the four live turns exercise it. **Orchestrator re-check (16:17):** tree clean at `32bcf30`; `71c03cf..HEAD --
  src` = 8 files +157 −8; the renderer / handler / prompt diff read (one field, spreads, the line after `- Timeline:`); the 5 files → 5
  passed / 59 tests (16:17:57); `formatMasterCutsLine` read = §4's strings; 0 `electron.exe`. T2 builder #3 (§9 step 3 — the
  characterization tests FIRST, then the cut anchor) to spawn.
- 16:19 · T2 builder #3 spawned (HEAD = this commit; the same brief). (Clock: `4975581` landed at 16:18:22.)
- 16:31 · **T2 builder #3 HANDOFF** (68 calls, ~13 min; **§9 step 3 DONE**): `cf4fb0c` = ONLY `insert-tools-anchor.test.ts` (7 tests: the
  number path, the `{ word, take }` path, the four word errors, three guards — through the real handler; 7 / 7 on the unchanged
  `insert-tools.ts`); `021a2d6` (13 files +752 −36) — `src/shared/studio/source-span-map.ts` (the mapping core; `cut-proposal.ts:44-53`
  a thin wrapper, `cut-proposal.test.ts` untouched), `agent-tools/cut-anchor.ts` (`resolveCutAnchor`, `cutAnchorLabel`), `timeline-insert.ts`
  (`atLabel`, `insertClipLength` = the clipping rule extracted), `insert-tools.ts` (`{ cut, offset? }`, the load-failure text, the chip),
  `studio-agent-prompt-tools.ts:21` (§7 line) + the tool description clause; tests `source-span-map`, `cut-anchor` (incl. trim
  survival), `insert-tools-cut`, `timeline-insert` (+`atLabel`), the prompt pin, renderer `apply-insert-proposal-cut.test.ts`; red 5 files
  / 12 failed → green 20 files / 178 (`…\vidtsx-e2e\timeline\T2\step3-*.log`); tsc 25 / 10; tracer: `insert-tools.ts` / `cut-anchor.ts`
  reach no stream importer; docs `34de27a`. Its recorded choices (behaviour kept): the chip prints `+0.5s` for a positive offset; a
  near-contiguous join (overlap / gap < 2 ms) falls back to the fixed time when the mapping is > 1 ms off; zod's `min(1)` not exercised
  through the direct handler call (the resolver answers "does not exist" for any unknown n) — all accepted. **Orchestrator re-check
  (16:31):** tree clean at `34de27a`; `cf4fb0c` = 1 file (the characterization test), unchanged since; `insert-tools.ts` untouched in it;
  `4975581..HEAD` test files: 0 lines removed; `cut-anchor.ts` read (= §5: k = 0 / out-of-range / outside-the-clip errors, the side rule,
  `round3`, the 1 ms mapping check, the fixed fallback, the label); the mapping refactor diff read (the same loop, moved); 14 files → 14
  passed / 133 tests (16:31:43); 0 `electron.exe`; C: 28.6 GB, D: 39.3 GB, headroom 33.9 GB. T2 builder #4 (§9 step 4 — build, the smoke,
  the gates) to spawn.
- 16:33 · T2 builder #4 spawned (HEAD = this commit; the same brief).

## Builder brief (T2; every builder gets it unchanged)

```
You are building part T2 of the ASSISTANT TIMELINE READ slice in the worktree D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt
(branch library-search). Read, in order: CLAUDE.md (the worktree's); docs/studio/assistant-timeline/T2/HANDOFF.md (your state:
continue from "Next step", never redo anything under "Done"); docs/studio/ASSISTANT_TIMELINE_DESIGN.md in full (the design and THE
ACCEPTANCE BAR, §8, which an independent verifier will hold you to); docs/studio/end-to-end/DRIVING.md (all of it — "Never touch" and
"Track E", the worktree recipe).

Work only in the worktree; never npx/npm there, never git stash, never touch the main checkout (D:\repos\VidTSX-STUDIO itself holds
another session's uncommitted work: never edit, stage, build or launch there, never its out/ or node_modules). Read
docs/studio/end-to-end/DRIVING.md. Edit HANDOFF.md, Status.md and TESTING.md with the Edit/Write tools only — no Python, node, sed or
heredoc for doc edits. Never hand back while a job you started is still running. Select your own processes by
--remote-debugging-port or profile path plus Name='electron.exe'. Write HANDOFF.md as you go and commit early (explicit paths). Every
git / tree / build statement in the records is 'as of <hash>' and re-checked after the commit. Numbers in prose come from the report
files.

Rules. House rules (CLAUDE.md): feature isolation, IPC-only bridge, services own logic, ~300 lines per file, no `any`, no new npm
package, exact-pinned Remotion. Red first: write the failing tests, run them, see them fail (record the counts), then the code. Design
§8.1 5: the insert_asset number / word characterization tests are written, GREEN on the unchanged insert-tools.ts, and committed BEFORE
you change that file. Tests from the worktree root: node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run <files>; types:
node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit (and -p tsconfig.node.check.json),
count `error TS` lines — baseline web 25 / node 10, never above. No Status.md / TESTING.md records in T2. No model call of any kind (no
assistant turn, no provider call); never read, copy or open a credential store (settings.db*, ~/.claude, any profile's).

Live work (design §9 step 4 only). Resource guard before any build / launch / copy / full run: C: ≥ 3 GB free and C: + memory commit
headroom ≥ 6 GB; --maxWorkers=2 while headroom < 10 GB; DRIVING's load rules / E-d13 (measure and record). Check whether Hasan's dev
app runs (electron.exe from D:\repos\VidTSX-STUDIO, CDP 9222, his profile): if it does, never kill it, never run electron-vite dev, and
launch our own instance only after checking he is not rendering (DRIVING's startup-sweep rule). Never the decision-models session's
worktree (.vidtsx-temp\decisions\wt), profiles or ports 9300–9309. Your profile: C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\
timeline-T\profile, CDP 9296 — a copy of profiles\search-S4-verify\profile WITHOUT settings\settings.db* (or a fresh copy of
profiles\source\profile); profiles\search-*, profiles\source, profiles\E3 are read-only; never Hasan's %APPDATA%\VidTSX Studio, his
projects, his stations (B1-verify-root, profiles\B1-verify, B5-station-root, profiles\B5-station) or B6 / B7 scratch. Studio root set
in the first CDP call. The 2-clip test project: copy C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S4\r1\p2\pristine\ (+ its clip
C:\Users\hasan\AppData\Local\vidtsx-e2e\search\S4\r1\media\e3v-clip.mp4) into your own scratch root under
C:\Users\hasan\AppData\Local\vidtsx-e2e\timeline\T2\ (read-only sources; point the copy's asset path at your copied clip). Kits and
drivers: D:\repos\VidTSX-STUDIO\.vidtsx-temp\timeline\T2\ (you may copy and adapt the S4 kit in
D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S4\r1\ — read-only originals: tools.s4.test.ts + vitest.s4.config.ts for the real-handler
get_timeline call, launch.sh / cdp.mjs for the app). Big outputs (full-run logs): C:\Users\hasan\AppData\Local\vidtsx-e2e\timeline\T2\.
Stop only your own instance.

Hand off when ANY of: about 40 tool calls made; about 2,500 lines of source read; a numbered step of design §9 finished; you notice
you are re-reading a file. To hand off: update HANDOFF.md fully (Done with file:line and commit hashes · Verified with the exact
commands and their output · Next step as ONE concrete instruction · Open problems · Do-not-redo · Agents so far), append one dated
line (real clock) to docs/studio/assistant-timeline/T2/LOG.md, commit if at a green checkpoint (message "<type>(studio): assistant
timeline T2 — <what>", ending with the line "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"), and return a short report
that ends with `status: HANDOFF`.

When design §9 step 4 is done — every §8.1 test in the tree and green, the §8.3 1 smoke done, the §8.2 gates run and recorded
(commands + outputs + log paths) — update HANDOFF.md, commit, and return `status: DONE` with the evidence.

If you hit a decision the design leaves open, or find a design fact wrong (a string that cannot hold, a file:line that moved), do not
guess: write it under Open problems and return `status: BLOCKED` with the question in one paragraph. A small deviation that keeps the
behaviour (a helper's name, a file split) is yours — record it in HANDOFF.md.
```
