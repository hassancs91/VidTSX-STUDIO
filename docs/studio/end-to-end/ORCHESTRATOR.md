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
| A2 | DONE | 5 | PASS (1 round) | `dd77b87`, `88de827`, `4b1156d` (code); docs `fe82d07` | Standard + Fast cancel → 0 new `%TEMP%` entries, no scratch, no output; refusal "C: needs about 609 MB … has 286 MB" (verifier also D: 580 vs 95 MB); 10 s 1080p60 export 4.3 MB vs 23 MB estimate; types 26/10; vitest green on rerun 3 | 2026-10-21 19:20 / 20:37 (77 min) |
| A3 | BUILDING | 1 | — | — | — | 2026-10-21 20:40 / — |
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
- 2026-10-21 20:37 · A2 DONE (verifier PASS, 1 round; 5 builders). Continuing to A3 per Hasan's
  instruction (no stop).

### From A2 (for the track-A stop report)

- **Hasan's decision:** `%TEMP%` holds ~3,135 `puppeteer_dev_chrome_profile-*` folders, **22 GB**,
  all from the last 10 days — Remotion never deletes its Chrome profile on Windows; every Remotion
  browser outside an A2 scope leaves one (Studio shot stills, TSX-builder stills, Creator renders,
  the GPU probe outside an export, other tools). A2 closed only the export and bundle-listing paths.
  Nothing deleted; no sweep added.
- Rule note: A2 builder #4 downloaded the full ffmpeg (80.1 MB) into the A2 isolated profile
  although A2's row does not name it (needed to make Fast selectable for the Fast cancel). Hasan
  had been told A4/A5 download it.
- During a render Remotion's headless Chrome writes ~168 MB of `<guid>.tmp` files to the real
  `%TEMP%` (it inherits `TEMP`; the in-process scope cannot reach a child's env); gone after the
  cancel; not counted by the estimate (512 MB headroom covered it at 1080p — watch at 4K in A5).
- Estimate runs ~5.4× high on 1080p footage (safe direction) — recheck on 4K in A5.
- The disk check runs after bundling (a refused export spends 10–40 s bundling first).
- Follow-ups, not built: an estimate line in the Export dialog (orchestrator decided the refusal
  message satisfies "estimate shown"); queue row shows "CPU usage: All cores" though main applies
  the Settings default (pre-existing display bug); bundling progress shows values like "9244%"
  (pre-existing); the shared `%TEMP%\vidtsx-studio` scratch is swept by any instance's startup
  (pre-existing hazard).
- Fast needs an app restart after the in-app full-ffmpeg install to become selectable
  (DRIVING.md "Learned"); the live Fastest cancel check moved to A5.
- The `shot-generator.test.ts` flake also fails when that file runs alone (1 in 5) — not only
  under full-suite load.
