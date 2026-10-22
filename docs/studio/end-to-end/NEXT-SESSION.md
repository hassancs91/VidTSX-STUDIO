# Next session — END_TO_END_PLAN.md after track B

> Written 2026-10-23 01:30 by the session-2 orchestrator, at the stop Hasan set ("stop after the
> track-B exit"). Session 1 ran Q6, A1–A6, the track-A exit and B1 step A; session 2 ran B1 (rest)
> → B6 and the track-B exit. Everything is in `ORCHESTRATOR.md` (table, "From B1…B6", "B4/B5 —
> WAITING-HASAN", "TRACK B EXIT").

## State right now

- **Branch** `end-to-end-p0`, ~182 commits ahead of `main` (`main` = `14d7a63`, local only).
  **Nothing pushed.** Tree clean after the orchestrator's last commit. No app, agent or job running.
- **Track A: DONE.** **Track B:** B1, B2, B3, B6 DONE (each passed an independent verifier — B2 and
  B6 on round 2); **B4 and B5 WAITING-HASAN** (built and verified up to his step); **track-B exit
  NOT MET** — E2's "hard entries 0" fails on the cut the assistant produced (6 of 146 real joins,
  all at the end of an editorial item; Auto Cut 0/113); the other clauses are met (style = his fitted
  tight 12/12; median lead-in/tail 0/+6 ms; overlap 90.51 % reported, next-round bar proposed).
- **Disk (01:27):** C: 15.6 GB, D: 31.7 GB free (someone freed D: during session 2). Session-2
  scratch on C: under `C:\Users\hasan\AppData\Local\vidtsx-e2e\` (`profiles\source` = the copy
  source; B1–B6 scratch roots/profiles; verifier folders). **Reserved, never reuse:**
  `B1-verify-root` + `profiles\B1-verify` = Hasan's B4 station; `B5-station-root` +
  `profiles\B5-station` = his B5 station.

## Waiting on Hasan (exact steps in the files named)

1. **B4** — redo ~21 Act-1 joins on his B4 station and read the learn card:
   `docs/studio/end-to-end/B4/HASAN-STEP.md` (~25–30 min; run `B4/hasan-station.ps1`; Snap OFF
   first; pass rule (a): head 0.12–0.18, minTail 0.05–0.11, margin 11–13).
2. **B5** — by-ear pass of the Transcript tab on the 21-min long project:
   `docs/studio/end-to-end/B5/HASAN-STEP.md` (run `B5/hasan-station.ps1`); then his calls: apply
   `B5/backfill-fix.patch` if Part A says the moved word starts are wrong; flip
   `src/shared/feature-flags.ts:73` `studio-text-edit` → true if the pass is clean (diffs + commit
   messages are in HASAN-STEP.md).
3. **B6** — confirm or change the PROPOSED next-round bar (Status.md B6 row / TESTING §18.12).
4. **Track-B exit** — decide whether to fix the editorial hard entries now (a "B7": the 1.0 s
   silent-sliver merge `MERGE_SILENT_KEEP_MAX`, editorial cut-ins at a removed word's end / inside
   a head pad / the cut clamp slicing an onset, Auto Cut planning over already-cut spans, and the
   assistant applying cards its own QA flagged) or move to track C; and mark the editor repo's
   `clean-cut` skill superseded for cutting (that repo is read-only for this plan).
5. **Carried from track A** (ORCHESTRATOR "From A…"): the `%TEMP%` puppeteer profiles (1,532 /
   10.1 GB at 16:00 on 10-22) and whether the app should sweep its own; his real `video-14` still has
   the 55 OLD bundles; the A-track follow-up bugs list.
6. **Housekeeping:** `…\vidtsx-e2e\B5-verify\station-settings-copy\` holds a copy of the B5 station
   profile's `settings.db` (made by a verifier) — delete it if unwanted; D:'s
   `.vidtsx-temp/end-to-end/A5/profile` and `B1/profile` (DONE parts' profiles) can go; the scratch
   folders on C: can go once B4/B5 are done (keep the two stations until then).
7. Merging `end-to-end-p0` into `main` and pushing are his calls.

## How to resume (paste into a new Claude Code session at `D:\repos\VidTSX-STUDIO`)

```
You are the ORCHESTRATOR for docs/studio/END_TO_END_PLAN.md, resuming a run. Follow
docs/studio/END_TO_END_RUN.md (the loop, the 30 % hand-off rule, the builder and verifier briefs,
the stop report, the "things you never do"), with the overrides below. Read first: CLAUDE.md;
docs/studio/END_TO_END_PLAN.md; the top of Status.md; docs/studio/end-to-end/NEXT-SESSION.md;
docs/studio/end-to-end/ORCHESTRATOR.md (table, "Answers in force", "Stops", every "From …"
section, "Track B decisions", "B4/B5 — WAITING-HASAN", "TRACK B EXIT"); docs/studio/end-to-end/DRIVING.md;
docs/ui-automation-cdp.md; docs/studio/TESTING.md §17–18.

Overrides for this run:
1. Answers: ORCHESTRATOR.md "Answers in force" (Q1–Q6).
2. Scope: <Hasan fills in — e.g. "record my B4/B5 results", "B7: fix the editorial hard
   entries, then re-run the track-B exit", or "start track C at C1">.
3. Every builder brief adds: "Also read docs/studio/end-to-end/DRIVING.md and the 'Track B
   decisions' section of ORCHESTRATOR.md. Edit HANDOFF.md with the Edit/Write tools. Never hand back
   while a job you started is still running. Never read, copy or open a credential store
   (settings.db, ~/.claude). Select your own processes by --remote-debugging-port or profile path,
   never a bare number."
4. Verifiers: the exit, DRIVING.md's safety rules, the commit range, earlier verifier findings —
   never the builder's conclusions; their own negative and control cases where the exit is a
   measurement; instructions written for Hasan are walked LITERALLY with real input.
5. The orchestrator writes only under docs/studio/end-to-end/ and commits after each update.
```

## Lessons from session 2 (apply them)

- **Instructions for Hasan must be walked literally with real mouse input before they ship.** B4's
  HASAN-STEP.md failed two verifier rounds that reducer-driven tests could not see: Snap (on at
  every open, 8 px pull) swallowed 30–50 ms trims; with ripple on a lead-in edge returns to the join,
  so "the edge stays where you dropped it" was wrong; the transition square / fade dots sit on the
  trim handles.
- **Verifiers that rebuild the measurement find record errors** (B6: a float at the 0.3 s boundary,
  a flag counted as untouched that was cut) and real bugs (B5: closing during a Windows file lock
  lost the edit).
- **The permission classifier refuses deletes/moves of scratch data and anything touching credential
  stores.** Don't work around it; decide another way (B1/B2 disk: copy instead of move, lower the
  stop line, reuse scratch) or leave it for Hasan.
- **Other Claude sessions share this machine** (CPU at 100 %, C:/D: swinging by 10+ GB): the vitest
  gate rules in DRIVING.md ("under load", "while C: is low"); never kill by a bare port number (a
  session-2 builder killed another session's Chrome that way).
- **A finished builder can hold an idle background shell** and re-notify; check its processes
  yourself, and stop the task if its work is committed.
- **Poll project.json no faster than every 200 ms** — a 50 ms poller blocked the app's rename on
  Windows and caused a phantom "2× delete".
- Git tracks the status file as `Status.md`.
