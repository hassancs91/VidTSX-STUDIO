# Next session — resume END_TO_END_PLAN.md at B1

> Written 2026-10-22 11:05 by the session-1 orchestrator, on Hasan's request ("I want to continue
> B in a new session"). Session 1 ran Q6, A1–A6 and the track-A exit, then started B1.

## State right now

- **Branch** `end-to-end-p0`, head `b445885` (B1 step-A hand-off), 74 commits ahead of `main`.
  `main` = `14d7a63` (the Q6 commit, local only). **Nothing pushed.** Working tree clean. No app,
  render, or agent running.
- **Track A: DONE** — A1–A6 each passed an independent verifier (A6 on round 2), and the track-A
  exit passed fresh. Numbers, commits and every finding: `ORCHESTRATOR.md` (table + "From A1…A6",
  "From the track-A exit").
- **Track B:** decisions recorded in `ORCHESTRATOR.md` → "Track B decisions" (M2 on C:, Hasan's
  AssemblyAI transcripts, the A5 profile as the source, B4/B5 waiting on Hasan, editor repo
  read-only). **B1 is in progress:** step A done (`2dc5add`: 16 kHz waveform job with per-bucket
  `zcr`, cache v3, `rms-envelope.ts`, `snapHead`, fricative `snapTail`, `minSkip` merge, the four
  optional knobs, 29 tests, gates green). **Next:** M2 setup, then the cutlib comparison (the
  exit), CDP click-through, STATUS row, TESTING §18.7 — see `B1/HANDOFF.md` → "Next step".
- **Disk (11:02):** C: 38 GB free, D: 3.9 GB free (tight — M2's proxies and caches go on C:).
  The M2 root `C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root` does not exist yet.
- **Kept material:** `.vidtsx-temp/end-to-end/A5/profile` (377 MB: full ffmpeg installed in-app,
  NVENC proxies on by default, warm fonts) — copy it for every new isolated profile;
  `.vidtsx-temp/end-to-end/v14-root` (the video-14 copy with all 55 bundles fixed). Profiles of
  finished parts were deleted to free D: (allowed: isolated profiles only).

## How to resume (paste this into a new Claude Code session at `D:\repos\VidTSX-STUDIO`)

```
You are the ORCHESTRATOR for docs/studio/END_TO_END_PLAN.md, resuming a run. Follow
docs/studio/END_TO_END_RUN.md exactly (everything below its line: the loop, the 30 % hand-off
rule, the builder and verifier briefs, the stop report, the "things you never do"), with the
overrides below. Read first: CLAUDE.md; docs/studio/END_TO_END_PLAN.md; the top of STATUS.md;
docs/studio/end-to-end/NEXT-SESSION.md; docs/studio/end-to-end/ORCHESTRATOR.md (table, "Answers
in force", "Stops", every "From …" section, "Track B decisions"); docs/studio/end-to-end/DRIVING.md;
docs/studio/end-to-end/B1/HANDOFF.md; docs/ui-automation-cdp.md; docs/studio/TESTING.md §17–18.

Overrides for this run:
1. Answers: as recorded in ORCHESTRATOR.md "Answers in force" (Q1–Q6). Q6 is done.
2. Scope: continue B1 from its HANDOFF.md "Next step", then B2, B3, B4, B5, B6, then the track-B
   exit check. Do not stop between parts. Stop after the track-B exit, or on BLOCKED, or after
   three verifier FAILs on one part.
3. B4 and B5 depend on me: build and verify everything up to my step (B4: my redo of the 21 Act-1
   joins on M2; B5: my by-ear pass of the Transcript tab, then the flag flip), mark the part
   WAITING-HASAN in ORCHESTRATOR.md with exactly what I must do, and continue. B6 runs.
4. Add to every builder brief: "Also read docs/studio/end-to-end/DRIVING.md and the 'Track B
   decisions' section of docs/studio/end-to-end/ORCHESTRATOR.md. Edit HANDOFF.md with the
   Edit/Write tools, not a PowerShell read-and-rewrite. Never hand back while a job you started
   (render, proxies, waveforms, a check) is still running — wait for it inside your own session."
5. Verifiers: give the exit, the safety rules from DRIVING.md, the commit range of the part, and
   any previous verifier round's findings — never the builder's conclusions. Ask them to build
   their own negative and control cases where the exit is a measurement.
6. The orchestrator writes only under docs/studio/end-to-end/ and commits those files after each
   update, so every builder starts on a clean tree.
```

## Lessons from session 1 (apply them)

- **Do not wait on a notification for a builder that already handed back.** A5's builder #3
  returned `status: HANDOFF` with its Standard render still running as background work; the
  render finished at 21:48 UTC, the builder never re-reported, and the run sat idle ~5 h 40 min.
  The brief line in override 4 fixes the cause; if it happens anyway, check the job's log and
  processes yourself after the expected end time.
- **Verifiers with their own negatives catch real bugs.** A6 round 1 built shifted copies at
  27 / 33 ms and found an off-by-one frame label (the bundled ffmpeg repeats the first frame on
  ~1/3 of seeks unless `-fps_mode passthrough`) that the builder's ±50 / ±100 ms cases could not
  see.
- **Orchestrator decisions go into the part's HANDOFF.md** as an "Orchestrator override"
  paragraph at the top of "Next step", or as a "DECIDED" line under Open problems; builders follow
  them. Decisions taken in session 1 are listed in ORCHESTRATOR.md.
- **Disk:** D: is the repo drive and is tight. Delete isolated profiles of DONE parts when it
  drops under ~3 GB (allowed); never delete anything else outside docs/studio/end-to-end/.
- **Material traps found:** `build-video14.mjs` and `warm-fonts.mjs` in Hasan's video-14 notes write
  to his real project/profile (only edited copies are run); the video-14 copy reads the original's
  media by absolute path (read-only); the raw clip `0366` is cut entirely (B1's "clip 1" = `0369`).
- Git tracks the status file as `Status.md`.

## Waiting on Hasan (collected from track A — details in ORCHESTRATOR.md)

1. `%TEMP%` held 3,135 leftover `puppeteer_dev_chrome_profile-*` folders (22 GB) at A2 and 1,518 at the
   track-A exit (some were removed meanwhile, not by us): delete them, and decide whether the app should sweep its own (stills, builder,
   Creator renders still leave one per browser).
2. His real `~/Videos/VidTSX Studio/projects/video-14` still has the 55 OLD shot bundles — exports
   from his profile will still time out until it is re-bundled (the copy's guarded
   `notes/import/build-video14.mjs --shots-only --proj=<dir>` does it; there is no in-app
   re-bundle). The same applies to any project bundled before `c3aefe8` with a `@remotion/*` font.
3. Follow-up bugs found and NOT fixed (each listed under "From A…" in ORCHESTRATOR.md): bundling
   progress shown ×100; Fast/Fastest say "Needs the GPU encoder download" when installed; Fastest
   progress goes backwards between spans; queue row says "CPU usage: All cores"; refusals show
   only in Queue › Details; A/V check reports a wrong number (right verdict) for 1.6–2 s offsets;
   the disk estimate is ~5–15× high; files over the 300-line rule (`useTimeline.ts`,
   `virtual-modules.ts`, `remotion-renderer.ts`, `media-jobs.ts`).
4. Track-B items that need him: B4 (redo the 21 Act-1 joins on M2), B5 (by-ear Transcript-tab pass
   + flag flip), marking the editor repo's `clean-cut` skill superseded.
5. Merging `end-to-end-p0` into `main` and pushing are his calls.
