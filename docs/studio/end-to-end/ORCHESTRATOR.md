# END_TO_END_PLAN.md — orchestrator state

> Run brief: `docs/studio/END_TO_END_RUN.md`. One part at a time; a part is DONE only when its
> exit is met with evidence, the gates pass, the STATUS.md row and TESTING.md §18 block exist,
> and it is committed on `end-to-end-p0`. Stop after every part for Hasan's "go".

- Branch: `end-to-end-p0`, cut from `main` at `14d7a63` (the Q6 commit) on 2026-10-21 18:41 +0300.
- Type gate baseline at the branch point: web 26 / node 10 (`scripts/check-types.mjs:7-10`).
- Disk at the branch point: C: 25 GB free, D: 7.0 GB free.

| Part | Status | Builders spawned | Verifier result | Commit | Exit numbers | Started / Finished |
|---|---|---|---|---|---|---|
| A1 | DONE | 2 | PASS (1 round) | `e4803cd` (code), `bd805af` + `8306c8e` (docs) | 3840×2160 @ 60 from the dialog; Export lists Full, 1440p, 1080p, 720p, 540p, 360p; size edit = one undo step on disk; vitest 3513 pass; types 26/10 | 2026-10-21 18:42 / 19:11 (29 min) |
| A2 | BUILDING | 1 | — | — | — | 2026-10-21 19:20 / — |
| A3 | TODO | | | | | |
| A4 | TODO | | | | | |
| A5 | TODO | | | | | |
| A6 | TODO | | | | | |
| B1 | TODO | | | | | |
| B2 | TODO | | | | | |
| B3 | TODO | | | | | |
| B4 | TODO | | | | | |
| B5 | TODO | | | | | |
| B6 | TODO | | | | | |
| C1 | TODO | | | | | |
| C2 | TODO | | | | | |
| C3 | TODO | | | | | |
| C4 | TODO | | | | | |
| C5 | TODO | | | | | |
| D0 | TODO | | | | | |
| D1 | TODO | | | | | |
| D2 | TODO | | | | | |
| D3 | TODO | | | | | |
| D4 | TODO | | | | | |
| D5 | TODO | | | | | |
| E1 | TODO | | | | | |
| E2 | TODO | | | | | |
| E3 | TODO | | | | | |
| E4 | TODO | | | | | |
| F0 | TODO | | | | | |
| F1 | TODO | | | | | |
| F2 | TODO | | | | | |

## Answers in force (Hasan, 2026-10-21, in the run brief)

- **Q1 (D2)** yes — cut snapping, waveforms and transcription stay on the ORIGINAL audio.
- **Q2 (E2)** yes — generated SFX normalized at generation to −20 LUFS under −1.5 dBFS.
- **Q3 (C4)** yes — the assistant writes only in `notes/`; shots change through the builder's edit path.
- **Q4 (B4)** yes — learn thresholds ≥ 10 touched joins, > 30 ms or > 1 dB.
- **Q5 (F0)** `buildConcurrency` default from the F0 spike.
- **Q6** yes — done 2026-10-21 18:41: the October work committed on `main` as `14d7a63`
  (the 8 modified files plus the four untracked docs the STATUS diff references:
  `RECORDER_DESIGN.md`, `END_TO_END_PLAN.md`, `CLAUDE_CODE_PARITY_AUDIT.md`,
  `END_TO_END_RUN.md`), then `git switch -c end-to-end-p0`.

## Stops

(one line per stop: what was reported, what Hasan said)
- 2026-10-21 19:11 · A1 DONE (verifier PASS, 1 round). Reported: exit numbers, the pre-existing
  `shot-generator.test.ts` / `shot-module-resolver.test.ts` full-suite flake (reproduced on `main`,
  green on rerun), cosmetic tile text. Waiting for Hasan's "go" before A2.
- 2026-10-21 19:20 · Hasan: "lets do A2-A6 fully end to end stop after you finish A fully" → run A2…A6
  and the track A exit without stopping between parts; stop after track A (or on BLOCKED / 3 FAILs).

## Notes carried forward

- Full-suite flake, NOT caused by the branch: `shot-generator.test.ts` (3 tests from :197) and
  `shot-module-resolver.test.ts:151` (5000 ms timeout) fail intermittently; the verifier
  reproduced `shot-generator` failing 2/4 on a detached `main` worktree. A green rerun counts.
- A1 left for later (unit-tested only, or cosmetic): a remembered 1440p export default on a
  smaller project falling back to Full (TESTING §18.1 open item); Ctrl+Z with Project settings
  still open; New Project tile descriptions wrap to two lines and the 4K tile says "4K" twice;
  `useTimeline.ts` ~850 lines (over the house rule before A1).
- A1's frame-size undo means `settings.width/height` are written from the timeline reducer
  (`useTimeline.ts:676-721`): any future code that sets the size through `updateProject`
  instead of the reducer would be silently reverted.
