# T2 — build: `get_timeline`, the cuts line, the cut anchor
status: IN PROGRESS — design §9 step 1 DONE (`307f96f`); step 2 next

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

## Next step

Design §9 step 2: write the red tests for the cuts line (§8.1 3) — a pure `formatMasterCutsLine(summary?)` in
`agent-tools/timeline-listing.ts` (absent / 0 clips → no line; 1 clip 0 cuts; 2 clips 1 cut; exactly 5 cuts; 6 cuts `+1 more`; with
gaps) and `buildAgentSystemPrompt` placing it right after `- Timeline: …` (put these in `studio-agent-prompt-timeline.test.ts`); run
them red; then add `StudioAgentTimelineCuts` + `timelineCuts?` to `StudioAgentSendRequest` (`src/shared/ipc/types/studio.ts`; make it
the same shape as `MasterCutsSummary` in `timeline-cuts.ts:55`), send `summarizeMasterCuts(tl.timeline)` from `EditorShell.tsx` next to
`timelineDurationSeconds` (:487) through `useStudioAgent.ts`, pass it in `handleStudioAgentSend` (`studio-handlers.ts:541`) into
`BuildAgentPromptInput`, and print the line in `studio-agent-prompt.ts`.

## Open problems

- (none blocking)
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
  gap row); a gap that ends exactly at a page's `fromSec` (the gap right before the first unlisted master clip) is on neither page — the
  "intersects the window" rule as written; a clip with no `assetId` and no `tsx` (no op makes one) labels as `<kind> clip`; the bad-window
  error prints the numbers with `String()` (`got 4–2`); `speed` / `gain` print with `String()` (`at 1.5×`, `gain 0.3`).

## Do-not-redo

- §9 step 1 entirely (`307f96f`): the model, the listing, the tool, the id, the `TOOL_LINES` line, their tests (red run recorded above).
- The stream tracer (`.vidtsx-temp/timeline/T2/stream-chain.mjs`) — reuse it, don't rewrite it.

## Agents so far

- Builder #1 (2026-10-30 15:58–16:10): §9 step 1 → `307f96f`; handed off at the end of a numbered step.
