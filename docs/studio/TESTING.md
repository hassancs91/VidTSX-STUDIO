# Studio stability gate — full test checklist

> **GATE PASSED — 2026-08-13.** The §13 S3 exit test ran on real multi-take
> footage and passed (26 flush joins, v==a within AAC frame padding, sync clean
> by ear at the last cut). Every human-verifiable item is ticked or explicitly
> deferred with a reason (§11 Local-Models — no local model installed; §15 —
> runs at the tail of the polish mini-session; §13.5 — N/A, Studio has no
> format picker). Papercuts found during the gate live in the follow-ups list
> at the bottom; S4 is clear to open after the polish mini-session.

> Run this before starting S4. Sections 1–15 cover everything built through the
> S3 agent pass (commit `252b4a4`). Section 16 holds the test blocks for the
> core-parity features we agreed to build first — test them as they land.
>
> Conventions: every item is *action → expected result*. Test in a dev build
> (`npm run dev`). Where a step needs real footage, use a genuine multi-take
> recording with proper nouns in it, not just the seeded TTS clips.
> ✎ marks items already verified live via CDP during development — re-checking
> them by hand is optional; everything else has only been unit-tested or never
> exercised.

## 1. Projects & browser

- [ ] Create a project in each preset (16:9, 9:16, 1:1) at 30 and 60 fps → folder appears under the studio root with `project.json`, `cache/`, `shots/`, `renders/`. ✎ (landscape+portrait)
- [ ] Rename check: edit the Name field in the Inspector → card title updates after reopening the browser; folder name unchanged.
- [ ] Change the studio root from the browser toolbar → existing projects disappear from the list (they live in the old root), new creations land in the new root. Change it back.
- [ ] Delete a throwaway project (two-step confirm) → folder lands in the Recycle Bin, card disappears, empty state renders when last project is gone. ✎
- [ ] Relaunch the app → all projects still listed; open one → document identical (assets, timeline, proposals). ✎ (2026-08-13 sweep)
- [ ] Put a corrupt `project.json` in a spare folder → browser skips it without crashing and still lists the others. ✎ (2026-08-13 sweep)
- [x] **Project settings** (feedback item 7): the top bar's Settings button (or the `1920×1080 · 30 fps` chip) opens one panel with Name, Frame size (typed width/height commit on Enter or blur; odd rounds up to even; junk shows "Use whole numbers from 16 to 7680…" and reverts; 16:9 1080p / 16:9 4K / 9:16 / 1:1 buttons), Frame rate, Speech-to-text model, Brand, Preset and a brand read-out (five swatches, display / body font, "from this project (brand.json)" or "from the library"). The Brand select always renders: a project with `brand.json` and no library brand shows "<name> (project snapshot)" selected with **Save to library**, which creates `assets/brands/<slug>/`, selects it and hides the button; picking the snapshot again clears `brandId`. "Create brand…" / "Create preset…" leave for the Assets screen on the dialog's New form; the lists re-read when you come back to Studio. The Preset select always renders, stale ids show "(missing)". Brand and preset pickers are gone from the Shots tab. ✎ *(2026-09-13 — CDP on video-10-test: snapshot selected with 5 swatches and "Space Grotesk / Inter"; width 1281 + Enter → 1282×1080 in the chip, "abc" → the hint, 1080p → back; 9:16 → 1080×1920 → back; fps 25 → back; Save to library → `learn-with-hasan` selected, read-out "library", then snapshot re-selected and the library copy deleted; Create brand… → Assets with "New brand" open; project.json vs the pre-run backup: only `updatedAt`)*

## 2. Media pool & import

- [ ] Import a video (mp4), an audio file (wav/mp3), and an image (png/jpg) through the dialog → thumbnails appear; probe values (duration badge) correct.
- [ ] Import a file type the app doesn't support → per-file error toast, other files still import.
- [ ] Import the same file twice → second import either dedupes or creates a second asset — confirm whichever happens is coherent (no crash, both entries usable).
- [ ] Proxy generation: after importing a big video, background job runs (progress on the asset) → preview scrubs smoothly once ready.
- [ ] Waveform generation: audio-bearing assets get waveforms on their timeline clips; a silent video gets none and nothing errors.
- [x] **Remove an asset that is on the timeline** (feedback item 6): the tile carries an "N clips" / "N shots" badge; its X swaps the tile for a confirm card ("Used by 75 clips on V1. Remove anyway? …") — Cancel puts the tile back untouched, Remove drops the asset AND its clips; **Ctrl+Z restores both in one step**, the asset back at its original position in the pool (project.json identical but for `updatedAt`). An unused asset is removed without asking. Same confirm on a shot row that has clips ("Used by 9 clips on the timeline."). ✎ *(2026-09-13 — CDP on video-10-test: 75-clip master → 19 on-screen clips after Remove, 59 after undo, badge and tile order back; shot row B0Terminal → confirm with 9 clips, cancelled)*
- [ ] Move/rename a source file on disk, reopen the project → app shows the asset as missing without crashing. (Relink is a known gap — see §16.8.)
- [x] **Left pane tabs** (feedback item 5): Media N | Shots N | Captions over the left pane (counts from the project), the right panel is Inspector | Script | Assistant. The top bar's Captions button opens the LEFT Captions tab. The active tab is remembered per project (localStorage `studio.leftTab.<projectId>`) across a renderer reload; the pane stays resizable (default 300 px). Media and Shots stay mounted while hidden: a half-typed shot brief survives a tab switch. ✎ *(2026-09-13 — CDP on video-10-test: "Media 20", "Shots 12"; Captions tab shows the 10-template gallery; reload → Captions still active; the brief typed in Generate came back after Media → Shots)*
- [x] **Media grid + density** (feedback item 5): tiles in an auto-fill grid (≥ 88 px, 3 per row at the default width) with the thumbnail, duration + kind icon, proxy % / transcribing % / transcript-ready pill, "Missing" + Locate…, the usage count top-left (film icon = clips, clapperboard = shots), one truncated name line; add / transcribe / remove on hover, and the same on right-click (Add to timeline · Transcribe or Re-transcribe · Locate… when missing · Remove from project). Click selects (accent ring), double-click adds. The grid/list toggle in the Media header switches to the roomy cards (remembered: `studio.media.density`). The in-use remove confirm spans the whole grid row. There is no drag from the pool to the timeline today (double-click, + or the menu add). ✎ *(2026-09-13 — CDP on video-10-test: 20 tiles, 3 per row at 92 px in a 312 px pane; click → ring; right-click → the three items → Add to timeline → Ctrl+Z restores 59 on-screen clips; X on the 75-clip master → full-row card → Cancel; list → 20 cards)*
- [x] **Shots tab** (feedback items 5 + 7.4): the same grid / list toggle (`studio.shots.density`), header keeps only Import and Generate, `data-shots-section` / `data-shot-card` / `data-usage-badge` / `data-remove-confirm` hooks unchanged; a reconcile drop-in failure switches to the Shots tab so its banner is visible. ✎ *(2026-09-13 — CDP: 12 shot tiles with badges, no brand/preset picker in the DOM, B0Terminal X → "Used by 9 clips on the timeline." → Cancel, list → 12 rows)*

## 3. Timeline — clip editing core

- [ ] Add to timeline from the pool → clip lands on a compatible track; with a track selected, the chosen track wins when compatible. ✎
- [ ] Drag-move a clip horizontally → magnetic snap to clip edges + playhead; drop commits exactly what the preview showed.
- [ ] Drag a clip straight up/down to another lane (near-zero horizontal movement) → it stays on the target lane, never snaps back. ✎
- [ ] Neighbour clamp: drag a clip into its neighbour → it stops flush, no overlap ever commits. ✎ (2026-08-13 sweep — landed exactly flush)
- [ ] Edge-trim both edges → bounded by source length and neighbours; waveform/label stay aligned after trim. ✎ (2026-08-13 sweep — bounds exact incl. trim-to-0.04 s minimum; waveform alignment is eyes)
- [ ] Split (S key and toolbar) at playhead → two contiguous clips, no visual seam at the join during playback. ✎ (2026-08-13 sweep — contiguity exact; seam-by-eye still yours)
- [ ] Delete with ripple ON, "this track only" → later clips slide left by exactly the removed width, per-track (music on another track keeps its timing). ✎
- [ ] Delete with ripple OFF / Backspace → gap stays. ✎
- [x] **Ripple all tracks** (toolbar layers button, the default; remembered in localStorage `studio.ripple.mode`): deleting a MASTER-lane clip slides every unlocked track by its width; a shot straddling the span keeps its part outside it; a locked track never moves; deleting a shot on another lane is still a per-track ripple (the footage under it stays). *(2026-09-12: unit-tested in ripple-ops.test.ts; CDP on video-10 — see the range row)*
- [x] **Range ripple delete**: I + O + Delete removes that span (all tracks, or master lane only in "this track" mode), clears the points, parks the playhead on the join; the range wins over a lingering selection. *(CDP 2026-09-12, video-10: a 2-frame span inside a master clip under a straddling shot — 360 → 362 clips, both straddlers cut into two pieces with the right piece's sourceIn advanced, every later clip on all three lanes shifted by exactly 0.0667 s, Ctrl+Z restored a byte-identical timeline)*
- [ ] **Ripple trim**: in all-tracks mode, dragging a master clip's edge inward pulls everything after it left; outward pushes it right (the neighbour no longer clamps, the source length still does); the live drag preview shows the other lanes moving. ✎ (unit-tested in ripple-ops.test.ts; the drag itself is eyes)
- [ ] Cut proposals (Review cuts → Apply, and the assistant's apply) follow the same mode: with all-tracks on, shots after an accepted cut slide with the master. ✎ (unit-tested in apply-cut-proposal.test.ts)
- [ ] Every op above is one undo step; a long chain of ops undoes fully back to the starting state (spot-check with 10+ mixed ops). ✎ (2026-08-13 sweep — 11 mixed ops incl. split/trim/move/paste/marker/ripple-delete/duplicate undone to an identical timeline)

## 4. Timeline — multi-select & batch

- [ ] Ctrl-click toggles membership; plain click collapses to one; clicking a member of a group keeps the group for dragging and collapses on motionless release. ✎
- [ ] Marquee from empty lane space selects touched clips; Ctrl+marquee is additive; a motionless press deselects. ✎
- [ ] Group drag moves all members by one delta, blocked when any member would collide or cross zero; commits as ONE undo step. ✎
- [ ] Ctrl+A selects all; Escape clears. ✎
- [ ] Batch Delete (ripple) closes the full removed span per track; undo restores everything. ✎

## 5. Tracks

- [ ] Add video/overlay/audio tracks (+ Track button) → visual tracks insert on top, audio appends. ✎
- [ ] Rename (double-click), reorder (Move up/down), delete via context menu; locked track's Delete is disabled; last track can't be deleted. ✎
- [ ] Lock blocks clip edits on that track (drag/trim/delete/paste); mute/hide flags flip and affect preview + export. ✎ (2026-08-13 sweep — all four edit kinds rejected; Hide dropped the picture, Mute silenced the lane's audio tags during playback; export shares the serializer)
- [ ] >3 tracks → header column follows the lanes' vertical scroll; ruler stays sticky. ✎
- [ ] Full track-management chain undoes back to baseline. ✎

## 6. Navigation, zoom, keyboard

- [ ] 10-step zoom anchored on the playhead (buttons and/or Ctrl+wheel) → playhead keeps its screen position while zooming. ✎ (2026-08-13 sweep — 0 px drift)
- [ ] Arrow keys step one frame; Shift+Arrow steps 1 s; Home/End jump to start/end. ✎ (2026-08-13 sweep — End parks on the LAST frame, e.g. 30.14 of a 30.5 s edit)
- [ ] Space toggles play everywhere except while typing in an input/chat. ✎ (2026-08-13 sweep — toggled play/pause live; dead inside the project-name input)
- [ ] Shortcuts are dead while another screen is active (visit Creator, press Delete/Space → Studio unaffected). ✎ (by design, spot-check)
- [ ] Snap toggle actually disables magnetic snapping. ✎ (2026-08-13 sweep — same 5 px-off drag: snapped ON, landed raw OFF)

## 7. Playback & preview

- [ ] Preview plays over proxies; the aspect stage letterboxes correctly for 16:9 / 9:16 / 1:1 projects.
- [ ] Scrub a 100-cut timeline → still smooth (the S2 checkpoint; re-verify only if something feels off). ✎
- [x] Playback across cuts is seamless — no black flash at joins. *(2026-08-13 — Hasan found joins flashing black on a 37-cut timeline; fixed same session with `premountFor` on the clip Sequences (TimelineComposition) so upcoming media pre-seeks hidden before its cut; confirmed smooth by eye afterwards. Export was never affected)*
- [x] Deliberate gap on the video track → black frames play, audio elsewhere continues; no crash at timeline end. ✎ (2026-08-13 sweep — played through the gap: 0 video elements, audio kept playing; end-of-timeline stops cleanly. DECIDED (Hasan, same day): playhead now parks at the END after playback — `moveToBeginningWhenEnded={false}` in PreviewPanel; verified by eye)
- [ ] Clip `transform`/`gain`/`speed` set by hand in project.json render correctly in preview (sanity for §16.1 before its UI exists).
- [ ] With "Preview result" ON during a review, the playhead JUMPS across cut regions and the clock matches the shorter cut timeline. ✎

## 8. Transcription

- [x] Transcribe a real recording with AssemblyAI → word count toast; Inspector shows "Ready · N words · AssemblyAI, measured word timestamps". ✎ *(2026-08-13 — re-verified by hand (Hasan) against the live API after the slam-1 retirement fix: catalog now Universal (auto) → universal-3-5-pro + universal-2, pinned entries also selectable)*
- [x] Transcribe with local whisper (base) → works offline; features snapshot shows what whisper actually delivered. *(2026-08-13 — Hasan: first run downloaded binary + base model, then re-transcribed with Wi-Fi off successfully)*
- [ ] Cancel mid-run → entry removed, no stale "generating" after relaunch. ✎ (S3.1)
- [x] Re-transcribe replaces the old transcript cleanly. *(2026-08-13 — Hasan: AssemblyAI → whisper → AssemblyAI round-trip, each run replaced the previous transcript with no doubled entries; Engine picker now stays visible when Ready, plus a Reset button that clears the transcript entirely — disabled while a review is open)*
- [x] Wrong/missing AssemblyAI key → fast, readable error; nothing hangs. *(2026-08-13 — Hasan: fast, no hang; wording was "upload failed (401)" and got fixed same session — 401/403 now reads "AssemblyAI rejected the API key — check your AssemblyAI key in Settings.")*
- [ ] Transcript survives relaunch (path + meta in document, JSON in cache). ✎

## 9. Auto Cut (mechanical pass)

- [ ] One-click Auto Cut on an untranscribed asset → transcribes first, then plans, then opens the review; on a transcribed asset it skips straight to planning. ✎
- [x] Plan honesty: silences found match what you hear; leading/trailing silence included; tight vs natural differ in pacing. *(2026-08-13 — Hasan, real 2:19 recording: Tight proposed 37 cuts/−55.3 s, auditions honest by ear; accuracy to keep watching across more footage — keyterms follow-up still logged below)*
- [ ] Auto Cut is disabled while any review is open. ✎
- [ ] Non-verbatim engine (whisper) → QA note about filler-finding appears in the review header. 

## 10. Review UI (shared by both passes)

- [ ] Striped amber regions on every clip playing the asset; grey + strikethrough when rejected; click region = select + seek. ✎
- [ ] Selected region's edge handles drag with word-boundary snapping, bounded so cuts can't overlap; item shows "adjusted". (unit-tested; never dragged by hand)
- [ ] Header stats are honest: "N proposed · −X s · before → after" recomputes when items are toggled. ✎
- [x] Play removed / Play join audition correctly BY EAR — no clipped word attacks at joins, join plays ±1.5 s with cuts applied. *(2026-08-13 — verified by ear (Hasan) on the editorial-test 5-cut proposal: all five items clean, removed spans start/end on word boundaries, joins splice without clipped attacks; auditions also work on an unchecked item)*
- [ ] Preview result checkbox plays the whole timeline as-if-applied. ✎
- [ ] Reject all → proposal closes `rejected`, regions clear, timeline untouched. ✎ (2026-08-13 sweep — full Auto Cut → review → Reject all round-trip; document restored byte-identical afterwards via 2×undo)
- [ ] Apply with some items vetoed → only accepted spans cut; toast shows removed seconds; proposal closes `partial`/`applied`. ✎

## 11. Editing agent (Assistant tab)

- [x] **Draft survives the panel** (feedback item 4): type in the composer, switch to Inspector / Captions / Script (or click a clip, which flips the tab), come back → the text is still there; a renderer reload keeps it too (sessionStorage `studio:agent-draft:<projectId>`); sending clears it. ✎ *(2026-09-13 — CDP on video-10-test: textarea unmounted on Inspector, restored verbatim after the tab switch and after a clip click; the key is removed once the box is emptied)*
- [ ] **Export chat** (download icon beside Memory, shown once there is a message): Copy chat → clipboard Markdown with a `# Assistant chat — <project>` header, exported time, message count, model, then `### You` / `### Assistant` turns with the tool chips as one-liners; "… + tool details" adds a `<details>` block per tool call with the JSON arguments and the result text (capped at 4 k / 12 k chars in main); Save… opens the OS save dialog with `<project>-assistant-<date>.md`. The button flashes a check for "Copied". ✎ (unit-tested: agent-chat-export.test.ts, tool-result-events.test.ts; needs a main-process restart to record tool results on turns run before 2026-09-12 11:35)

- [x] Editorial pass on real multi-take footage → categories are right, notes name the winning take, nothing scripted/kept is cut. ✎ *(2026-08-13 — Hasan, real footage via the NEW Editorial Pass button (Inspector → Assistant handoff, added this session): pass ran and proposed sensibly; accuracy verdict provisional pending more real-footage mileage)*
- [ ] Fluff suggestions arrive UNCHECKED; ticking one updates Apply count. ✎
- [ ] Tool chips ("Reading transcript", "Proposing cuts") and the proposal chip appear in the chat; streaming text visible while it thinks. ✎
- [ ] Proposal created while you're ON the Assistant tab does NOT yank you to Inspector; from Inspector the review pulls into view. ✎ (first half)
- [x] Ask for a second pass while a review is open → agent refuses politely, no duplicate proposal. *(2026-08-13 — Hasan, live)*
- [x] Stop button mid-run → run aborts, chat shows the error state, next send works. *(2026-08-13 — Hasan, live)*
- [x] Chat memory: follow-up question references earlier turns correctly (history round-trip). *(2026-08-13 — Hasan: "how long is this video?" → "and how many cuts did we apply to it?" — the follow-up's "it" resolved correctly, and the agent honestly said it can't see timeline history (transcript-only tools) instead of inventing a count. Cross-SESSION memory doesn't exist by design — chat is in-memory per project)*
- [ ] Untranscribed asset request → agent tells you to transcribe first (tool error surfaced conversationally).
- [ ] Provider set to Local Models → agent explains it can chat but not edit, names the fix. (logic unit-tested; DEFERRED 2026-08-13 — no local model installed on the test machine, path can't be exercised live yet)
- [x] Ask a plain question ("how long is this clip?") → sensible answer, no spurious proposal. *(2026-08-13 — Hasan: both clips' durations answered correctly from asset info, offered but did not create a proposal)*

## 12. Apply / undo / redo / persistence

- [ ] Apply is ONE undo step (timeline + proposal together); second undo removes the proposal; redo walks both back. ✎
- [ ] After apply: survivors contiguous per track, first piece keeps its clip id, reshaped clips tagged `origin: agent`. ✎ (S3.3)
- [ ] Autosave: make edits, force-quit the app within a second or two → relaunch loses at most the last debounce window, document not corrupted. ✎ (2026-08-13 sweep — killed ~0.5 s after a drag: disk JSON valid, held the pre-edit state)
- [ ] History cap: 120+ ops don't blow memory; oldest states drop silently. ✎ (2026-08-13 sweep — 130 marker-adds, 140 undos → exactly 30 remain, app healthy)

## 13. Export & render — **includes the S3 exit gate**

- [ ] Export an UNCUT timeline → correct duration, picture per clip, audio in the right seconds. ✎ (S2)
- [x] **S3 exit test:** real multi-take recording → auto-cut → audit → apply → editorial pass → audit → apply → export. Then `ffprobe -show_entries stream=duration` on the output: **v:0 duration == a:0 duration**, and A/V sync verified by eye/ear at the LAST cut. *(2026-08-13 — PASSED. Hasan's real 2:19 DJI recording, Tight auto-cut (37 proposed) + editorial pass both applied → 26 clips, every join flush to 1e-6 s; export 2068 frames / v 68.9333 s vs a 68.9920 s — the 59 ms delta is AAC 1024-sample frame padding, not drift; A/V sync clean by ear at the last cut (1:03.4) in an external player)*
- [x] Export lands in the render queue with progress; output plays in a external player (VLC + Windows Films). *(2026-08-13 — Hasan: queue progress shown, output played externally for the sync check. Known papercut: UI freezes for seconds at render start while the composition bundles — logged below. FIXED 2026-08-14: bundling moved to a utilityProcess; CDP-verified IPC stays 2–60 ms through the whole prep, "Preparing render…" chip on the Studio toolbar until frames start)*
- [ ] Export a timeline that uses gain/speed/transform (hand-edited if UI not built yet) → values respected in the render, durations correct with speed ≠ 1.
- [x] **Output options (2026-09-12, `docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md` Phase 1):** the dialog's Output section offers Full · 720p · 540p · 360p (never above the project size, even dims) and Best/High/Medium/Low; Full · High exports byte-identical to the pre-option export through BOTH engines; a 720p export through Fast matches a 720p export through Standard in the D5 frame-diff; the choice is remembered per project; a scaled file is named `<project>_720p.mp4`. ✎ *(CDP + IPC drivers on `video-10-test`: 165-frame range Full·High `cmp`-identical (Standard 6,704,456 B, Fast 6,058,147 B) vs baselines from the old main process; 720p: both files 1280×720 yuv420p tv bt709, max 0.01 % over 24 at 10 frames, audio 0 ms; real dialog driven at 720p/High/Fast + verify; the first 720p run exposed a double downscale in the renderer refactor — fixed, re-run clean. Full-project 720p run recorded in the plan's log)*
- [x] **Draft from proxies (Phase 2, 2026-09-12):** the Output section offers "Draft from the preview proxies" only when every timeline video asset has a ready proxy (a note names the missing ones otherwise); on by default at 540p and under; the entry's asset URLs and the Fast engine's copied spans read `cache/proxies/<assetId>.mp4`, the audio pass reads the originals; the queue row shows a `draft` badge and the file is `<project>_540p-draft.mp4`; Quality reaches the Fast engine's pieces (High = the unchanged default); the notice quotes the last measured rate of the same project/engine/source; Settings › Rendering carries default resolution + quality. ✎ *(unit-tested: export-source.test.ts, export-estimate.test.ts measured rate, passthrough-ffmpeg.test.ts quality rows; Full·High·Originals byte-identical through both engines after the change; the 540p draft of `video-10-test` driven through the real dialog with the D5 verify — result in the plan's Phase 2 log)*
- [x] **"Fastest" export engine (Engine 3, 2026-09-12, `docs/export-engines-plan.md` "Engine 3 — shot composite"):** a third row in the Export dialog; footage that is a plain cut is copied, footage under a shot is copied and the shot layer (rendered alone with alpha) is composited onto it by ffmpeg, everything else goes to the browser; the row states "Copies N % … and composites shots over another M %"; the Standard and Fast rows behave exactly as before. ✎ *(driven through the real dialog on `video-10-test` at Full from the 4K originals with the D5 verify: max 0.33 % of pixels over 24 at 22 frames (glyph edges only: JPEG vs PNG screenshots), audio 0 ms; 23.0 min on the `angle` backend / 40.7 on `swangle` against Standard 31.5 / 55 min; the planner's copying plan pinned byte-identical without the option)*
- [ ] ~~GIF/WebP export of a Studio timeline still works (render-pipeline regression).~~ **N/A as written** *(2026-08-13 — the Studio export hard-codes h264/.mp4 (EditorShell); GIF/WebP are Creator-side render options and Studio has no format picker. Re-scope when/if Studio exposes format choice — logged as a backlog item below)*

## 14. Error paths & resilience

- [x] Kill the network mid-AssemblyAI-transcription → readable error, retry works. *(2026-08-13 — Hasan: Wi-Fi killed mid-run on the second real clip; readable error, retry succeeded after reconnect)*
- [x] Agent turn with no network / provider down → chat error message, app healthy. *(2026-08-13 — Hasan: Wi-Fi off mid-chat, readable error, next send worked after reconnect)*
- [ ] Delete the `cache/` folder of a project, reopen → proxies/waveforms regenerate; auto-cut regenerates what it needs; nothing crashes. ✎ (2026-08-13 sweep — proxies/waveforms regenerated after a cache wipe; auto-cut path not re-run)
- [ ] Two projects open in sequence (A → browser → B) → no state bleed (selection, proposals, chat are per-project; chat clears on project switch — confirm intended behavior). ✎ (2026-08-13 sweep — selection + markers clean across the switch; chat behavior still yours to confirm)
- [ ] Very short clip (< 1 s) and zero-length edge cases: split at clip edge, trim to minimum → no NaN/negative durations anywhere. ✎ (2026-08-13 sweep — edge/1-frame splits rejected as identity; trim floors at 0.04 s; no NaN)
- [ ] Drag a proposal region edge while playback runs → no desync/crash.

## 15. Performance spot checks

*(Run 2026-08-14 as the tail of the polish mini-session, on Hasan's real DJI session concatenated to one 27.4-min 4K/60 HEVC file (13.4 GB) — driven live via CDP.)*

- [x] 30-min source file: import, proxy time acceptable, transcript cost/time acceptable, timeline stays responsive. *(2026-08-14 — MIXED. Transcript: AssemblyAI universal-3-5-pro did the whole 27.4-min file in ~75 s click-to-ready (2,258 words) — very acceptable. Timeline: responsive throughout — clip drag at rAF median 34.8 ms / p90 64 ms WHILE two ffmpeg jobs saturated the CPU; playback rAF median 16.7 ms (clean 60 fps). Proxy: NOT acceptable on this machine for this format — no NVENC (sticky libx264 fallback) and software 4K/60 HEVC decode is the bottleneck: ~6 %/15 min ≈ multi-hour projection. The new progress badge at least makes the wait visible. Follow-up logged below: hardware decode (d3d11va/qsv) for proxy inputs and/or per-machine encoder probe. Hasan's real per-clip footage (2–5 min) proxies fine.)*
- [ ] Agent pass on a long transcript (5k+ words) → takes-view tool result doesn't choke the model or the IPC (watch for multi-minute hangs). *(still open — the 27-min session transcribed to only 2,258 words, under the 5k threshold; needs a denser-speech long file)*
- [x] Editor idle CPU near zero (playhead subscription shouldn't re-render React). *(2026-08-14 — renderer process CPU delta 0.00 s over a 10 s idle sample with the editor open on the 27-min timeline)*
- [x] ✎ Open a big project (video-10: 62 shots, 297 master clips, 113 assets) → the staged panel walks Reading project → Preparing timeline → Loading shots N of 62 → Drawing the first frame, then the editor is usable with zero "Loading…" tiles in the preview. *(2026-09-13, feedback 2 — CDP `profile-open.mjs`, dev build: open-to-interactive cold 1971 ms (before 2619), warm 1193 / 947 ms (before 1592 / 1474); EditorShell renders per warm open 12 → 8. Definition and the full table in `Status.md`.)*
- [x] ✎ Shot module disk cache: restart the app, open the project → shot modules come from `<project>/cache/shot-modules/` (IPC median 29 ms, was 717 ms); a new shot version and an in-place edit of `v<N>.tsx` both show up in the preview, never the cached old code. *(2026-09-13 — `invalidate.mjs` on video-10-test, 7/7; first open after an app update re-transpiles once: 3577 ms.)*
- [x] ✎ Opening a project and going back leaves project.json untouched — `updatedAt` included (re-announced proxies/waveforms no longer patch the document). *(2026-09-13 — video-10 and video-10-test, parsed compare.)*
- [x] ✎ Window focus with an unadoptable folder in `shots/` → reported once; later focus scans do not re-validate (1–7 ms vs 39 ms for the first). *(2026-09-13 — `smoke.mjs`.)*
- [x] ✎ Preview frames unchanged by the loader rewrite: f1957, f5709 (B3IntoCode code window), f6313, f9864, f19019 pixel-identical before/after on video-10. *(2026-09-13 — `frames.mjs`, stashed tree vs new.)*
- [ ] Clear cache in Project settings → the next open re-transpiles every shot and still shows them all. *(unit-tested — "a cleared cache folder just means one more transpile"; not driven in the app)*

## 16. Core-parity features to build BEFORE S4 — test blocks

*Each block gets checked as the feature lands. Ordered by recommended build order.*

### 16.1 Clip inspector (volume · speed · opacity/transform · label)
- [x] Selecting a clip shows a Clip section in the Inspector (name, track, times). *(2026-08-12 — CDP: readouts matched the document to the centisecond; multi-select shows "N clips selected" with volume+mute only)*
- [x] **Copy name** (feedback item 3): the copy icon at the right of the Inspector's Name field puts the clip's name on the clipboard and flashes a check for a moment (no toast); on a tsx clip the icon beside the shot's name copies the **shot id** (what the assistant's tools take). ✎ *(2026-09-13 — CDP on video-10-test: a master clip → its file name, `b0-terminal` → `b0-terminal`; tooltip flips to "Copied" and back)*
- [x] Volume slider (plus mute) maps to `gain`; audible in preview AND respected in export; 0 = silent. *(CDP: muted clip's export span digitally silent (−inf peak, WAV sample scan); mute remembers and restores the pre-mute level; multi-select volume = one undo step)*
- [x] Speed 0.25×–4×: clip duration on the timeline recomputes — DECIDED: clamped in place against the right neighbour like an end-trim, no ripple (stated in the UI); export matches preview. *(CDP: 2× halved readout+clip width; 0.25× boxed in by a neighbour clamped trim-like; export duration 26.60 s matched the sped timeline exactly; sped clip's audio present in export)*
- [x] Opacity/scale/position/rotation numeric fields map to `transform`; visible live in preview. *(CDP: player <video> computed style showed opacity 0.5 + matrix ≡ translate(100px)·scale(.5)·rotate(45°); identical frame extracted from the export)*
- [x] All edits are single undo steps and persist across relaunch. *(CDP: 3 volume edits = 3 undo steps back to baseline; autosaved project.json restored byte-identical after undoing everything)*

### 16.2 Audio fades (in/out per clip)
- [x] Fade handles on clip corners (and/or Inspector fields) write `fadeIn`/`fadeOut` seconds. *(2026-08-12 — CDP: inspector fields committed 1 s/1 s; corner-handle drag extended 1 s → 2 s in one undo step; ramp wedges drawn on the clip)*
- [x] Fade is audible in preview and identical in export; fade can't exceed clip duration; trims clamp existing fades. *(CDP: preview <audio>.volume read 0.5 mid-fade-in, 1.0 centre, 0.5 mid-fade-out; export envelope corr 0.904 vs ramped source (0.732 unramped), edge windows at 2 %/12 % of source level; clamping unit-tested for trim/split/speed — fade-in wins, split keeps the join silent-invariant)*
- [x] Works on video-with-audio clips too, not just audio clips. *(CDP: fade-in on the video clip → the player <video>.volume ramped 0.5 → 1.0; same volumeProp code path feeds OffthreadVideo and Audio in export)*

### 16.3 Copy / paste / duplicate
- [x] Ctrl+C/Ctrl+V pastes the selection at the playhead on the same tracks (or nearest compatible), Ctrl+D duplicates in place after the original. *(2026-08-12 — CDP: paste landed at End playhead selected; Ctrl+D chained right after; undo ×2 → baseline, redo → paste back.)*
- [x] Multi-clip selection pastes with relative layout preserved; collision → clamp (whole group shifts right together) or reject; one undo step. *(unit-tested in timeline-group-ops.test.ts; single-clip path driven live)*
- [x] Paste across projects is cleanly refused (no half-paste): the clipboard is in-memory in the editor and dies with it — nothing to paste in another project.

### 16.4 Detach audio + per-clip mute
- [x] Right-click a video clip → Detach audio → muted video clip + new linked audio clip on an audio track, sample-aligned (verify by ear against the original). *(2026-08-12 — spike proved Remotion `<Audio src={video.mp4}>` in preview AND renderMedia (export envelope corr 0.861 vs the video's exact source span, 0.17 control); CDP: context menu → video Volume 0 % + new A1 clip selected; alignment by construction (same start/sourceIn/duration/speed) checked via envelope correlation)*
- [x] Per-clip mute toggle silences just that clip in preview + export. *(2026-08-12 — Slice B1 clip inspector: muted clip span −inf in the export WAV while neighbours kept audio; gain 0 via the volume control)*
- [x] Undo restores the pre-detach state exactly. *(CDP: one Ctrl+Z → new audio clip gone AND video back to Volume 100 % — single undo step by construction, one op = both sides)*

### 16.5 Basic transitions (crossfade · dip-to-black)
- [x] Apply between two adjacent clips on the same track → overlap/transition renders in preview and export identically. *(2026-08-13 — CDP: join square → picker set both kinds; preview at the crossfade cut read trailing `<video>` opacity 0.5 + both volumes 0.707 (equal-power), dip cut read opacity 0/volume 0; real export: extracted cut frame shows the incoming clip half-transparent over the outgoing one, dip frame pure black; dip audio >90 % attenuated inside the ramp vs ~1× outside; duration unchanged at exactly 420 frames)*
- [x] Duration adjustable; deleting either clip removes the transition cleanly; undo works. *(CDP: preset re-pick 1 s → 0.5 s replaced in place as one undo step; Backspace-deleting the trailing clip dropped the dip in the SAME undo step (reducer-level prune) and one Ctrl+Z restored both; three undos walked both transitions off, two redos back)*
- [x] Transition survives ripple ops around it without desyncing. *(CDP: ripple-deleting the middle clip slid the next clip flush and the crossfade survived onto the new join; unit-tested in transition-ops.test.ts; splits hand the transition to the half that owns the boundary)*

### 16.6 Timeline QoL (auto-scroll · zoom-to-fit · markers)
- [x] During playback the timeline auto-scrolls to keep the playhead in view (and stops fighting you when you scroll manually). *(2026-08-12 — CDP: playhead exiting right edge re-entered at exactly 20% from left; manual scroll-back stayed put while playing; following resumed after the playhead re-entered and walked out again.)*
- [x] Zoom-to-fit (Shift+Z or button) frames the whole timeline. *(CDP: scrollLeft 0, last clip right edge 545 px ≤ 1121 px viewport)*
- [x] M drops a marker at the playhead; markers visible on the ruler, clickable to seek, deletable, persisted. *(2026-08-13 — CDP: M at 3 s/8 s → diamonds at exactly 60/160 px; click seeked the clock back to 00:03.00; drag 8 s → 6 s committed as one undo step; double-click renamed via the inline popover ("Intro beat" shown next to the diamond); right-click FloatingMenu → Delete marker, one undo restored it; both markers survived a renderer relaunch + project reopen from disk)*

### 16.7 Range export (in/out points)
- [x] I/O keys set in/out on the ruler; visible highlight; Export offers "Export range" honoring it exactly (frame-accurate at both ends, ffprobe the output duration). *(2026-08-13 — CDP: I at 2.5 s + O at 7.533 s drew the span (left 50 px, width 100.67 px); a lone point shows a bracket and no button; Shift+I cleared; real export via the render queue → ffprobe video stream 5.033333 s / 151 frames = exactly frame(out) − frame(in); audio envelope corr 0.871 vs the matching source span, −0.62 vs a control span)*

### 16.8 Media relink
- [x] Opening a project with missing media offers "Locate…"; picking the moved file relinks by content hash (refuses a different file, or warns); proxies/waveforms/transcripts keyed by asset id survive the relink. *(2026-08-13 — CDP, three launches with the `VIDTSX_RELINK_PICK` dialog stand-in: moved file → Missing badge + Locate… on the pool card, red-tinted clip, proxy/waveform jobs skipped; picking a different-content file → in-app mismatch card (Cancel = no change; "Use anyway" = override with re-probe, duration 40.07 s → 2.07 s, hash rewritten); picking the true moved file → instant relink, no prompt, hash verified equal, and the proxy's mtime unchanged — caches keyed by asset id survived without regeneration, waveform still drawn. Native-dialog path itself is one manual click in Hasan's full pass.)*

### 16.9 Preview playback rate (global watch speed)
- [x] Rate button on the preview transport cycles 1× → 1.5× → 2× → 0.5× (Shift+click cycles down); label shows the active rate. *(2026-08-12 — CDP)*
- [x] The Player really plays at the chosen rate. *(CDP: 2 s wall advanced the clock ~1.4 s at 1× vs ~3.8 s at 2× — same startup latency, double speed)*
- [x] Auditions pin 1×: "Play removed" disables the rate button and shows 1× for the audition's duration, then restores the chosen rate; "Preview result" pins while checked. *(CDP on the editorial-test open proposal)*
- [x] Session-only: not persisted in the document; export is unaffected (rate is a Player prop, never serialized).

---

## Cut-phase hardening follow-ups (not blocking, log as issues)

- [ ] Keyterms support for AssemblyAI (per-video proper-noun list biasing the transcript — the reference pipeline treats accuracy here as load-bearing).
- [ ] Agent timeline-read tool: the assistant can't answer "what have we cut?" — its only tools are get_transcript/propose_cuts. Give it a read-only timeline/proposal-history view (S4+ candidate; surfaced by Hasan 2026-08-13).
- [ ] Optional: persist agent chat per project (today it's in-memory and dies on project switch/app close — confirmed surprising but accepted 2026-08-13).
- [x] Render start freezes the UI for seconds (composition bundling blocks the main process before frames start). Make prep async and show a "Preparing render…" state. (Hasan, 2026-08-13) *(2026-08-14 — fixed: `bundle()` (webpack, CPU-bound, plus a process.chdir worker_threads can't host) now runs in an Electron utilityProcess (`bundle-worker.ts`, new electron-vite main entry); progress/errors stream back over the port, dev CLI fallback kept. New `RenderPrepChip` on the Studio toolbar shows "Preparing render… n%" from queue-add until frames start (scoped to the project's compositionId). CDP-verified: chip up within 1 s of Export, IPC round-trips 2–60 ms during the entire bundle+prep — before the fix these stalled for seconds; queue row shows Preparing/Bundling phases live)*
- [ ] Studio export format choice (GIF/WebP/quality presets) — export is hard-coded h264/.mp4 today; the Creator-side pipeline already supports the codecs. Decide whether Studio wants a format picker.
- [x] Proxy generation progress on the pool card — today proxies build invisibly (no percent, no badge). ffmpeg `-progress` → percent through the existing job-event channel (transcripts already do this) → bar/badge on the asset card. (Hasan, 2026-08-13) *(2026-08-14 — done: `-progress pipe:1` key-values on stdout + total duration parsed from ffmpeg's own stderr banner (no probe threading needed); whole-percent throttle in the job engine, matching transcripts; renderer keeps ticks in transient state (document only sees status changes, no autosave spam). Pool card gets a "Proxy n%" chip + 2 px accent bar. CDP-verified live on the 27-min 4K import: badge climbed "Proxy …" → 0 % → 2 % → 6 % with the bar tracking)*
- [x] Cache visibility: "Open cache folder" + "Clear cache" (with size readout) per project — proxies/waveforms/transcripts are invisible and undeletable from the UI today; regeneration after a wipe is already verified. (Hasan, 2026-08-13) *(2026-08-14 — done: per-project cache footer on the browser card (size readout always visible; Open/Clear on hover, Clear is a two-step confirm). Browser-only placement on purpose — a clear can only happen while the project is closed, so reopening regenerates proxies/waveforms (transcripts need an explicit re-run, the confirm tooltip says so). New `cache-manager.ts` + three IPC channels; clear aborts the project's running media jobs first so a live ffmpeg can't hold the Windows delete lock. CDP-verified: sizes matched disk byte-for-byte (31.1 MB = 32,621,593 B), Open opened Explorer, Clear verified on the throwaway project)*
- [ ] Proxy speed on 4K/60 HEVC without NVENC is unusable (§15 run: multi-hour projection for a 27-min file — software HEVC decode is the bottleneck, not the libx264 encode). Try `-hwaccel d3d11va`/qsv for the DECODE side independently of the encoder choice, and/or probe encoders per machine instead of the sticky NVENC-once flag. (found 2026-08-14, §15 perf pass)
- [ ] Verify pass: second ASR over an exported cut, diffed against kept words (catches ghosts that ride along and clipped words) — the reference repo's `verify_cut` concept.
- [ ] Per-word times in the agent's takes view if estimated boundaries ever produce a bad join.
- [ ] `settings.agent.model` picker UI (field exists, no UI).
