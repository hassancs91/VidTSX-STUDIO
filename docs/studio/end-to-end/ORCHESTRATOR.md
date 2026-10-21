# END_TO_END_PLAN.md — orchestrator state

> Run brief: `docs/studio/END_TO_END_RUN.md`. One part at a time; a part is DONE only when its
> exit is met with evidence, the gates pass, the STATUS.md row and TESTING.md §18 block exist,
> and it is committed on `end-to-end-p0`. Stop after every part for Hasan's "go".

- Branch: `end-to-end-p0`, cut from `main` at `14d7a63` (the Q6 commit) on 2026-10-21 18:41 +0300.
- Type gate baseline at the branch point: web 26 / node 10 (`scripts/check-types.mjs:7-10`).
- Disk at the branch point: C: 25 GB free, D: 7.0 GB free.

| Part | Status | Builders spawned | Verifier result | Commit | Exit numbers | Started / Finished |
|---|---|---|---|---|---|---|
| A1 | BUILDING | 0 | — | — | — | 2026-10-21 18:42 / — |
| A2 | TODO | | | | | |
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
