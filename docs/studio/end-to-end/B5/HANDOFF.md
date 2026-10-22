# B5 — `studio-text-edit` on in production after Hasan's pass on M2 (AssemblyAI transcript, by ear, long project)
status: IN PROGRESS (builder #6 handed off 2026-10-22 — the machine half of the pre-pass is COMPLETE (builders #1–#5); Hasan's B5 station is BUILT (long project, 21:23.09, `b5-no-model`, start snapshot), `B5/hasan-station.ps1` written (`-Reset` dry-run OK), `B5/HASAN-STEP.md` DRAFTED — NOT yet click-checked; next: the literal real-input walk-through of HASAN-STEP.md on the station)

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

- **Scratch copies (decision 1), 2026-10-22:** `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5-root\projects\video-14-raw`
  (580 MB, `cp -r` of `b-root\projects`; `project.json` holds no `b-root` path) and
  `…\vidtsx-e2e\profiles\B5\profile` (377 MB, from `profiles\source\profile`). C: 18.47 → 17.54 GB.
  Outputs go to `…\vidtsx-e2e\B5\` (JSON) and `…\B5\stills\`; app log `…\B5\app.log`.
- **Kit (gitignored) `.vidtsx-temp/end-to-end/B5/`:** `launch.sh` (B4's, profile B5, CDP 9321,
  `npx electron-vite dev`), `restore.ps1` (matches `--remote-debugging-port=9321`), `cdp.mjs`
  (default port 9321), `drive.mjs` — `ready | open | spot | seek | karaoke [i j] | scroll | shot`,
  real mouse via `Input.dispatchMouseEvent` (word clicks, tab click, wheel); exports `mouseClick`,
  `openTranscript`, `restore`, `shot`, `CLIPS` for the next driver.
- **The long project (decision 2):** all nine clips on V1 in raw order via the pool's "Add to
  timeline" → on disk `0366@0+20.288 · 0369@20.288+47.698 · 0370@67.986+84.032 ·
  0371@152.018+193.477 · 0372@345.494+118.852 · 0373@464.346+396.246 · 0374@860.592+32.015 ·
  0375@892.608+207.691 · 0376@1100.298+182.849`, every clip `sourceIn 0`, no `speed` field (= 1),
  A1 empty, 0 proposals, no `presetId`/`cutStyle` → **length 1,283.148 s, toolbar `/ 21:23.09`**
  (21.4 min — the "30-min document" of decision 3 is this one).
- **First half of the pre-pass (decision 3), numbers below under Verified.**
- **Problem 1 FIXED (builder #2, `fb32ab1`):** NEW `src/features/studio/services/cache-text.ts`
  `decodeBase64Utf8` (atob → bytes → `TextDecoder`, ASCII fast path) + `cache-text.test.ts` (5: em-dash,
  curly quotes + accent + Arabic, ASCII unchanged, a transcript file round-trip, empty); NEW
  `src/features/studio/hooks/useAssetTranscripts.test.ts` (2: `fetchTranscriptWords` keeps "39—",
  "don’t", "مرحبا" through a stubbed `window.api.studioCacheRead`; a failed read → []). Red first
  (the fetch test showed `39â`, `donât`, `ÙØ±Ø­Ø¨Ø§`). Every `atob(` → text path in
  `src/features/studio` now goes through the helper: `useAssetTranscripts.ts:36` (THE bug — Transcript
  tab + cut-review context), `useAssetEnvelopes.ts:54` and `useStudioMedia.ts:214` (ASCII waveform JSON
  — were not broken, now safe), `analysis-io.ts:16` (was already right; now the one helper).
  `grep -rn "atob(" src/features/studio` → only `cache-text.ts:11`. (Outside studio:
  `tools/VoiceAITesterScreen.tsx:103` decodes AUDIO bytes — binary, correct as is.)
- **Kit, builder #2 (gitignored):** `.vidtsx-temp/end-to-end/B5/deletes.mjs` — `cases [name…] | undo N |
  fillers | karaoke-bottom` (see its header); a case = real drag-select (or click + real SHIFT+click
  when > 25 words), real Delete key, disk diff, toast, pills, real Ctrl+Z (= before), Ctrl+Shift+Z
  (= after), Restore pill(s) by real clicks (content = before), Ctrl+Z × (restores+1) back to the
  original. Writes `…\B5\deletes\<case>.json` = `{ sel, before, after }` for a planTextDelete harness
  (B2's `textdel.b2.test.ts` pattern — NOT written yet). `fillers` and `karaoke-bottom` NOT run yet.
- **Problem 4 ROOT-CAUSED (builder #3, no `src/` change):** the planner, the selection mapping and the
  reducer are right. (1) The 124.8 s state = TWO correct deletes: `long` 709–777 (62.49 s) whose
  autosave FAILED (the 50 ms poller vs `rename`, Problem 5 — bf1 hit the same in that run) so the disk
  kept the original while memory moved on; then `deletes.mjs` re-read the IN-MEMORY doc, its picker
  chose `long` = **709–810** ("this … was", 102 words) on the post-delete doc, and that delete starts
  at the join → one merged gap 101.931 → 226.719 (226.719 = "was".end; "down" starts 226.816, its head
  pad clamps to the cut end). Proven by the harness below (composition == the bad disk exactly). (2)
  The "dead" Restore pill: the pill opens IN PLACE (`DeletionPill.tsx:39-66`) and its Restore button
  lands below the body's visible bottom (button y 488–506, body 102–474, `elementFromPoint` = another
  SPAN) — the driver's click missed; the restore itself is accepted by `restoreDeletion` (the deletion
  record's before/after ids match the timeline). App fix to make: scroll the Restore into view on open.
- **Kit, builder #3 (gitignored, `.vidtsx-temp/end-to-end/B5/`):** `probe-long.mjs [from to] [--delete]`
  (click + SHIFT+click, then the selection's boundary nodes, the DOM `containsNode` view and the
  panel's own selection bar at +50/+250/+1000 ms; `--delete` = one Delete, toast, disk, Ctrl+Z);
  `probe-pill.mjs` (doc deletions + visible pills/Restore); `probe-restore.mjs` (Restore rect vs body,
  `elementFromPoint`); `undo-to-orig.mjs` (real Ctrl+Z until disk == `deletes\inside.json` before);
  `longbug.b5.test.ts` + `vitest.b5.config.ts` (harness, `B5_LONGBUG=1`). `deletes.mjs` `waitDisk`
  now polls every **250 ms** (was 50 — the poll itself broke saves).
- **Problem 5 FIXED (builder #4, `aa58ee8`, tests first):** NEW `src/main/utils/rename-retry.ts`
  `renameWithRetry` (EPERM/EBUSY/EACCES, 8 tries, wait 50 ms × n → 1.4 s worst case; any other code
  thrown at once) + `rename-retry.test.ts` (5: fails twice then succeeds, EACCES, always refused still
  rejects after N, ENOENT not retried, backoff 50 → 100 ms); `project-store.ts:69-77` `writeProjectFile`
  uses it; `project-store.test.ts:64-102` (2: `saveProject` lands after two EPERM refusals; a lock that
  never clears rejects with EBUSY and the old file stays). NEW `src/features/studio/services/autosave.ts`
  `createAutosave` (debounce 600 ms; a refused OR thrown save re-marks dirty and reschedules 1/2/5/10 s,
  last repeats; `flush` waits for a save in flight then writes what is still dirty; `reset` on
  load/restore; after 3 failures in a row state `'error'` until a save lands) + `autosave.test.ts` (8).
  `useStudioProject.ts` now drives it (one autosave per opened project; the close cleanup retries its
  flush 3× at 0.5/1/1.5 s, then disposes and closes; returns `saveError`). `EditorShell.tsx:1210-1227`:
  `[data-save-state]` on the indicator; on `'error'` a persistent red **"Save failed — retrying"**
  (`role="alert"`, title = the error + "your edits are kept…"). Red first: the main tests failed on the
  old `fs.rename` (EPERM at `project-store.ts:73`); the 8 autosave tests run against a port of the OLD
  hook logic (`.vidtsx-temp/end-to-end/B5/old-autosave.ts` + `autosave-old.b5.test.ts`, scratch config)
  → **4 failed | 4 passed** (the dirty-after-failure, throw, reschedule and persistent-error tests).
- **Problem 6 FIXED (builder #4, `aa58ee8`, test first):** `DeletionPill.tsx` — the opened view is now
  the hook-free `OpenedDeletion` (same markup) and its Restore button (or, read-only, the opened span)
  gets the callback ref `revealOnOpen` = `scrollIntoView({ block: 'nearest', inline: 'nearest' })`.
  NEW `DeletionPill.test.ts` (4; red first: `OpenedDeletion is not a function`).
- **Kit, builder #4 (gitignored):** `lockcheck.mjs retry [s] | close [s]` (holds project.json open with
  NO sharing from PowerShell for s seconds, deletes 271–276 through the Transcript, samples
  `[data-save-state]` every 100 ms and the disk every 500 ms; `close` clicks "Back to projects" at once,
  then writes the original project.json back with the project closed). `deletes.mjs` now also stops
  when the in-app doc does not hold 1,820 tokens before a case (Problem 4 lesson).
- **Problem 7 FIXED (builder #5, `e69d182`, tests first): the delete toast over-counted.** "Remove 15
  fillers" cut 13 (two "uh" sit inside their neighbours' pads: 0371 i231 62.660–62.700 between "app"
  …62.660 and "runs" 62.748…; 0373 i580 15.780–15.820 between "a" …15.780 and "desk" 15.847…) but
  toasted "Removed **15** fillers · −13.8 s (2 spots too tight to cut cleanly)". `text-delete.ts`:
  `Run.count`, `TextDeletePlan.removedTokens` (words of every run that was cut; `:41-53`, `:63-80`,
  `:163-172`); `useTextEdit.ts:120` toasts `plan.removedTokens`. `text-delete.test.ts` NEW describe
  "counting what a delete really removes (B5)" (3 tests, the real 0373 "a · uh · desk" times; red
  first: `expected undefined to be 1`).
- **Kit, builder #5 (gitignored):** `.vidtsx-temp/end-to-end/B5/checks.mjs` — `readonly` (delete 271–276
  by click + SHIFT+click + Delete key; real clicks Media tab → 0369's tile → "Auto Cut" → Transcript tab;
  read-only checks with real input; real "Reject all"; resumable when the 271–276 delete is already on
  disk) and `reopen` (a second delete, "Back to projects", the project card, Transcript tab, compare,
  Restore both pills by real clicks, close, write the ORIGINAL project.json back). Saves the original
  as `…\B5\checks\original-project.json`. NB Auto Cut lives in Inspector › "Transcript · <file>" of the
  asset selected in the MEDIA pane — a selected timeline clip shows Clip props instead; the timeline
  does not follow a seek and renders only the clips in view.
- **Hasan's B5 station BUILT (builder #6, decision 1 + 4):** `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5-station-root`
  (580 MB, `cp -r` of `b-root`; 0 `b-root` strings in its project.json) + `…\profiles\B5-station\profile` (377 MB,
  from `profiles\source\profile`); Studio root set in-app to B5-station-root; long project = nine clips on V1 in raw
  order, identical to B5-root's (`0366@0+20.288 … 0376@1100.298+182.849`, 1283.148 s, `/ 21:23.09`, A1 0, 0
  proposals, 0 tags, no presetId/cutStyle); app stopped, then `settings.agent.providerId = "b5-no-model"` (no model
  call possible); **start snapshot** `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5\station-start\project.json`
  (sha256 `2cfaf220…` = the station's project.json).
- **`docs/studio/end-to-end/B5/hasan-station.ps1`** (B4 pattern): this checkout's `npx electron-vite dev` on the
  B5-station profile only; guards (paths, B5 code = `src\features\studio\services\autosave.ts`, station already
  open); `-Reset` (app closed) backs up the station project.json to `…\vidtsx-e2e\B5\station-runs\project.<stamp>.json`
  then copies the start snapshot back and checks the hash; `-CdpPort N` for automation.
- **`docs/studio/end-to-end/B5/HASAN-STEP.md` DRAFT** (top banner "NOT YET CLICK-CHECKED"; `[check]` marks the
  guesses): open the station; how the tab works; what "clean" means (6 points); where to note (row · clock · word ·
  what was heard, or `…\B5\station-runs\notes.txt`); **Part A** = the Problem 2 by-ear block W1–W8 (bf1–bf4 = i117,
  132, 398, 471 + i255 "a" 0371 708 ms, i572 "Now", i1288 "or", i1593 "How"; click → listen, delete → listen,
  Ctrl+Z); **Part B** = 11 kept deletes D11 → D1 in timeline-DESCENDING order so listed clocks stay valid (indices:
  D1 71–81 · D2 215–253 · D3 165 · D4 551–558 across 0372→0373 · D5 375–405 · D6 1134–1159 · D7 `really` · D8 849–850
  · D9 1340–1369 · D10 1530–1543 · D11 1700–1705); **Part C** restore D7 + D4, undo/redo; **Part D** "Remove N
  fillers" + three to listen to; the flip as a one-line diff + commit message (only gate: `feature-flags.ts:73`,
  read at `EditorShell.tsx:110`); the backfill-fix line is a placeholder (not prepared yet).
- **Kit, builder #6 (gitignored):** `launch-station.sh` (station profile, CDP **9325**, log `…\B5\station\app.log`);
  `station-doc.mjs` (real click on the Transcript tab, dumps the in-app doc → `…\B5\station\doc.json` + `doc.txt`);
  `station-table.mjs` (doc.json + raw AssemblyAI JSON + station project.json → the W/D tables, `…\B5\station\table.json`;
  its D2 row still says 215–251 — the right range is 215–253, checked: 252–253 = "Other take.", 254 = "However,").
  `…\B5\station\doc-readable.txt` = the transcript by take with first index (round-to-second heads; the app shows
  FLOOR, e.g. 12:19 not 12:20).

## Verified (exact commands + outputs)

All on the B5 instance (CDP 9321), `cd .vidtsx-temp/end-to-end/B5`; JSON in `C:\Users\hasan\AppData\Local\vidtsx-e2e\B5\`.

- `node drive.mjs ready` → root set to B5-root, nine clips added, `length s 1283.148 toolbar ["/ 21:23.09"]`.
- `node drive.mjs open` (real click on `[data-pane-tab="transcript"]`, 3 visits; Media in between —
  the pane UNMOUNTS on a tab switch, so every visit is a full mount) → header **"1,820 words"**,
  1,820 `[data-i]` in the DOM, 192 paragraphs (takes), **click → all words in DOM 405 / 139 / 241 ms,
  → first paint after 563 / 231 / 360 ms**; long tasks during the open 85+85+188+161 / 135+61+63 /
  235+87+88 ms. Filler button **"Remove 15 fillers"**, 15 tinted words: `0:Um 165:uh 194:uh 219:uh
  231:uh 243:uh 272:uh 580:uh 693:Uh 920:uh 928:uh 1331:um 1346:uh 1522:uh 1534:um`. **AssemblyAI in
  verbatim mode DOES emit fillers: um ×3, uh ×12** in Hasan's nine responses (counted from the raw
  JSON = what the tab tints). `open.json`, still `b5-open.png`.
- `node drive.mjs spot` (every token from `TranscriptPanel`'s `edit.doc` + its DOM span vs Hasan's
  raw AssemblyAI JSON `…\claude-youtube-editor\videos\video-14\work\transcripts\<clip>.json`, read-only,
  mapped through `project.json`'s clips independently) → **1,820 = 1,820**; 291 tokens end in
  punctuation, 268 capitalised (AssemblyAI's text kept); 27-word table (first / middle / last of
  every clip, e.g. `0373 i=859 "a" raw 210349-210448 ms → app 210.349-210.448, timeline 674.695 =
  expected`) all equal. **106 mismatches, two causes — see Open problems 1 and 2.** `spot.json`.
- `node drive.mjs seek` (real click on first / middle / last word of every clip, 27 clicks) →
  **27/27 playhead frame = round(word start × 60) exactly (0 frames off), the clicked word lit
  (`data-active`) 27/27**; the clip's `<video>` currentTime − the word's source start = −14 … +16 ms
  (≤ one 59.94 fps source frame). `seek.json`, still `b5-seek-last.png`.
- `node drive.mjs karaoke 900 1700` (click word 900 / 1700, `playback.play()` 12 s, a per-rAF check
  of the lit word vs `tokenIndexAt(t + 0.025)` with the 0.15 s linger) → **0 mismatched frames** both
  runs; rAF p50 16.7 / p95 17.1 / max 75.8 ms (one hitch at play start) and 16.7 / 17.0 / 32.6 ms;
  26 / 13 lit changes; lit word never out of view; long tasks 103+60 / 62 ms. NB the auto-scroll
  (`scrollIntoView` when the lit word leaves the view) was NOT exercised — 12 s never reached the
  bottom of the view (0 scroll events). `karaoke.json`, stills `b5-karaoke-900.png`, `-1700.png`.
- `node drive.mjs scroll` (real `mouseWheel` at the body centre, 240 px per 16 ms down, −2400 up) →
  whole document (scrollHeight 11,846 px, view 372 px) top→bottom in 3.3 s: rAF p50 16.7 / p95 29.9 /
  max 35.6 ms, 1 frame > 33 ms, 0 long tasks; up: p50 16.7 / p95 21.3 / max 32.7, 0 long tasks.
  `scroll.json`, still `b5-scroll-bottom.png`.
- Backfill measurement (read-only node one-off over B5-root's cache, output `…\B5\backfill.json`):
  129 of 1,820 AssemblyAI words are < 50 ms; `withSpokenSpans` moves the start of 76 of them; 37
  by ≥ 150 ms, 25 by ≥ 500 ms (max = the 1 s cap); in 33 of those 37 backfilled gaps the RMS peaks
  ≥ 15 dB over the clip's 10th-percentile floor (only 2 are quiet).
- App stopped: processes matched by `--remote-debugging-port=9321` / the `profiles/B5/profile` path
  (2 bash, 2 node, 1 cmd, 6 electron) → `left: 0`. Disk after: C: 18.32 GB, D: 32.89 GB.

**Builder #2 (2026-10-22):**
- `npx vitest run src/features/studio/services/cache-text.test.ts src/features/studio/hooks/useAssetTranscripts.test.ts`
  BEFORE the fix → `2 failed` (import error; `"39â", "donât", "ÙØ±Ø­Ø¨Ø§"`); after → green; with
  `src/features/studio/services/` → `Test Files 46 passed (46) · Tests 409 passed (409)`.
- `npm run check:types` → `web: 26 errors (baseline 26) ok · node: 10 errors (baseline 10) ok`.
- FULL `npx vitest run` NOT run yet (do it at the next green checkpoint, app stopped, logged to a file).
- Relaunch (C: 17.83 / D: 32.67 GB before), `node drive.mjs ready` → `length s 1283.148 toolbar
  ["/ 21:23.09"]`; `node drive.mjs spot` → `tokens app 1820 expected 1820 mismatches 76`, kinds
  `{"sourceStart":76,"start":76}` = **0 text / 0 DOM mismatches** (only the 76 backfill starts, Problem 2);
  all 32 em-dash words render (`39— | client's— | application— | … | in—`). punctuated 291, capitalised 268.
- `node deletes.mjs cases inside` / `… across long short first last bf1 bf2 bf3 bf4` (each case starts
  from the ORIGINAL timeline, checked on disk). PASS rows (selection = intended, toast, pills, tags,
  1 undo step, redo exact, restore content-equal, back to original):
  | case | tokens | selected | toast | delete→disk | V1 after | pills | `'text-delete'` edges |
  |---|---|---|---|---|---|---|---|
  | inside (0371) | 271–276 "application— uh other take. For example," 3.73 s | drag 6/6 | `Removed 6 words · −4.0 s` | 967 ms | 10 clips, 1279.103 s | 1 `¶ 4.0s` | end + start of the join |
  | across 0372→0373 | 555–560 "the real magic. Okay, I clone" | drag 6/6 | `Removed 6 words · −2.1 s` | 766 ms | 11 clips, 1281.064 s | 2 (`¶ 1.1s` "the real magic." · `¶ 1.0s` "Okay, I clone") | 4 edges (two joins) |
  | short (0375) | 1372 "one" 65 ms | drag 1/1 | `Removed 1 word · −0.1 s` | 903 ms | 10, 1283.083 s | 1 `¶ 0.1s` | 2 |
  | first of 0370 | 71 "Last" | drag 1/1 | `Removed 1 word · −0.3 s` | 731 ms | 10, 1282.809 s (keeps 0370's 1.83 s head) | 1 | 2 |
  | last of 0374 | 1199 "business." | drag 1/1 | `Removed 1 word · −0.4 s` | 726 ms | 10, 1282.761 s (keeps the 9.3 s tail) | 1 | 2 |
  Every PASS row: tokens 1,820 → 1,814 / 1,819 after; Ctrl+Z → disk == before; Ctrl+Shift+Z → disk ==
  after; Restore → length 1283.148, per-asset source cover == original, clips contiguous, doc text ==
  original, 0 pills; Ctrl+Z ×(restores+1) → disk == ORIGINAL. Files `…\B5\deletes\{inside,across,short,first,last}.json`.
- **bf1** (0370 "I", i 117, backfilled start 41.956 vs AssemblyAI 42.956): delete cut source
  **41.956 → 43.004** (the cut starts at the BACKFILLED start, 1.0 s before the stamp — Problem 2's
  effect, measured); undo/redo fine; the Restore click restored in memory but the UI showed **"Save
  failed"** and the disk kept the deleted state — see Open problem 5 (my 50 ms disk poller vs Windows
  `rename`). `node deletes.mjs undo 2` → `disk == original true · "Saved"`.
- **long** (0373, 709–777 "found the file service … So", 62.49 s; first try: a scrolling drag selected
  only 777 → driver switched to click + SHIFT+click, second try selected 709–777) → see Open problem 4.
  bf2–bf4 not run (the run stopped at bf1).
- App stopped (matched `--remote-debugging-port=9321` / `profiles/B5/profile` / `B5/launch.sh`: 4 bash,
  2 node, 1 cmd, 6 electron) → `left: 0`. The bad long-case state saved as `…\B5\deletes\long-bug-disk.json`;
  B5-root's `project.json` timeline then put back to the original (9 clips, 1283.148 s, 0 tags) with
  the app stopped. Disk: C: 18.06 GB, D: 32.55 GB.

**Builder #3 (2026-10-22):** C: 18.48 / D: 32.70 GB before launch; nothing on 5173/9321.
- `bash .vidtsx-temp/end-to-end/B5/launch.sh` (background) → `node drive.mjs ready` → `length s 1283.148
  toolbar ["/ 21:23.09"]`, A1 0, proposals 0.
- `node probe-long.mjs 709 777` → after the click: caret in 708's `" "` (offset 1, collapsed); +50/+250/
  +1000 ms after the real SHIFT+click: DOM `[709,777,69]`, anchor `"found"` @0 (word 709), focus 777's
  `" "` @1, **selection bar "69 words · 62.5 s"**, body focused → the panel's range IS 709–777.
- `node probe-long.mjs 709 777 --delete` → toast **"Removed 69 words · −62.5 s"**, disk: 10 clips, 0373 =
  `0…101.931` + `164.421…396.246` (exact), one Ctrl+Z → `undo → original true`. **Not reproduced.**
- `node deletes.mjs cases long` (the 250 ms poll) → delete exact (length 1220.658 = 1283.148 − 62.49),
  undo == original, redo == after, then `disk timeout: long restore` → `node probe-pill.mjs`: one
  deletion `…:101.931:164.421:clip_mvjthqz1_gsfuih`, before/after ids = the timeline's, 69 words,
  readOnly false, the pill OPEN with a visible `[data-restore]` → `node probe-restore.mjs` →
  `{"button":[111,488,46,18],"body":[67,102,299,372],"scrollTop":5712.8,"inView":false,"hit":"SPAN
  class","hitIsButton":false}`.
- `$env:B5_LONGBUG='1'; npx vitest run --config .vidtsx-temp/end-to-end/B5/vitest.b5.config.ts` →
  `Test Files 1 passed (1) · Tests 1 passed (1)`: pickLong(original) = [709,777]; delete → 69 tokens,
  removedSeconds 62.490; pickLong(post-delete doc) = **[709,810]**; its delete composed on top ==
  `long-bug-disk.json`'s V1 (asset, timelineStart, sourceIn, duration per clip); a single delete
  reaches that state only with 171 words (709–879), which the panel never held.
- `node undo-to-orig.mjs` → `undo 1 disk == original true` · `"Saved"`. App stopped (matched
  `--remote-debugging-port=9321` / `profiles/B5/profile` / `B5/launch.sh`: 4 bash, 2 node, 1 cmd,
  6 electron) → `left: 0`. Disk after: C: 18.45 GB, D: 32.70 GB. B5-root is at the ORIGINAL timeline.
- No `src/` change this session → vitest / type gate not re-run (last: builder #2, green, 26/10).

**Builder #4 (2026-10-22):** C: 18.03 / D: 32.43 GB before launch; nothing on 5173/9321.
- `npx vitest run src/main/utils/rename-retry.test.ts src/main/services/studio/project-store.test.ts`
  before the fix → `2 failed` files (import error; `EPERM … at writeProjectFile project-store.ts:73`);
  after → with `autosave.test.ts` `Tests 19 passed (19)`. `DeletionPill.test.ts` before → `4 failed`
  (`OpenedDeletion is not a function`), after → `4 passed`.
- `npx vitest run src/features/studio src/main/services/studio src/main/utils src/main/ipc` →
  `Test Files 151 passed | 2 skipped (153) · Tests 1217 passed | 23 skipped (1240)`.
- `npm run check:types` → `web: 26 errors (baseline 26) ok · node: 10 errors (baseline 10) ok`.
- `bash launch.sh` (background) → `node drive.mjs ready` → `length s 1283.148 toolbar ["/ 21:23.09"]`.
- `node lockcheck.mjs retry` (6 s lock) → indicator `Saving…` at 3.85 s (delete at 3.79 s) … lock
  released 9.59 s → disk changed **10.42 s** with NO further edit (10 clips, 1279.103 s = builder #2's
  `inside`), `Saved`; in-app 1,814 tokens; real Ctrl+Z → disk == original. `…\B5\lockcheck\retry-6s.json`.
- `node lockcheck.mjs retry 14` → `Saving…` 1.87 s → **`error|Save failed — retrying` 9.93 s** (3rd
  failure) → lock released 15.29 s → `Saved` 15.45 s, disk 1279.103 s; Ctrl+Z → original.
  `…\B5\lockcheck\retry-14s.json`.
- `node lockcheck.mjs close 4` → delete 3.25 s, real click "Back to projects" 3.42 s (Home shown), lock
  released 7.03 s → **disk got the edit at 8.36 s** (10 clips, 1279.103 s) — the close flush retried
  and landed; original project.json written back (project closed). `…\B5\lockcheck\close.json`.
- `node drive.mjs ready` → `node deletes.mjs cases long bf1 bf2 bf3 bf4` (log
  `…\B5\deletes\run-b4-builder4.log`, summary `summary-long-bf1-bf2-bf3-bf4.json`) → **5/5 PASS**
  (selection exact, toast, 2 `'text-delete'` edges, 1 undo step, redo exact, Restore by the driver's
  UNSCROLLED click → length 1283.148, cover/order/text equal, 0 pills, back to ORIGINAL):
  | case | selected | toast | length after | pill (source cut) |
  |---|---|---|---|---|
  | long 0373 709–777 | SHIFT+click 69 | `Removed 69 words · −62.5 s` | 1220.658 | 101.931–164.421 |
  | bf1 0370 i117 "I" | 1 | `Removed 1 word · −1.0 s` | 1282.100 | 41.956–43.004 |
  | bf2 0370 i132 "so" | 1 | `Removed 1 word · −3.2 s` | 1279.967 | 55.651–58.832 |
  | bf3 0372 i398 "I" | 1 | `Removed 1 word · −2.2 s` | 1280.962 | 16.115–18.301 |
  | bf4 0372 i471 "And" | 1 | `Removed 1 word · −2.9 s` | 1280.231 | 57.861–60.778 |
  The Restore of `long` (the case that failed for builders #2/#3) now works by the plain click — the
  Problem 6 fix live. Problem 2 data: deleting ONE backfilled word (a 1.03–1.05 s span) cut 1.0 / 3.2 /
  2.2 / 2.9 s of source — the backfilled start plus the tight-style snap; ears decide (HASAN-STEP block).
- App stopped (matched `--remote-debugging-port=9321` / `profiles/B5/profile` / `B5/launch.sh`: 2 bash,
  2 node, 1 cmd, 6 electron) → `left: 0`. B5-root is at the ORIGINAL timeline. C: 18.44 / D: 32.62 GB.
- FULL `npx vitest run` (app stopped, log `…\B5\vitest-full-builder4-run1.log`) → **run 1 green**:
  `Test Files 462 passed | 5 skipped (467) · Tests 3892 passed | 34 skipped (3926)` (42 s).

**Builder #5 (2026-10-22):** C: 18.43 / D: 32.62 GB before launch; nothing on 5173/9321, no electron.
- `bash launch.sh` (background) → `node drive.mjs ready` → `length s 1283.148 toolbar ["/ 21:23.09"]`, A1 0, proposals 0.
- `node deletes.mjs fillers` (BEFORE the fix) → real click **"Remove 15 fillers"** → toast `Removed 15 fillers ·
  −13.8 s (2 spots too tight to cut cleanly)`, **13 pills** (0366 "Um" `0.06–2.129` ¶ 2.1s · 0370 "uh" 0.6s ·
  0371 ×4 (0.2/0.1/0.3/0.9 s) · 0373 ×3 ("Uh" `84.16–91.126` ¶ 7.0s = the filler 84.16–86.74 + the 4.5 s pause
  to "Do" 91.276 less its 0.15 s lead-in — the tight style's edges · 0.4 · 0.6 s) · 0375 ×3 · 0376 ×1),
  length 1283.148 → **1269.354**, 22 clips, 19 clips carry edge tags, fillers left `227:uh 574:uh` (= original
  i231 / i580, both too tight — see Problem 7), real Ctrl+Z → disk == original (**one undo step**). → Problem 7
  fixed (tests first, `e69d182`); `npx vitest run src/features/studio/services/text-delete.test.ts` before →
  `3 failed | 14 passed` (`expected undefined to be 1 / 3 / +0`), after → `17 passed`.
- After the fix (HMR), `node drive.mjs ready` + `node deletes.mjs fillers` → toast **`Removed 13 fillers · −13.8 s
  (2 spots too tight to cut cleanly)`**, same 13 pills / 1269.354 / 22 clips / one undo step. `…\B5\deletes\fillers.json`,
  still `b5-fillers-removed.png`.
- `node deletes.mjs karaoke-bottom` (Problem 3) → click the last fully visible word (i 776), play 20 s:
  **1,155 frames, lit word out of view on 1 frame** (the crossing frame before the scroll), **36 body scroll
  events**, scrollTop 6159 → 6217, lit 776 → 804 (29 changes). The auto-scroll works. `…\B5\deletes\karaoke-bottom.json`,
  still `b5-karaoke-bottom.png`.
- `node checks.mjs readonly` → delete 271–276 (`Removed 6 words`, 10 clips) → Media tab → 0369 tile → "Auto Cut"
  (Inspector "Transcript · DJI_…_0369_D.MP4") → Transcript tab: banner **"A review is open — apply or reject it to
  edit by text."**, `edit.readOnly` true, "Remove 14 fillers" `disabled`, Auto Cut title "Apply or reject the open
  cut proposal first", proposal on disk (7 items); click 300 + SHIFT+click 305 → bar "6 words · 2.2 s" with
  **Delete disabled**; real **Delete key → timeline on disk unchanged, 1,814 tokens**; the pill opens to its struck
  text "application— uh other take. For example," with **0 Restore buttons**; a word click still seeks (word 1000
  "it's": playhead frame 44740 == want 44740). Real click **"Reject all"** → read-only false, banner gone, fillers
  button enabled, timeline unchanged, the proposal kept on disk as `status: "rejected"`. `…\B5\checks\readonly.json`,
  still `b5-readonly-review.png`. (First two tries stopped in the driver: clip not rendered off-view, then the
  Auto Cut button lives under the Media-pane selection — see Kit; the 271–276 delete of try 1 was resumed.)
- `node checks.mjs reopen` → a second delete (indices 555–560 of the 1,814-token doc = original 561–566 "it,
  install, and simply run. And", inside 0373 — NOT the across-clip case; across was covered by builder #2)
  `Removed 6 words · −4.3 s`, 11 clips, 1274.759 s, "Saved" → real click "Back to projects" (disk unchanged by the
  close) → real click on the project card → Transcript tab: **1,808 tokens, doc text equal, the 2 deletions equal
  (ids + text), 2 pills, disk unchanged by the open, 4 `'text-delete'` edge tags** → Restore both pills by real
  clicks AFTER the reopen (no in-memory history) → length **1283.148**, per-asset source cover == original, 1,820
  tokens, 0 pills (13 contiguous clips) → closed, the original project.json written back (`originalWrittenBack: true`;
  disk: 9 clips, 1283.148 s, 0 proposals). `…\B5\checks\reopen.json`, still `b5-reopened.png`.
- 2026-09-17 open items on THIS material: **clip speed is 1** on all nine clips (no `speed` field), so the
  `trimClip` / `trimClipRippleAll` / `applyCutProposal` speed debt does not apply here; **captions dropping
  durationless words: Hasan's nine AssemblyAI responses hold 0 zero-duration words** (1,820 words; 42 ≤ 20 ms,
  128 < 50 ms — those short words are Problem 2's backfill, not the caption drop).
- App stopped (matched `--remote-debugging-port=9321` / `profiles/B5/profile` / `B5/launch.sh`: 4 bash, 2 node,
  1 cmd, 6 electron) → `left: 0`. C: 18.38 / D: 32.59 GB.
- `npm run check:types` → `web: 26 errors (baseline 26) ok · node: 10 errors (baseline 10) ok`.
- FULL `npx vitest run` (app stopped, log `…\B5\vitest-full-builder5-run1.log`) → **run 1 green**:
  `Test Files 462 passed | 5 skipped (467) · Tests 3895 passed | 34 skipped (3929)`.

**Builder #6 (2026-10-22):** C: 19 GB / D: 33 GB before; nothing on 5173/9321/9325, no electron running.
- `cp -r …\b-root …\B5-station-root` + `cp -r …\profiles\source\profile …\profiles\B5-station\profile` → 580 MB +
  377 MB, `grep -c b-root project.json` → 0; C: 19 → 18 GB. (b-root's M2 had V1 0 / A1 0 / 0 proposals — untouched.)
- `bash launch-station.sh` (background) → `CDP_PORT=9325 B5_ROOT='C:\…\B5-station-root' node drive.mjs ready` →
  `root before …\v14-root` → `set root {"success":true} …\B5-station-root`, nine clips added, `V1 0366@0.000+20.288 in0
  x1 | … | 0376@1100.298+182.849 in0 x1`, **`length s 1283.148 toolbar ["/ 21:23.09"]`**, `A1 clips 0 proposals 0`.
- `CDP_PORT=9325 node station-doc.mjs` → `tokens 1820 paragraphs 192 deletions 0`. `node station-table.mjs` → the W1–W8
  and D1–D11 rows now in HASAN-STEP.md (W "highlight starts" = app token start, "AssemblyAI's stamp" = raw JSON start
  + clip timelineStart; moved 1000 ms for all but W5 708 ms). Fillers at the start state: `0:Um@00:00.04 165:uh@02:28.24
  194:uh@03:05.34 219:uh@03:26.33 231:uh@03:34.41 243:uh@03:42.26 272:uh@04:11.27 580:uh@08:00.08 693:Uh@09:08.30
  920:uh@11:54.20 928:uh@11:57.15 1331:um@16:28.08 1346:uh@16:45.38 1522:uh@18:06.46 1534:um@18:22.42`.
- App stopped (matched `--remote-debugging-port=9325` / `profiles/B5-station/profile` / `B5/launch-station.sh`: 4 bash,
  2 node, 1 cmd, 6 electron) → `left: 0`. C: 17.69 GB / D: 32.60 GB.
- providerId set + snapshot (node, app stopped) → `clips 9 end 1283.148 audio 0 proposals 0 agent
  {"providerId":"b5-no-model"} false false tags 0`; sha256 station project.json == station-start = `2cfaf22058164501…`.
- `powershell -ExecutionPolicy Bypass -File docs\studio\end-to-end\B5\hasan-station.ps1 -Reset` (app closed) → `Saved
  the current project to …\B5\station-runs\project.20261022-210952.json. Resetting the station...` → `Station reset:
  video-14-raw = the nine raw clips on V1 (/ 21:23.09), nothing deleted.` exit 0.
- No `src/` change this session → vitest / type gate not re-run (last: builder #5, full run green, 26/10).
- Code facts for HASAN-STEP (read, not yet driven): Space = `playback.togglePlay()` unless `isTextEntry(target)`
  (`useTimelineShortcuts.ts:~102`; the transcript body is a tabIndex div, not text entry); each take shows
  `formatDuration(Math.floor(start))` and seeks on click (`TranscriptParagraph.tsx:36-43`); Delete/Backspace with a
  range deletes, Ctrl+A selects all, Escape clears (`TranscriptPanel.tsx:63-79`); the show/hide-deletions eye and the
  left tab are per-profile localStorage — leave them at their defaults (deletions SHOWN) after the click-check.

## Next step (ONE concrete instruction)

Click-check HASAN-STEP.md literally with REAL mouse/keyboard input on the station: launch it THROUGH
`powershell -ExecutionPolicy Bypass -File docs\studio\end-to-end\B5\hasan-station.ps1 -CdpPort 9325` (background), then
drive every instruction as written — Studio → video-14-raw, the Transcript tab and its header ("1,820 words", "Remove 15
fillers"), Space play/pause with focus in the transcript, find each take by wheel-scrolling to its M:SS head, W1–W8
(word click → clock == the table's "highlight starts", double-click selects exactly one word — else switch the doc to
a drag, Delete, Ctrl+Z → disk == start), D11 → D1 in that order (click + SHIFT+click or drag; selection bar count ==
the table's; toast; pills — does D4 leave two?), Part C (Restore D7 + D4 by real clicks, Ctrl+Z / Ctrl+Shift+Z) and
Part D (the real "Remove N fillers" number + toast) — write a driver `.vidtsx-temp/end-to-end/B5/station-check.mjs`
(reuse `deletes.mjs`/`checks.mjs` helpers, poll project.json ≥ 250 ms apart or read `[data-save-state]`), fix every
wrong instruction/number in HASAN-STEP.md (remove the `[check]` marks and the DRAFT banner only when all pass), then
close the app, run `hasan-station.ps1 -Reset`, and confirm the station project.json hash == the start snapshot.

## Open problems

**RULED (orchestrator, 2026-10-22, after builder #1):**
- **Problem 1 (em-dash mojibake):** a real bug — fix it (UTF-8 decode via `TextDecoder` like
  `analysis-io.ts:15-17`, unit test first with an em-dash, curly quotes and an Arabic word), check
  every other `atob(` → text path in `src/features/studio` for the same bug, and re-run the spot
  check to 0 text mismatches.
- **Problem 2 (`withSpokenSpans` backfill moving short AssemblyAI words earlier):** no code change
  now — it needs ears. (a) In the pre-pass, measure the evidence for the moved words (sound before
  the token, ZCR, whether the energy run is continuous with the word) and DELETE-test 3–5 of the
  biggest moves (does the delete cut audible speech before the token?). (b) Put 6–8 of them on
  HASAN-STEP.md as a separate by-ear block ("click the word — does the highlight start where you
  hear the word? delete it — did you lose sound before it?") with their timecodes and words. (c)
  Write the alternative ready for his answer: restrict the backfill to transcripts/engines that
  need it (whisper's near-zero words, e.g. duration ≤ ~20 ms or by engine) — a one-place change
  with its test, described in HASAN-STEP.md and STATUS as "if these sound wrong, this is the fix";
  do NOT apply it.
- **Problem 3:** include one play past the bottom of the view in the karaoke check.

1. **BUG (real, to fix next): non-ASCII text is mojibake in the Transcript tab.** All 32 em-dash
   words (`39—`, `application—`, `I—` …) show as `39â` + two C1 control chars (char codes
   `e2 80 94` as three Latin-1 characters). The cache file is correct UTF-8 (`3339e28094`);
   `useAssetTranscripts.ts:35` does `parseTranscriptWords(atob(res.data))` — `atob` yields one char
   per BYTE. `analysis-io.ts:15-17` already decodes the same channel correctly (`Uint8Array.from(atob…)`
   + `TextDecoder`). Hits the Transcript tab and the cut-review context words (same reader); any
   curly quote, accent or non-Latin transcript (Arabic) would be garbage. Waveform JSON is ASCII —
   unaffected.
2. **For the by-ear pass, not a code change (yet): the whisper backfill also fires on AssemblyAI.**
   `withSpokenSpans` (`transcript-doc.ts:107-128`, MIN_SPOKEN 0.05 s, backfill ≤ 1 s) was written
   for whisper.cpp's 0–20 ms stamps; AssemblyAI stamps 129 short function words ("a" 16 ms, "I"
   32–48 ms, "in", "so"), and 76 get an earlier start — 25 by ≥ 0.5 s. Effect: clicking such a word
   seeks up to 1 s early and the karaoke lights it early; a delete of it starts its cut up to 1 s
   early (before the snap). In 33 of the 37 ≥ 150 ms cases the backfilled gap holds sound ≥ 15 dB
   over the floor, so whether the word really sits there is a listening question — put 3–4 of these
   words (from `…\B5\backfill.json`, e.g. 0370 "I" shift 1000 ms, 0372 "I" 1000 ms with a QUIET gap,
   0371 "a" 708 ms) on HASAN-STEP.md's list and test-delete them in the pre-pass (does the cut eat
   sound that is not the word?). Decide after measuring the delete; a source-aware threshold would
   be a small change in `withSpokenSpans`.
3. The karaoke auto-scroll was not exercised (see Verified) — the delete half should include one
   play that runs the lit word past the bottom of the view (e.g. click the last visible word, play 20 s).
   (`node deletes.mjs karaoke-bottom` is written for this — not run yet.)
4. **BUG (suspected real, builder #2): a 62.49 s Transcript delete removed 124.8 s.** Case `long`:
   tokens 709–777 of 0373 ("found" 101.931 → "So" 164.209–164.421 source), selected by a real click +
   SHIFT+click; the driver's DOM check read the selection as exactly 709–777 (69 words). After ONE real
   Delete keypress the disk held 0373 as `0 … 101.931` + `226.719 … 396.246` — the cut ran on to "was"
   (226.507–226.719, i.e. 11:31 "My D drive was"), **62.3 s past the selection ≈ the next 69 words**.
   ONE Ctrl+Z returned the disk to the original and Ctrl+Shift+Z back to the 124.8 s cut (so it is one
   history step, or two dispatches inside one save debounce that undo… — unknown). The single pill read
   `daf5…:101.931:226.719`; its Restore click changed nothing on disk ("Saved" shown — a REFUSED
   restore, unlike bf1). Hypotheses: (a) the same range deleted twice (after the first cut the indices
   709–777 point at the next 69 words); (b) the panel's `range` (from `useTranscriptSelection`'s
   anchor/focus mapping) differs from the DOM selection after a SHIFT+click; (c) a planTextDelete span
   bug on long runs. The toast text was not captured. Evidence: `…\B5\deletes\long-bug-disk.json` (the
   project.json after it). The five drag-selected cases (≤ 6 words, no shift) were all exact.
5. **Robustness (general, not Transcript-specific — orchestrator's call): a failed autosave loses the
   edit's save.** `useStudioProject.ts` `persist` clears `dirtyRef` BEFORE `studioProjectSave`, and on
   `success:false` only shows "Save failed" — nothing retries and the unmount/blur `flush()` sees
   "not dirty", so closing the project after a failed save keeps the OLD file (until any later edit
   re-saves the whole doc). Trigger seen here: `project-store.ts:69-74` `writeProjectFile` = write
   `.tmp` + `fs.rename`, and on Windows `rename` fails (EPERM) while another process has project.json
   open — my driver polled it every 50 ms (antivirus / indexers / sync tools do the same). Re-sending
   the same in-memory project from CDP saved fine. Small fix if wanted: retry the rename on
   EPERM/EBUSY (main) and re-dirty + reschedule on failure (renderer). Drivers: poll project.json
   less often (≥ 200 ms) or watch the "Saved" indicator.

**RULED (orchestrator, 2026-10-22, after builder #2):**
- **Problem 4 first:** root-cause and fix the 2× long delete (and the dead Restore pill) with a
  unit/reducer test that reproduces it first; then re-run `long` and the bf cases live.
- **Problem 5: fix it in B5** (both of Hasan's passes depend on autosave, and Windows AV/sync tools
  hold files): main — retry the `.tmp` → `project.json` rename on EPERM/EBUSY/EACCES a few times
  with a short backoff; renderer — on a failed save keep the document dirty (set dirty BEFORE the
  save is considered done; re-mark on `success:false`) and reschedule, so a later flush/close still
  writes; after repeated failure show a persistent error, not a transient toast. Unit tests for both
  (a failing-then-succeeding rename; a failed save followed by close writes the latest doc). Drivers
  poll project.json ≥ 200 ms apart from now on (add a DRIVING.md "Learned" line).

**Builder #3 findings (2026-10-22):**
- **Problem 4 — ROOT-CAUSED, not a delete-path bug (see Done/Verified):** the "2×" was two correct
  deletes after a failed save (Problem 5) + `deletes.mjs` re-picking its case on the in-memory doc.
  Its fix is Problem 5's fix (memory and disk can no longer silently diverge) + the driver's 250 ms
  poll (done) — plus a driver guard to add: before each case, assert the panel's doc has 1,820 tokens
  and the disk timeline == `orig`, else stop (never pick cases from a doc that differs from disk).
  The "ONE Ctrl+Z → original" in builder #2's note does not fit two history steps; it is not in any
  saved output (the run's summary was never written) — treat it as unverified.
6. **Small UX bug (fix with Problem 5, test first): an opened deletion pill can hide its own Restore.**
   `DeletionPill.tsx:39-66` swaps the `¶ 62.5s` chip for the struck-through text + Restore IN PLACE;
   for a long deletion near the bottom of the view the Restore lands below the transcript body's
   visible area (measured: 14 px below) and nothing scrolls it in. Fix: on open, scroll the Restore
   (or the opened span) into view with `scrollIntoView({ block: 'nearest' })` (a ref + effect on
   `open`; a component test that the opened pill calls it). Keep `deletes.mjs` as is — after the fix
   its unscrolled click is the check.
- DRIVING.md "Learned" line added (poll project.json ≥ 200 ms; a failed save desyncs memory from disk).

**Builder #4 (2026-10-22):** Problems 4, 5 and 6 are CLOSED (`aa58ee8`; Verified above). Still open
for the rest of the pre-pass: fillers, karaoke-bottom (3), read-only during an Auto Cut review,
save + reopen, the 2026-09-17 items on this material, then the station, HASAN-STEP.md (with the
Problem 2 by-ear block — bf1–bf4 above are its first four candidates), the flip and the backfill
alternative (prepared, not applied), the B4 doc debt (decision 6), Status row, TESTING §18.11.
- Note for STATUS: the save indicator is now `[data-save-state]` (`saved|pending|error`); a driver
  can read it instead of racing project.json.

**Builder #5 (2026-10-22):** Problem 3 CLOSED (karaoke-bottom PASS). Problem 7 (toast over-count) FOUND +
FIXED (`e69d182`). The machine half of decision 3 is complete — nothing open in the delete path. For
HASAN-STEP.md: (a) "Remove N fillers" leaves fillers that sit inside their neighbours' pads (2 of 15 here —
the toast says so) and takes the pause around a filler with it (one "Uh" in 0373 = 7.0 s: 84.16 → 91.126) —
ears: does that join sound natural; (b) the Problem 2 by-ear block = bf1–bf4 (Verified, builder #4) + 2–4 more
from `…\B5\backfill.json`. Remaining (builder #6+): station, HASAN-STEP.md + `hasan-station.ps1` (literally
click-checked with real input), the flip (grep every production gate of `studio-text-edit`) and the backfill
alternative (one place in `withSpokenSpans`, with its test) prepared NOT applied, B4 doc debt (decision 6),
Status row, TESTING §18.11.

## Do-not-redo

- B1–B3 DONE; B4 WAITING-HASAN — do not touch the B4 station or B4's code. Track A DONE. Do not
  touch `main`. The editor repo is READ-ONLY. Do not apply the flag flip.
- The B5 scratch copy + profile exist (do not re-copy); the nine clips are already on V1 of
  B5-root's `video-14-raw` (`ready` skips clips already there). The first-half numbers (open time,
  1,820 words / spot table, 27/27 seeks, karaoke, scroll) are recorded — rerun only `spot` after the
  UTF-8 fix. `B5-station-root` / `profiles\B5-station` were made by builder #6 (below).
- Problem 1 is FIXED and verified (`fb32ab1`, spot = 0 text mismatches) — do not redo. Delete cases
  inside / across / short / first / last PASSED (table under Verified) — rerun them only after a
  delete-path code change.
- Problem 4 is ROOT-CAUSED (builder #3: probes + `longbug.b5.test.ts`) — do not re-investigate the
  planner, the selection mapping or a double dispatch; the 709–777 delete is exact live.
- Problem 5 (autosave) and Problem 6 (Restore into view) are FIXED + live-verified (`aa58ee8`,
  `lockcheck.mjs` retry/retry 14/close; `long` + bf1–bf4 PASS) — do not redo. All ten delete cases
  have now passed; rerun them only after a delete-path code change.
- Builder #5: fillers (before + after the toast fix), karaoke-bottom, read-only during an Auto Cut review,
  save + reopen + restore-after-reopen are DONE and recorded (Verified) — do not redo. B5-root is back at
  the ORIGINAL project.json (9 clips, 1283.148 s, 0 proposals); the 0369 cut-plan proposal of the read-only
  check was dropped with it.
- Builder #6: the B5 station (`B5-station-root` + `profiles\B5-station`) EXISTS with the long project, `b5-no-model`
  and the start snapshot `…\B5\station-start\project.json` — do not re-copy or re-`ready` it; reset it with
  `hasan-station.ps1 -Reset`. `hasan-station.ps1` and the HASAN-STEP.md draft exist — edit them, don't rewrite from
  scratch. Remaining after the click-check: the backfill alternative (patch + its test in `withSpokenSpans`, verified,
  NOT applied — fill HASAN-STEP's placeholder), the flip text checked (done in the draft; grep found no other gate),
  B4 doc debt (decision 6), Status row, TESTING §18.11.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~44 calls · scratch copies, long project (21:23.09), kit, first half of
  the pre-pass; found the UTF-8 mojibake bug and the AssemblyAI backfill question.
- 2026-10-22 · builder #2 · ~60 calls · fixed the UTF-8 bug (`fb32ab1`, tests first), spot = 0 text
  mismatches; `deletes.mjs`; 5 delete cases PASS; found the 2× long delete (Problem 4) and the
  failed-save-not-retried issue (Problem 5).
- 2026-10-22 · builder #3 · ~44 calls · root-caused Problem 4 live + by harness (two correct deletes
  after a failed save; the Restore opens below the fold), no `src/` change; driver poll → 250 ms.
- 2026-10-22 · builder #4 · ~50 calls · fixed Problem 5 (rename retry + autosave service) and Problem 6
  (`aa58ee8`, tests first); live lock checks (retry / persistent error / close); `long` + bf1–bf4
  PASS; full vitest green run 1, types 26/10.
- 2026-10-22 · builder #5 · ~50 calls · fillers (found + fixed the toast over-count `e69d182`, tests first),
  karaoke past the bottom, read-only during an Auto Cut review, save + reopen + restore after reopen — all
  PASS live (`checks.mjs`); 0 zero-duration AssemblyAI words, speed 1; full vitest green run 1, types 26/10.
- 2026-10-22 · builder #6 · ~38 calls · Hasan's B5 station built (copies, long project 21:23.09, `b5-no-model`,
  start snapshot), `hasan-station.ps1` (+ `-Reset` dry-run), HASAN-STEP.md drafted (W1–W8 by-ear block, D1–D11,
  restore/undo, fillers, the flip diff) — not yet click-checked.
