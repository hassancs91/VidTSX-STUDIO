# T2 — build: `get_timeline`, the cuts line, the cut anchor
status: IN PROGRESS — design §9 steps 1 (`307f96f`), 2 (`99c35b1`) and 3 (`cf4fb0c` characterization + `021a2d6`) DONE; step 4: `wt/out`
built + the §8.3 1 smoke DONE (builder #4, at `8b1c2e5`); the §8.2 gates next

## Goal (the paste-in's T2 row verbatim + the exit)

"T2 — BUILD, red-first, hand-off-sized: (1) then (2) then (3) with unit tests first; rebuild wt/out; the builder's own CDP smoke on an
isolated profile (open the 2-clip project, one get_timeline call through the real handler, NO model turn); the full gates. No Status.md
/ TESTING.md records in T2."

Exit: design `docs/studio/ASSISTANT_TIMELINE_DESIGN.md` §9 steps 1–4 done — every §8.1 test in the tree and green (new behaviour shown
red first; the `insert_asset` number / word characterization tests green on the UNCHANGED code first), the §8.3 1 smoke done, the §8.2
gates run and recorded.

## Plan context

- The design note (all of it; §8 is the bar the T3 verifier holds). Why: `docs/studio/assistant-timeline/NEXT-SESSION.md` "Why".
- Code: `src/main/services/studio/studio-agent-prompt.ts` (+ `studio-agent-prompt-tools.ts`), `agent-tools/{insert-tools,project-tools,
  index,types,cut-run-line,flow-range}.ts`, `timeline-insert.ts`, `src/shared/studio/{caption-words,cut-learn-joins}.ts`,
  `src/shared/types/studio.ts` (StudioClip :153, StudioTrack :184, StudioTimeline :205), `src/shared/ipc/types/studio.ts`
  (StudioAgentSendRequest :471), `src/main/ipc/studio-handlers.ts:535-558`, `src/features/studio/components/EditorShell.tsx:487`,
  `src/features/studio/hooks/useStudioAgent.ts:59,250`, `src/features/studio/services/{cut-proposal.ts:44-67,apply-insert-proposal.ts,
  apply-shot-proposal.ts:32-40}`.
- The worktree recipe and the vitest gate rules: `docs/studio/end-to-end/DRIVING.md` "Track E" (no node_modules here; E-d2a; E-d13) and
  `docs/studio/search/ORCHESTRATOR.md` rulings LS-r1 / LS-r1b / LS-r1c (the 25 `<wt>\stream` suites + the fresh-worktree proof).
- Real-handler harness pattern (app stopped): `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\S4\r1\tools.s4.test.ts` + `vitest.s4.config.ts`
  (read-only; copy into `D:\repos\VidTSX-STUDIO\.vidtsx-temp\timeline\T2\`).

## Done

- **§9 step 1 (§8.1 1, 2, 6's get_timeline half) — commit `307f96f`** (as of `307f96f`):
  - `src/shared/studio/timeline-cuts.ts` (130 lines): `JOIN_EPS` :18, `isThroughEdit` :66, `masterTimelineModel` :78 (master =
    `masterLane`; clips in `timelineStart` order; joins / cuts numbered over the whole timeline / gaps incl. the leading one),
    `summarizeMasterCuts` :106 (→ `MasterCutsSummary` :55 `{ trackName, clipCount, gapCount, cuts }`, undefined without a master),
    `timelineLength` :118 (delegates to `time-math.ts` `timelineDuration` — same rule, no duplicate), `formatTimelineTc` :125. Exported
    through `src/shared/studio/index.ts:31-39`. Test `timeline-cuts.test.ts` (17 tests).
  - `src/main/services/studio/agent-tools/timeline-listing.ts` (165 lines): `formatTimelineListing` :141 (the §3 text; caps
    `MASTER_ROW_CAP` 40 :17 / `OTHER_ROW_CAP` 20 :18; `CUT_FOOTER` :23). Test `timeline-listing.test.ts` (the 2-clip answer exact;
    the synthetic 60-clip / 25-shot / 2-audio / muted+locked timeline page 1 + page 2 (`fromSec: 80.5`, starts at `#41 … ← cut 39`) +
    a `toSec` window; bad window; empty; no-master; labels (missing asset, image, shot in / not in the pool, caption ± label, speed,
    gain); a transition suffix; a through-edit row; flags).
  - `src/main/services/studio/agent-tools/timeline-tools.ts` (49 lines): `GET_TIMELINE_DESCRIPTION` :13 (the design's text exactly),
    `buildTimelineTools` :21 (`loadProject(req.projectId)`; failure → `Could not read the timeline: <message>`; chip `get_timeline`
    with a window detail when windowed; no review-open check — read-only). Test `timeline-tools.test.ts` (real handler, `loadProject`
    mocked: 2-clip answer exact with `reviewOpen: true`, load failure, window + bad window, description exact incl. `{ cut` + caps).
  - `agent-tools/index.ts`: `'get_timeline'` appended LAST :70 (after `'read_note'`), import :24, group :104.
  - `studio-agent-prompt-tools.ts:20`: the §7 get_timeline line, immediately before the `insert_asset` line (:21).
  - Prompt pins in a NEW file `src/main/services/studio/studio-agent-prompt-timeline.test.ts` (the existing
    `studio-agent-prompt.test.ts` untouched): the line exact + right before `insert_asset`'s; `STUDIO_TOOL_IDS` = the 29 of `0df9e9c`
    + `'get_timeline'`.
- **§9 step 2 (§8.1 3) + ruling AT-r1 — commit `99c35b1`** (as of `99c35b1`; 8 files, +157 / −8):
  - AT-r1: `timeline-listing.ts` `masterRows` prints the gap row (:105-111) BEFORE the cap check (:112), so page 1 ends `  gap …` then
    `  … +N more — …` and page 2 (starting at the gap's end) does not repeat it. Test `timeline-listing.test.ts:136` (`synthetic(40)`:
    the gap right before #41; page 1 lines 41–44 exact, 40 rows; page 2 starts `#41` with no cut suffix, `#42 … ← cut 40`, no gap row).
    `synthetic()` gained a `gapAt = 10` parameter (default = the old fixture; no existing assertion edited).
  - The cuts line: `formatMasterCutsLine(summary?)` `timeline-listing.ts:177` (`CUTS_LINE_SHOWN` 5 :173) — §4's text; undefined for
    absent / 0 clips. `StudioAgentTimelineCuts` `src/shared/ipc/types/studio.ts:474` (same shape as `MasterCutsSummary`, an independent
    interface — tsc checks the two agree at `EditorShell.tsx:489`) + `StudioAgentSendRequest.timelineCuts?` :509.
    `BuildAgentPromptInput.timelineCuts?` `studio-agent-prompt.ts:64`; the line pushed right after `- Timeline: …` :96-97 (import :13).
    `studio-handlers.ts:552` passes it; `useStudioAgent.ts:62` option + :256 spread; `EditorShell.tsx:489` `timelineCuts:
    summarizeMasterCuts(tl.timeline)` (import :14). Growth of the pre-existing over-300 files: `EditorShell.tsx` +2 (1674 → 1676),
    `useStudioAgent.ts` +4 (336 → 340), `src/shared/ipc/types/studio.ts` +14 (972 → 986), `studio-handlers.ts` +1 (672 → 673). New /
    touched under-300: `timeline-listing.ts` 188, `studio-agent-prompt.ts` 170.
  - Tests in `studio-agent-prompt-timeline.test.ts` :44 (absent / 0 clips → none; 1 clip 0 cuts; 2 clips 1 cut via `summarizeMasterCuts`
    of the 2-clip timeline; exactly 5; 6 → `+1 more (get_timeline lists them)`; 1 and 2 gaps) and :94 (`buildAgentSystemPrompt`: the
    line right after `- Timeline: 0:06 long.`; absent / 0 clips → `- Captions: none set.` follows).
- **§9 step 3 (§8.1 4, 5, 6's insert_asset half, 7) — commits `cf4fb0c` (characterization, alone) then `021a2d6`** (as of `021a2d6`;
  `git diff --stat cf4fb0c 021a2d6` → 13 files, +752 / −36):
  - `cf4fb0c` = ONLY `agent-tools/insert-tools-anchor.test.ts` (219 lines, 7 tests, real `insert_asset` handler; mocks
    `../asset-transcriber`, `../agent-actions`, `../project-store`, `./library-import`): the number path (item, headline `at 0:03.0`,
    answer, chip `audio at 3s`; gain / note / asked duration clipped; a negative time → `timelineStart` 0 with the existing
    `-1:59.0` label), the `{ word, take }` path (item `{ assetId, sourceStart 4.2, sourceEnd 4.2 + 0.7 }`, headline `where the footage
    reaches 0:04.2 (source)`, chip `audio at "hello"`; take default 1 + explicit footage id), the four word errors, the three guards.
    GREEN on the unchanged `insert-tools.ts`; not edited since.
  - `src/shared/studio/source-span-map.ts` (48 lines): `mapSourceSpanToTimeline` :30 (the moved core); exported `index.ts:40-41`.
    `features/studio/services/cut-proposal.ts:44-53` `mapCutItemToTimeline` = the guard + the shared call + `itemId` (import :12);
    `cut-proposal.test.ts` untouched and green. Test `source-span-map.test.ts` (4 tests).
  - `agent-tools/cut-anchor.ts` (104 lines): `cutAnchorLabel` :37, `resolveCutAnchor` :68 (`MAP_EPS` 0.001 :29; footage kinds
    video / audio / sfx :31; §5's three exact errors; the candidate kept only when `mapSourceSpanToTimeline(...)[0].start` is within
    0.001 of `t`). Test `cut-anchor.test.ts` (16 tests: cut 1 / −0.25 / 0.5 / −3 exact; global numbering over a through edit + gap;
    TSX / image / speed-2 offset 0.5 / same-source-earlier → fixed; cut 2 "1 cut", plural, 1-clip + empty "(0 cuts)", offset past
    after + before; labels; the trim survival: item `{ e3v, 4, 4.7 }` maps 3 → 2 after the trim).
  - `timeline-insert.ts`: `atLabel?` :84 (used :143), `insertClipLength` :97 (the clipping rule, now the one `buildInsertProposal`
    uses — behaviour unchanged). Tests appended to `timeline-insert.test.ts` (new describe at the end; no existing line changed).
  - `insert-tools.ts` (138 → 172 lines): the `{ cut, offset? }` union member :34-37 (the design's two describes), `atChip` :43,
    `resolveCutAt` :50 (`loadProject` :11; failure → `Could not read the timeline to find cut <n>: <message>`), the branch :100-106,
    `atLabel` passed :141; the description's clause. Test `insert-tools-cut.test.ts` (10 tests, real handler, `loadProject` mocked).
  - `studio-agent-prompt-tools.ts:21` the §7 `insert_asset` `at` sentence; pin in `studio-agent-prompt-timeline.test.ts` (new describe
    `prompt pins — insert_asset`: the line exact + right after the get_timeline line).
  - Renderer test `features/studio/services/apply-insert-proposal-cut.test.ts` (2 tests, item written by hand, no `src/main` import):
    `insertItemPlacement` 3 on the 2-clip timeline, 2 after the trim; `applyInsertProposal` puts the whoosh at 2 on A1.

- **§9 step 4, part 1 — `wt/out` + the §8.3 1 smoke (builder #4; no `src/` change, so no code commit; as of `8b1c2e5`, whose
  `src/` = `021a2d6`'s).** Kit (outside the repo) `D:\repos\VidTSX-STUDIO\.vidtsx-temp\timeline\T2\`: `build.sh`, `prep.cjs` (the
  pristine copy + clip, asset path rewritten), `make-profile.ps1` (robocopy `/XF settings.db* DevToolsActivePort`), `launch.sh` (CDP
  9296), `restore.ps1`, `smoke-open.mjs` (root FIRST, open the project, read the editor), `vitest.t2.config.ts` + `tools.t2.test.ts`
  (the real `get_timeline` handler, adapted from S4's harness: `electron` + `settings-db` mocked so `project-store` resolves MY root;
  nothing else mocked), `inspect-project.cjs`, `ed2a-graph.cjs` (S4's, header line only changed), `gate.sh`. Scratch (outside the repo)
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\timeline\T2\`: `pristine\` (copy of `S4\r1\p2\pristine\`), `media\e3v-clip.mp4` (842,353 B,
  = the source), `root\projects\e3v-whoosh\`, logs. Profile `C:\Users\hasan\AppData\Local\vidtsx-e2e\profiles\timeline-T\profile`
  (copy of `search-S4-verify\profile` without `settings\settings.db*`: 2,252 files, 421.3 MB; its `settings\` was empty before launch).
  Deviation (behaviour-keeping): only the pristine `project.json` went into the project folder (`index.json` = the S4 library index and
  `project.orig.json` = S4's pre-clean copy stay in `T2\pristine\`); the asset's cached derivatives (thumbs / proxies / waveforms) were
  not copied — the editor opened without them and logged no error.

## Verified

Step 4 part 1 (builder #4), 2026-10-30 16:33–16:42, worktree root, HEAD `8b1c2e5`, tree clean:

- Guard 16:33:20: C: 28.58 GB free, D: 39.3 GB, commit headroom 32.06 GB (limit 99.70, committed 67.64); no `electron.exe` running
  (Hasan's dev app NOT running; nothing on 9222 / 5173). Re-checked 16:40:09 before the launch: C: 27.36, D: 39.15, headroom 33.60 GB;
  one other session's instance had appeared (`electron.exe .` port 9341, profile under another session's `…\scratchpad\part2\profile`,
  started 16:38:38 — not Hasan's, not 9300–9309, no ffmpeg / remotion process running) → launched; never touched (it was gone by 16:41).
- Build 16:33:40–16:38:12: `bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/timeline/T2/build.sh` (= DRIVING's recipe step 1) → `rc 0`,
  `✓ built in 4m 3s`, the only warnings the 3 "use client" lines (`build.log`). `out/main/index.js` holds `get_timeline` and the footer
  string.
- Types at `8b1c2e5` (16:37–16:39): `tsc -p tsconfig.web.check.json --noEmit` → 25 `error TS` (`tsc-web-step4.log`); `-p
  tsconfig.node.check.json` → 10 (`tsc-node-step4.log`).
- App (launch 16:40:2x, `bash …\T2\launch.sh` in the background): `node smoke-open.mjs` → Studio root set FIRST (`{"set":{"success":true},
  "got":{"root":"C:\\Users\\hasan\\AppData\\Local\\vidtsx-e2e\\timeline\\T2\\root"}}`), visible project cards `["e3v-whoosh"]`, editor up:
  `v1Options 1`, tracks `V1 video [["e3v-c1",0,3,0],["e3v-c2",3,3,4]]` + `A1 audio []`, rendered clip ids `["e3v-c1","e3v-c2"]`
  (`smoke-open.json`); screenshot `smoke-editor.png` (V1: two `e3v-clip.m…` clips, A1 empty, `00:00.00 / 00:06.00`, "Saved"). The app
  saved `project.json` at 16:40:35 (timeline identical to the pristine one). Logs: `app.log` 25 lines, 0 matching
  `error|fail|exception|uncaught|warn`; the profile's `logs\vidtsx-2026-10-30.log` 22 lines, 0 such lines. Stopped 16:41:24 (my 5
  `electron.exe` by profile path + Name; 0 left; the launcher's exit 127 = the killed `exec`, expected).
- Real handler, app stopped, 16:41:30: `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run --config
  D:/repos/VidTSX-STUDIO/.vidtsx-temp/timeline/T2/vitest.t2.config.ts` (from the worktree root) → `Test Files  1 passed (1)` · `Tests  1
  passed (1)`, rc 0 (`smoke-get-timeline.log`); record `smoke-get-timeline.json`: `"equal": true` (the answer = design §3's six lines
  exactly), `isError false`, emitted chip `{ kind: "tool", tool: "get_timeline" }`, `project.json` sha1 `72005dba…` before = after (the
  read wrote nothing). No model call anywhere.

All from the worktree root `D:\repos\VidTSX-STUDIO\.vidtsx-temp\search\wt`, 2026-10-30 ~16:00–16:08 (C: 29.12 GB free, D: 39.58 GB, commit
headroom 39.15 GB):

- RED (tests written, no code): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/shared/studio/timeline-cuts.test.ts
  src/main/services/studio/agent-tools/timeline-listing.test.ts src/main/services/studio/agent-tools/timeline-tools.test.ts
  src/main/services/studio/studio-agent-prompt-timeline.test.ts` → `Test Files  4 failed (4)` · `Tests  2 failed (2)`: three files
  `Cannot find module './timeline-cuts'` / `'./timeline-listing'` / `'…/agent-tools/timeline-tools'`; the prompt pins `expected -1 to be
  greater than 0` and `expected [ 'get_transcript', …(28) ] to deeply equal [ 'get_transcript', …(29) ]`.
- GREEN (after the code): the same four + `src/main/services/studio/studio-agent-prompt.test.ts` → `Test Files  5 passed (5)` ·
  `Tests  50 passed (50)`.
- Types: `node D:/repos/VidTSX-STUDIO/node_modules/typescript/bin/tsc -p tsconfig.web.check.json --noEmit` → 25 `error TS` lines;
  `-p tsconfig.node.check.json` → 10 (baseline 25 / 10; none in a new or touched file).

Step 2 (builder #2), same root, 2026-10-30 16:13–16:16 (C: 29.04 GB free, D: 40 GB, commit headroom 34.87 GB):

- RED 16:13:19 (tests written, no code): `node D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run
  src/main/services/studio/agent-tools/timeline-listing.test.ts src/main/services/studio/studio-agent-prompt-timeline.test.ts` →
  `Test Files  2 failed (2)` · `Tests  8 failed | 11 passed (19)`: six `TypeError: formatMasterCutsLine is not a function`; the prompt
  test `expected '- Captions: none set.' to be '- V1 (master track): 2 clips · 1 cut …'`; AT-r1 `expected [ …(3) ] to deeply equal
  [ …(3) ]` (page 1 had no gap row before `+20 more`). (The "absent → Captions follows" prompt test passes on the old code by design.)
- GREEN 16:14:33: `… vitest.mjs run src/shared/studio/timeline-cuts.test.ts src/main/services/studio/agent-tools/timeline-listing.test.ts
  src/main/services/studio/agent-tools/timeline-tools.test.ts src/main/services/studio/studio-agent-prompt-timeline.test.ts
  src/main/services/studio/studio-agent-prompt.test.ts` → `Test Files  5 passed (5)` · `Tests  59 passed (59)`.
- Types (after the code, before `99c35b1`; the tree then = `99c35b1`): web 25 `error TS`, node 10.
- `node D:/repos/VidTSX-STUDIO/.vidtsx-temp/timeline/T2/stream-chain.mjs src/main/services/studio/studio-agent-prompt.ts` → `direct stream
  importers: []` (its new import of `agent-tools/timeline-listing` adds no stream suite).

Step 3 (builder #3), same root, 2026-10-30 16:21–16:29 (no build / launch / full run in step 3, so no resource guard was needed; logs
in `C:\Users\hasan\AppData\Local\vidtsx-e2e\timeline\T2\`):

- Tracer before: `node D:/repos/VidTSX-STUDIO/.vidtsx-temp/timeline/T2/stream-chain.mjs src/main/services/studio/agent-tools/insert-tools.ts`
  → `direct stream importers: []`.
- CHARACTERIZATION 16:21:35, on the UNCHANGED `insert-tools.ts` (`git diff HEAD -- …/insert-tools.ts` empty): `node
  D:/repos/VidTSX-STUDIO/node_modules/vitest/vitest.mjs run src/main/services/studio/agent-tools/insert-tools-anchor.test.ts` →
  `Test Files  1 passed (1)` · `Tests  7 passed (7)`; committed alone as `cf4fb0c`.
- RED 16:24:52 (tests written, no code; `step3-red.log`): `… vitest.mjs run src/shared/studio/source-span-map.test.ts
  src/main/services/studio/agent-tools/cut-anchor.test.ts src/features/studio/services/apply-insert-proposal-cut.test.ts
  src/main/services/studio/agent-tools/insert-tools-cut.test.ts src/main/services/studio/timeline-insert.test.ts
  src/main/services/studio/studio-agent-prompt-timeline.test.ts src/main/services/studio/agent-tools/insert-tools-anchor.test.ts` →
  `Test Files  5 failed | 2 passed (7)` · `Tests  12 failed | 25 passed (37)`: `Cannot find module './source-span-map'` (and via
  `cut-anchor.test.ts`); the insert_asset line `expected -1 to be greater than 0`; `atLabel` headline `as audio whe…` vs `as audio 0.2…`;
  `insertClipLength is not a function`; the 10 `{ cut }` handler tests (the word path's `No transcribed footage …`, no `{ cut` in the
  description, no cut form in the schema). The 2 passing files = the characterization file and the renderer placement file
  (`apply-insert-proposal-cut.test.ts` pins EXISTING renderer behaviour — green by design, a guard for the move).
- GREEN 16:26:52 (`step3-green.log`): the same 7 + `cut-proposal.test.ts`, `cut-proposal-qa.test.ts`, `apply-insert-proposal.test.ts`,
  `apply-shot-proposal.test.ts`, `studio-agent-prompt.test.ts`, `timeline-tools.test.ts`, `timeline-listing.test.ts`,
  `timeline-cuts.test.ts`, `audio-tools.test.ts`, `audio-tools-no-claim.test.ts`, `audio-tools-reuse.test.ts`, `library-import.test.ts`,
  `flow-tools.test.ts` → `Test Files  20 passed (20)` · `Tests  178 passed (178)`.
- Types 16:27–16:29 (tree = `021a2d6`'s content): `tsc -p tsconfig.web.check.json --noEmit` → 25 `error TS`; `-p tsconfig.node.check.json`
  → 10 (none in a new or touched file; `tsc-web-step3.log` / `tsc-node-step3.log`). Tracer after: `insert-tools.ts` and `cut-anchor.ts`
  → `direct stream importers: []`.
- Existing test files: `git diff -U0` of `timeline-insert.test.ts` / `cut-proposal.test.ts` shows no removed line; 0 `any` in the new files.

## Next step

Design §9 step 4, the rest: the §8.2 gates at the records commit's HEAD, app stopped, resource guard + CPU top-5 recorded first —
the worktree full vitest run (`bash D:/repos/VidTSX-STUDIO/.vidtsx-temp/timeline/T2/gate.sh 1`; green except the 25 LS-r1c suites
with the fresh-detached-worktree proof at that HEAD and the 3 E-d2a suites with `ed2a-graph.cjs` over `git diff --name-only
0df9e9c..HEAD`), tsc web ≤ 25 / node ≤ 10, the matcher diff vs `7967c6f`, library search §9.1's files, the house rules over
`0df9e9c..HEAD`; record them here and return DONE.

## Open problems

- (none blocking) Ruling AT-r1 is DONE in `99c35b1` (see Done).
- **LS-r1c trap for any new test that imports `agent-tools/index.ts`:** `index.ts`'s graph reaches `stream/promises` ONLY through
  `./flow-tools` (→ `agents/tools/run-flow` → … → `packages/zip-reader.ts` and `studio/project-package-zip.ts`); in this worktree that
  fails as `Cannot find module '<wt>\stream\promises'` = a 26th stream suite = a REAL gate failure. `studio-agent-prompt-timeline.test.ts`
  therefore `vi.mock('./agent-tools/flow-tools', () => ({ buildFlowTools: () => [] }))` before importing `STUDIO_TOOL_IDS` (the first red
  run, before that mock, showed exactly that error). Tracer (static esbuild metafile walk, `?raw` imports external):
  `node D:/repos/VidTSX-STUDIO/.vidtsx-temp/timeline/T2/stream-chain.mjs src/main/services/studio/agent-tools/index.ts` → `DIRECT reaches
  stream: src/main/services/studio/agent-tools/flow-tools.ts` (the only one). Step 3's handler test must import `insert-tools.ts`
  directly (not `index.ts`) — check it with the tracer first.
- Small choices the design leaves open (behaviour-keeping; for the orchestrator to see): an empty track's one line carries no flags (the
  design's literal `<name> (<kind>): empty`); a track whose window holds only a gap prints its header + `  (nothing in this window)` (no
  gap row); (superseded by AT-r1 in `99c35b1`: the gap right before the first unlisted master clip now ends page 1); a clip with no
  `assetId` and no `tsx` (no op makes one) labels as `<kind> clip`; the bad-window error prints the numbers with `String()` (`got 4–2`);
  `speed` / `gain` print with `String()` (`at 1.5×`, `gain 0.3`).
- Step 2 choices (behaviour-keeping): `formatMasterCutsLine` lives in `timeline-listing.ts` (design §6 puts "the §4 line" there);
  `StudioAgentTimelineCuts` is its own interface in the IPC types (not an alias of `MasterCutsSummary`, so the IPC types import nothing
  from `shared/studio`); the hook spreads `timelineCuts` only when defined (as its other optional fields). No handler test: the
  pass-through at `studio-handlers.ts:552` is one spread (tsc-checked); the §8.3 smoke does not exercise it (no model turn).
- Step 3 choices (behaviour-keeping): the description keeps the word sentence byte-identical and drops its leading "or" so the cut
  clause reads "`at` is timeline seconds, { word, take } … survives cuts), or { cut, offset? } …"; the chip for a positive offset is
  `audio at cut 1 +0.5s` (the design shows only `-0.25s`; offset 0 → no suffix); the clipping rule is extracted as
  `insertClipLength` in `timeline-insert.ts` (the design's "the `buildInsertProposal` clipping rule"); the anchor result carries
  `atLabel` so the handler passes it straight through; `source-span-map` is also exported through `src/shared/studio/index.ts`
  (main imports it by relative path, like `timeline-cuts`, so `index.ts`'s React exports never reach main); a cut anchor on a side
  that joins with an overlap / a ≤ 2 ms gap whose mapped start differs from `t` by > 0.001 s falls back to the fixed time (total by
  design); the renderer test is a GUARD (green before the move), not red-first — the behaviour already existed.
- Not a test: zod's `int().min(1)` on `cut` is not exercised through `.handler` (the SDK validates before the handler; the direct
  handler calls bypass zod) — `resolveCutAnchor` treats any `cut` not among the cuts (incl. < 1) as "does not exist".

## Do-not-redo

- §9 step 1 entirely (`307f96f`): the model, the listing, the tool, the id, the `TOOL_LINES` line, their tests (red run recorded above).
- §9 step 2 entirely (`99c35b1`): the cuts line, the request field and its plumbing, ruling AT-r1, their tests (red run recorded above).
- §9 step 3 entirely (`cf4fb0c` + `021a2d6`): the characterization file (never edit it), source-span-map + the wrapper, cut-anchor,
  `atLabel` / `insertClipLength`, the `{ cut }` path, the prompt line and description, their tests (red run recorded above).
- The stream tracer (`.vidtsx-temp/timeline/T2/stream-chain.mjs`) — reuse it, don't rewrite it.

## Agents so far

- Builder #1 (2026-10-30 15:58–16:10): §9 step 1 → `307f96f`; handed off at the end of a numbered step.
- Builder #2 (2026-10-30 16:12–16:17): ruling AT-r1 + §9 step 2 → `99c35b1`; handed off at the end of a numbered step.
- Builder #3 (2026-10-30 16:19–16:31): §9 step 3 → `cf4fb0c` (characterization, alone) + `021a2d6`; handed off at the end of a
  numbered step.
- Builder #4 (2026-10-30 16:32–): §9 step 4 — `wt/out` built, the §8.3 1 smoke done (records commit, no code change); then the gates.
