# B5 — `studio-text-edit` on in production after Hasan's pass on M2 (AssemblyAI transcript, by ear, long project)
status: IN PROGRESS (builder #1 handed off 2026-10-22 — first half of the pre-pass done; one real bug found)

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
- **First half of the pre-pass (decision 3), numbers below under Verified.** No source change yet.

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

## Next step (ONE concrete instruction)

Fix Open problem 1 (unit test first: `fetchTranscriptWords` / a base64→UTF-8 decode on a cache file
holding "39—" must return "39—"; then decode with `TextDecoder` the way `analysis-io.ts:15-17` does),
relaunch with `bash .vidtsx-temp/end-to-end/B5/launch.sh` (background) + `node drive.mjs ready`, confirm
`node drive.mjs spot` shows 0 text mismatches (only the 76 backfill starts left), then start the
second half of decision 3 (the deletes: inside one clip, across a clip boundary, ≥ 60 s, a single
short word, first / last word of a clip — each one undo step, edges = the resolved tight style,
`'text-delete'` tags, restore pills, undo/redo) in a new `drive.mjs` command.

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

## Do-not-redo

- B1–B3 DONE; B4 WAITING-HASAN — do not touch the B4 station or B4's code. Track A DONE. Do not
  touch `main`. The editor repo is READ-ONLY. Do not apply the flag flip.
- The B5 scratch copy + profile exist (do not re-copy); the nine clips are already on V1 of
  B5-root's `video-14-raw` (`ready` skips clips already there). The first-half numbers (open time,
  1,820 words / spot table, 27/27 seeks, karaoke, scroll) are recorded — rerun only `spot` after the
  UTF-8 fix. `B5-station-root` / `profiles\B5-station` are NOT made yet.

## Agents so far (date · approx tool calls · what they covered)

- 2026-10-22 · builder #1 · ~44 calls · scratch copies, long project (21:23.09), kit, first half of
  the pre-pass; found the UTF-8 mojibake bug and the AssemblyAI backfill question.
