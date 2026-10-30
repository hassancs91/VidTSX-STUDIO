# T2 — build: `get_timeline`, the cuts line, the cut anchor
status: NEW

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

(none yet)

## Verified

(none yet)

## Next step

Design §9 step 1: write the red tests for `src/shared/studio/timeline-cuts.ts` (§8.1 1), `agent-tools/timeline-listing.ts` (§8.1 2),
the `get_timeline` tool and the prompt pins for its `TOOL_LINES` line + `STUDIO_TOOL_IDS` (§8.1 6, the get_timeline half); run them red;
then the code.

## Open problems

(none yet)

## Do-not-redo

(none yet)

## Agents so far

(none yet)
