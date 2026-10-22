# B5 — `studio-text-edit` on in production after Hasan's pass on M2 (AssemblyAI transcript, by ear, long project)
status: NEW

Read `docs/studio/end-to-end/DRIVING.md` with this file (safety; the disk rules — the low-disk
"reuse, don't copy" rule is relaxed now, see below; the vitest gate rules; the process-kill lesson;
every "Learned" line) and the **"Track B decisions"** section of
`docs/studio/end-to-end/ORCHESTRATOR.md`. B1–B3 are DONE and B4 is WAITING-HASAN — read their
Status.md rows (top of `Status.md`): B2 made Transcript deletes snap with the project's RESOLVED cut
style (tight by default); B4 tags Transcript-delete edges `'text-delete'` (not learning samples).

**Never hand back while a job you started (the app, proxies, waveforms, a check) is still running —
wait for it inside your own session.**

## Goal (the §3 row verbatim + the exit)

| Part | What | Exit |
|---|---|---|
| **B5** | `studio-text-edit` on in production after Hasan's pass on M2 (AssemblyAI transcript, by ear, long project) | his pass clean; flag flipped |

**This part depends on Hasan** (ORCHESTRATOR "Session 2" overrides): his by-ear pass and the flag
flip are HIS. Build and verify everything up to his step — an automated pre-pass that finds and
fixes what a machine can find on the long project, a ready station, his instructions, and the flip
prepared but NOT applied — then the orchestrator marks B5 `WAITING-HASAN`.

Session gates (plan §3 head): `npx vitest run` green (DRIVING.md rules), `npm run check:types` at or
below baseline (web 26 / node 10), a live CDP click-through on an isolated profile, the Status.md
row (git tracks it as `Status.md`), the TESTING.md §18 block (`### 18.11 B5`, after `### 18.10 B4`).

## Plan context (§1.x facts, §2 decision, §5 items to read)

- **§1.1 (:102-104):** "The Transcript tab is behind `studio-text-edit: false`
  (`feature-flags.ts:73`): on in dev, hidden in production; STATUS 2026-09-17 lists it as not
  verified on a long project, on AssemblyAI transcripts, or by ear." §5: "The Transcript tab is
  unverified on long projects and AssemblyAI transcripts; B5 is Hasan's pass, not a code change."
- **STATUS 2026-09-17 "TEXT-BASED EDITING slice 1" (Status.md ~:749-769):** click a word to seek,
  karaoke highlight, select words and delete them (edges snapped to the waveform's RMS), deletion
  pills that restore, filler tint + remove, read-only while an Auto Cut review is open; a delete is N
  timeline spans in ONE undo step; no new IPC. **Open there:** `trimClip`, `trimClipRippleAll` and
  `applyCutProposal` ignore clip speed; captions drop durationless words (`clipWords`); not verified
  on a long project, on AssemblyAI / ElevenLabs transcripts, or by ear. Design:
  `docs/NEXT_FEATURES_DESIGN.md` §Q5 "Slice 1 outcome". Files: `transcript-doc.ts`,
  `text-delete.ts`, `text-restore.ts`, the Transcript tab components (`LeftPane.tsx`, grep
  `studio-text-edit`).
- **Material:** M2 = `video-14-raw` (nine raw DJI clips, 3840×2160 59.94 fps sources in a 60 fps
  project, v3 waveforms, Hasan's AssemblyAI transcripts mapped through Studio's own
  `AssemblyAiProvider.mapJob` — word counts 27/44/97/207/183/602/40/330/290 = 1,820; clip ↔ asset ids
  in `docs/studio/end-to-end/B1/HANDOFF.md` "Done"). The shared M2 is
  `C:\Users\hasan\AppData\Local\vidtsx-e2e\b-root\projects\video-14-raw` — NEVER modify it.

## Orchestrator decisions (DECIDED — follow them; raise objections under Open problems)

1. **Disk is fine again** (C: ~19 GB, D: ~33 GB at hand-off): new copies are allowed while C: stays
   above ~5 GB — check before each. Builders work on a NEW scratch copy
   `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5-root\projects\video-14-raw` (copied from the shared
   M2) with profile `…\profiles\B5\profile` (copied from `…\profiles\source\profile`), CDP 9321.
   Hasan's B5 station is ANOTHER copy: `…\vidtsx-e2e\B5-station-root` + `…\profiles\B5-station\profile`
   (never the B4 station `B1-verify-root` / `profiles\B1-verify` — that one is waiting for his B4
   pass). If a copy is refused by the permission classifier, don't work around it — say so and use
   `B2-root` + `profiles\B2\profile` (scratch) instead.
2. **The long project** = all nine clips on V1 in raw order (0366 … 0376), nothing cut — the whole
   raw recording as one timeline (record its length). That is what "long project" means here.
3. **Automated pre-pass (the machine's half of "his pass"):** on the long project, with real mouse
   and keyboard input over CDP, measure and fix: the tab opens and shows all 1,820 words with
   AssemblyAI's text (punctuation, casing) and their times (spot-check ≥ 20 words against the
   transcript JSON); open time and scroll/karaoke smoothness on a 30-min document (record ms);
   click-to-seek lands on the word (± one frame) across all nine clips; select + delete inside one
   clip, across a clip boundary, a long selection (≥ 60 s), a single short word, the first and the
   last word of a clip; each delete = one undo step, the cut edges are the RESOLVED style's (B2) and
   the edges get `'text-delete'` tags (B4); restore pills restore exactly; undo/redo round-trips;
   filler tint + remove on AssemblyAI's fillers (does AssemblyAI emit "um/uh" at all in verbatim
   mode? say what you find); read-only while an Auto Cut review is open; save + reopen keeps
   everything. Also check the 2026-09-17 open items on THIS material (clip speed is 1 here — say
   so; captions dropping durationless words — AssemblyAI words have durations). Fix real bugs you
   find (unit test first); anything big → Open problems for the orchestrator.
4. **Hasan's station + `docs/studio/end-to-end/B5/HASAN-STEP.md`:** the long project ready on the
   B5 station (Transcript tab available — it is a dev build, the flag is on in dev), a launcher like
   B4's (`hasan-station.ps1` pattern: this branch's dev build, the station profile only, never his own
   profile/projects, a `-Reset` that backs up first), and a by-ear checklist: what to do (≥ 10
   deletes of different kinds — a retake, a filler, a word inside a sentence, across clips — each
   played back across the join), what "clean" means (no clipped word starts/ends, no audible
   click, no word lost or doubled, restore brings back exactly what was removed), where to note a
   problem (timecode + word), and the time it takes. Say plainly that the flag flip is his call after
   the pass.
5. **The flip is prepared, NOT applied:** the exact change (`src/shared/feature-flags.ts:73`
   `'studio-text-edit': false` → `true`, plus anything else that gates it in production — grep) is
   written into HASAN-STEP.md as the one-line diff and the commit message to use; do not commit it.
6. **Also (B4 doc debt, small):** Status.md's B4 row (~:92, ~:114) and TESTING §18.10 (~:410) say
   "4 clicks = 320 px/s" — true only from the opening zoom; HASAN-STEP.md now says "zoom in until
   the + magnifier greys out (5–6 clicks from Zoom to fit)". Align them.

## Done (file:line, commit hashes)

(nothing yet)

## Verified (exact commands + outputs)

(nothing yet)

## Next step (ONE concrete instruction)

Make the B5 scratch copy + profile (decision 1), put all nine clips on V1 in raw order (decision 2;
record the length and the word count the tab shows), launch on CDP 9321, and run the first half of
the automated pre-pass (decision 3: open time, word count + 20-word spot-check, click-to-seek on
every clip, karaoke/scroll) — record numbers and any bug, then hand off.

## Open problems

(none yet)

## Do-not-redo

- B1–B3 DONE; B4 WAITING-HASAN — do not touch the B4 station or B4's code. Track A DONE. Do not
  touch `main`. The editor repo is READ-ONLY. Do not apply the flag flip.

## Agents so far (date · approx tool calls · what they covered)

(none yet)
