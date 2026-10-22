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
| A3 | DONE | 4 | PASS (1 round) | `c3aefe8` (code); docs `2daaef1`, `dea786d`, `7a088ab` | 5 s 4K60 Standard range (0:06–0:11) 300/300 frames in 233 s (verifier 226 s); brand-font hold released (verifier watched it in the render tabs); 55/55 bundles 0 `remotion_delayRenderHandles` (verifier rebuild byte-identical); Player 0 handles after open; types 26/10; vitest: known shot-generator flake failed 3/3 full runs (verifier) | 2026-10-21 20:40 / 21:42 (62 min) |
| A4 | DONE | 9 | PASS (1 round) | `3417d46` (fonts), `4671622` (GPU default), `139a4a9` (card), `3d450ba` (re-queue on GPU); test fix `22593db`, `0afc196`; docs `63e8f04` | font: cold+blocked refused (103 files missing); warm 103 URLs 0 failed; blocked-after-warm export completed (fetched 0, cached 202; 1080p 5 s in 161–182 s). GPU: card 1.3–1.6 s after a 4K import; 80,069,496 B download ~80–106 s; triggering clip rebuilt `h264_nvenc` in 6.2–7.9 s (x264 22–24 s); no Settings visit, no settings write, no restart. vitest 428 files / 3598 green; types 26/10 | 2026-10-21 21:45 / 23:49 (124 min) |
| A5 | DONE | 4 | PASS (1 round) | `06edaf0` (render stall guard), `f84a78d` (font fetch retry); docs `08bf046`, `31542e7` | 80–110 s (frames 4800–6600, split + 3 cutaways) at 3840×2160@60, CPU low: Fastest 1178 s / 1.53 fps, 35.1 MB (verifier re-render 936 s / 1.92 fps, audio MD5 identical); Standard 1046 s / 1.72 fps, 17.0 MB; Fastest copies 0 % of video-14 (all shots); Fastest cancel leaves nothing; vitest 431 / 3623 green; types 26/10 | 2026-10-21 23:55 / 2026-10-22 07:08 (≈ 7 h 13 min, of which ≈ 5 h 40 min idle — see Stops) |
| A6 | BUILDING | 1 | — | — | — | 2026-10-22 07:15 / — |
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
- 2026-10-21 21:42 · A3 DONE (verifier PASS, 1 round; 4 builders). Continuing to A4.

### From A3 (for the track-A stop report)

- **Hasan's own `~/Videos/VidTSX Studio/projects/video-14` still has the 55 OLD bundles** (1
  `remotion_delayRenderHandles` hit each, untouched by design) — exporting it from his profile
  will still time out until it is re-bundled; the same holds for any project whose shots were
  bundled before `c3aefe8` with a `@remotion/*` font load. There is no in-app re-bundle. The
  fixed copy is `.vidtsx-temp/end-to-end/v14-root/projects/video-14` (its `notes/import/
  build-video14.mjs` has a guarded `--shots-only --proj=<dir>`; refuses Hasan's folder).
- Parity spike passed: the inlined 4.0.486 google-fonts code needs only
  `NoReactInternals.ENABLE_V5_BREAKING_CHANGES`, present in 4.0.435. No §5 fallback.
- The copy reads all 127 media from the original's `media\` by absolute path (read-only).
- `virtual-modules.ts` 357 lines (339 before A3; over the house rule).
- **Gate erosion:** `shot-generator.test.ts` failed in all 3 of the A3 verifier's full runs (plus
  a loaded-machine run with 9 timeouts); it passes alone. Orchestrator decision: A4's builder
  root-causes it first (bounded), fixes it only if it is test isolation, records it if it is a
  product race.
- Doc over-claim: TESTING §18.3 (:303) cites `shot-import.test.ts` for the shared classifier rule;
  no such case exists — A4's builder adds it.
- 2026-10-21 23:49 · A4 DONE (verifier PASS, 1 round; 9 builders). Continuing to A5.
- 2026-10-21 ~23:20 · Hasan (going to sleep): "when you are done from A, go B end to end … same with
  multiple agents. will check up when I wake up" → after the track-A exit, run B1…B6 the same way;
  stop after track B (or on BLOCKED / 3 FAILs). Plan for the Hasan-dependent exits (told to him):
  B4 built and verified up to "waiting on Hasan's 21-join pass"; B5 = prepare M2 for his by-ear pass,
  the flag flip stays his; B6 runs. Local whisper preferred for transcripts; the editorial pass runs
  on his subscription from a COPY of his settings on an isolated profile.

### From A4 (for the stop report)

- Step 0 found the `shot-generator.test.ts` flake was a TEST bug (cancel after one timer tick
  before the run was tracked; the orphaned run cascaded) — fixed test-only (`22593db`); full suite
  green 3× in a row since. `shot-module-resolver.test.ts:151` still times out under load sometimes.
- An encoder crash seen ONCE in A4 step 4b (Remotion's `react-motion-render*` folder vanished
  mid-render; not reproduced in 3 traced back-to-back runs; no other instance started; our deletes
  traced and ruled out). Remotion's `renderMedia` never settles when its pre-encode ffmpeg dies, so
  the job sat at "rendering" 11 min → guard moved to A5 step 0.
- Verifier finding: `font-proxy.ts:59-91` `fetchAndCache` has no retry; one undici `terminated`
  blip on 2 of 104 files refused a warm-up export with the untrue "Google Fonts could not be
  reached" (`font-preflight.ts:40-42`) → moved to A5 step 0. Preflight counters double-count
  (log only). Card says "76 MB" (MiB) vs the plan's 80.1 MB.
- Refusals (disk A2, fonts A4) show only in the Queue row's Details, not in the editor.
- GPU "on automatically" is NVIDIA-only by design (QSV/AMF stay opt-in, speeds unmeasured).
- The font preflight is strict per URL: a project's FIRST export needs the network once (103
  files for video-14, ~2 MB), then exports work offline.
- 2026-10-22 07:08 · A5 DONE (verifier PASS, 1 round; 4 builders). **Orchestrator stall:** builder
  #3 handed back with its Standard render still running as its own background work; the render
  landed at 21:48 UTC, but builder #3 never re-reported and the orchestrator waited for a
  notification until Hasan asked "what now?" at 03:30 UTC (≈ 5 h 40 min idle). Fix: every builder
  brief now says "never hand back while a render or other long job you started is still running".
  Freed D: by deleting the A4-verify and A5-verify isolated profiles (723 MB; reports and exports
  kept). Continuing to A6.

### From A5 (for the stop report)

- video-14 is all shots, so Fastest copies 0 % of it; on 80–110 s the builder measured Fastest
  1.53 fps vs Standard 1.72 fps, but the verifier's Fastest re-run did 1.92 fps (another session's
  QA load during the builder's run) — single runs, not a ranking.
- Fastest's progress goes BACKWARDS between spans (94 % → 77 %, "about N min left" resets): each
  span reports its frames twice (layer render, then the ffmpeg pass); a 167 s stretch with no
  progress event inside span 0.
- Bundling progress is reported 100× (`render-handlers.ts:199`, "bundling 10000%"); Fast/Fastest
  rows always say "Needs the GPU encoder download" even when installed (`export-engines.ts:46,54`).
- The disk estimate is high at 4K (268 MB output estimated vs 17–35 MB actual; 13.6 GB temp) —
  safe direction, but it could refuse an export on a nearly full disk that would have fit.
- The stall guard (a dead encoder now fails the job after ~12 min of no frames) and the font fetch
  retry are unit-tested only; neither failure could be provoked live.
- `remotion-renderer.ts` 444 lines (434 before; over the house rule).
