# T2 — build: `get_timeline`, the cuts line, the cut anchor
status: IN PROGRESS — design §9 steps 1 (`307f96f`) and 2 (`99c35b1`) DONE; step 3 next

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

## Verified

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

## Next step

Design §9 step 3, characterization FIRST: check `src/main/services/studio/agent-tools/insert-tools.ts` with the stream tracer, then write
`agent-tools/insert-tools-anchor.test.ts` (imports `insert-tools.ts` directly — there is no `insert-tools.test.ts`; the suites that
already drive `insert_asset` (`audio-tools.test.ts`, `library-import.test.ts`) show the mocking pattern; today `insert-tools.ts` loads no
project — the word path reads the transcript through `readTranscriptFile` (import :9), mock that) pinning the number path and the
`{ word, take }` path's emitted proposal item + answer text exactly, run it
GREEN on the UNCHANGED `insert-tools.ts`, and commit it alone ("test(studio): assistant timeline T2 — insert_asset number / word
characterization (green on the unchanged code)") before any red test for `source-span-map`, `cut-anchor`, the `{ cut }` path, `atLabel`
or the prompt line / description.

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

## Do-not-redo

- §9 step 1 entirely (`307f96f`): the model, the listing, the tool, the id, the `TOOL_LINES` line, their tests (red run recorded above).
- §9 step 2 entirely (`99c35b1`): the cuts line, the request field and its plumbing, ruling AT-r1, their tests (red run recorded above).
- The stream tracer (`.vidtsx-temp/timeline/T2/stream-chain.mjs`) — reuse it, don't rewrite it.

## Agents so far

- Builder #1 (2026-10-30 15:58–16:10): §9 step 1 → `307f96f`; handed off at the end of a numbered step.
- Builder #2 (2026-10-30 16:12–16:17): ruling AT-r1 + §9 step 2 → `99c35b1`; handed off at the end of a numbered step.
