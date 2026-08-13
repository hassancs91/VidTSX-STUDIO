# Studio stability gate — full test checklist

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
- [ ] Relaunch the app → all projects still listed; open one → document identical (assets, timeline, proposals).
- [ ] Put a corrupt `project.json` in a spare folder → browser skips it without crashing and still lists the others.

## 2. Media pool & import

- [ ] Import a video (mp4), an audio file (wav/mp3), and an image (png/jpg) through the dialog → thumbnails appear; probe values (duration badge) correct.
- [ ] Import a file type the app doesn't support → per-file error toast, other files still import.
- [ ] Import the same file twice → second import either dedupes or creates a second asset — confirm whichever happens is coherent (no crash, both entries usable).
- [ ] Proxy generation: after importing a big video, background job runs (progress on the asset) → preview scrubs smoothly once ready.
- [ ] Waveform generation: audio-bearing assets get waveforms on their timeline clips; a silent video gets none and nothing errors.
- [ ] Remove an asset that has clips on the timeline → its clips vanish from the timeline too; undo restores the clips (asset re-add is manual — confirm no orphan-asset crash on undo).
- [ ] Move/rename a source file on disk, reopen the project → app shows the asset as missing without crashing. (Relink is a known gap — see §16.8.)

## 3. Timeline — clip editing core

- [ ] Add to timeline from the pool → clip lands on a compatible track; with a track selected, the chosen track wins when compatible. ✎
- [ ] Drag-move a clip horizontally → magnetic snap to clip edges + playhead; drop commits exactly what the preview showed.
- [ ] Drag a clip straight up/down to another lane (near-zero horizontal movement) → it stays on the target lane, never snaps back. ✎
- [ ] Neighbour clamp: drag a clip into its neighbour → it stops flush, no overlap ever commits.
- [ ] Edge-trim both edges → bounded by source length and neighbours; waveform/label stay aligned after trim.
- [ ] Split (S key and toolbar) at playhead → two contiguous clips, no visual seam at the join during playback.
- [ ] Delete with ripple ON → later clips slide left by exactly the removed width, per-track (music on another track keeps its timing). ✎
- [ ] Delete with ripple OFF / Backspace → gap stays. ✎
- [ ] Every op above is one undo step; a long chain of ops undoes fully back to the starting state (spot-check with 10+ mixed ops). ✎ (partial)

## 4. Timeline — multi-select & batch

- [ ] Ctrl-click toggles membership; plain click collapses to one; clicking a member of a group keeps the group for dragging and collapses on motionless release. ✎
- [ ] Marquee from empty lane space selects touched clips; Ctrl+marquee is additive; a motionless press deselects. ✎
- [ ] Group drag moves all members by one delta, blocked when any member would collide or cross zero; commits as ONE undo step. ✎
- [ ] Ctrl+A selects all; Escape clears. ✎
- [ ] Batch Delete (ripple) closes the full removed span per track; undo restores everything. ✎

## 5. Tracks

- [ ] Add video/overlay/audio tracks (+ Track button) → visual tracks insert on top, audio appends. ✎
- [ ] Rename (double-click), reorder (Move up/down), delete via context menu; locked track's Delete is disabled; last track can't be deleted. ✎
- [ ] Lock blocks clip edits on that track (drag/trim/delete/paste); mute/hide flags flip and affect preview + export.
- [ ] >3 tracks → header column follows the lanes' vertical scroll; ruler stays sticky. ✎
- [ ] Full track-management chain undoes back to baseline. ✎

## 6. Navigation, zoom, keyboard

- [ ] 10-step zoom anchored on the playhead (buttons and/or Ctrl+wheel) → playhead keeps its screen position while zooming.
- [ ] Arrow keys step one frame; Shift+Arrow steps 1 s; Home/End jump to start/end.
- [ ] Space toggles play everywhere except while typing in an input/chat.
- [ ] Shortcuts are dead while another screen is active (visit Creator, press Delete/Space → Studio unaffected). ✎ (by design, spot-check)
- [ ] Snap toggle actually disables magnetic snapping.

## 7. Playback & preview

- [ ] Preview plays over proxies; the aspect stage letterboxes correctly for 16:9 / 9:16 / 1:1 projects.
- [ ] Scrub a 100-cut timeline → still smooth (the S2 checkpoint; re-verify only if something feels off). ✎
- [ ] Deliberate gap on the video track → black frames play, audio elsewhere continues; no crash at timeline end.
- [ ] Clip `transform`/`gain`/`speed` set by hand in project.json render correctly in preview (sanity for §16.1 before its UI exists).
- [ ] With "Preview result" ON during a review, the playhead JUMPS across cut regions and the clock matches the shorter cut timeline. ✎

## 8. Transcription

- [ ] Transcribe a real recording with AssemblyAI → word count toast; Inspector shows "Ready · N words · AssemblyAI, measured word timestamps". ✎
- [ ] Transcribe with local whisper (base) → works offline; features snapshot shows what whisper actually delivered.
- [ ] Cancel mid-run → entry removed, no stale "generating" after relaunch. ✎ (S3.1)
- [ ] Re-transcribe replaces the old transcript cleanly.
- [ ] Wrong/missing AssemblyAI key → fast, readable error; nothing hangs.
- [ ] Transcript survives relaunch (path + meta in document, JSON in cache). ✎

## 9. Auto Cut (mechanical pass)

- [ ] One-click Auto Cut on an untranscribed asset → transcribes first, then plans, then opens the review; on a transcribed asset it skips straight to planning. ✎
- [ ] Plan honesty: silences found match what you hear; leading/trailing silence included; tight vs natural differ in pacing.
- [ ] Auto Cut is disabled while any review is open. ✎
- [ ] Non-verbatim engine (whisper) → QA note about filler-finding appears in the review header. 

## 10. Review UI (shared by both passes)

- [ ] Striped amber regions on every clip playing the asset; grey + strikethrough when rejected; click region = select + seek. ✎
- [ ] Selected region's edge handles drag with word-boundary snapping, bounded so cuts can't overlap; item shows "adjusted". (unit-tested; never dragged by hand)
- [ ] Header stats are honest: "N proposed · −X s · before → after" recomputes when items are toggled. ✎
- [ ] Play removed / Play join audition correctly BY EAR — no clipped word attacks at joins, join plays ±1.5 s with cuts applied. **(never verified by ear — priority)**
- [ ] Preview result checkbox plays the whole timeline as-if-applied. ✎
- [ ] Reject all → proposal closes `rejected`, regions clear, timeline untouched. 
- [ ] Apply with some items vetoed → only accepted spans cut; toast shows removed seconds; proposal closes `partial`/`applied`. ✎

## 11. Editing agent (Assistant tab)

- [ ] Editorial pass on real multi-take footage → categories are right, notes name the winning take, nothing scripted/kept is cut. ✎ (TTS clip only — re-run on real footage)
- [ ] Fluff suggestions arrive UNCHECKED; ticking one updates Apply count. ✎
- [ ] Tool chips ("Reading transcript", "Proposing cuts") and the proposal chip appear in the chat; streaming text visible while it thinks. ✎
- [ ] Proposal created while you're ON the Assistant tab does NOT yank you to Inspector; from Inspector the review pulls into view. ✎ (first half)
- [ ] Ask for a second pass while a review is open → agent refuses politely, no duplicate proposal. (logic unit-tested; never seen live)
- [ ] Stop button mid-run → run aborts, chat shows the error state, next send works.
- [ ] Chat memory: follow-up question references earlier turns correctly (history round-trip).
- [ ] Untranscribed asset request → agent tells you to transcribe first (tool error surfaced conversationally).
- [ ] Provider set to Local Models → agent explains it can chat but not edit, names the fix. (never seen live)
- [ ] Ask a plain question ("how long is this clip?") → sensible answer, no spurious proposal.

## 12. Apply / undo / redo / persistence

- [ ] Apply is ONE undo step (timeline + proposal together); second undo removes the proposal; redo walks both back. ✎
- [ ] After apply: survivors contiguous per track, first piece keeps its clip id, reshaped clips tagged `origin: agent`. ✎ (S3.3)
- [ ] Autosave: make edits, force-quit the app within a second or two → relaunch loses at most the last debounce window, document not corrupted.
- [ ] History cap: 120+ ops don't blow memory; oldest states drop silently.

## 13. Export & render — **includes the S3 exit gate**

- [ ] Export an UNCUT timeline → correct duration, picture per clip, audio in the right seconds. ✎ (S2)
- [ ] **S3 exit test (never run):** real multi-take recording → auto-cut → audit → apply → editorial pass → audit → apply → export. Then `ffprobe -show_entries stream=duration` on the output: **v:0 duration == a:0 duration**, and A/V sync verified by eye/ear at the LAST cut.
- [ ] Export lands in the render queue with progress; output plays in a external player (VLC + Windows Films).
- [ ] Export a timeline that uses gain/speed/transform (hand-edited if UI not built yet) → values respected in the render, durations correct with speed ≠ 1.
- [ ] GIF/WebP export of a Studio timeline still works (render-pipeline regression).

## 14. Error paths & resilience

- [ ] Kill the network mid-AssemblyAI-transcription → readable error, retry works.
- [ ] Agent turn with no network / provider down → chat error message, app healthy.
- [ ] Delete the `cache/` folder of a project, reopen → proxies/waveforms regenerate; auto-cut regenerates what it needs; nothing crashes.
- [ ] Two projects open in sequence (A → browser → B) → no state bleed (selection, proposals, chat are per-project; chat clears on project switch — confirm intended behavior).
- [ ] Very short clip (< 1 s) and zero-length edge cases: split at clip edge, trim to minimum → no NaN/negative durations anywhere.
- [ ] Drag a proposal region edge while playback runs → no desync/crash.

## 15. Performance spot checks

- [ ] 30-min source file: import, proxy time acceptable, transcript cost/time acceptable, timeline stays responsive.
- [ ] Agent pass on a long transcript (5k+ words) → takes-view tool result doesn't choke the model or the IPC (watch for multi-minute hangs).
- [ ] Editor idle CPU near zero (playhead subscription shouldn't re-render React).

## 16. Core-parity features to build BEFORE S4 — test blocks

*Each block gets checked as the feature lands. Ordered by recommended build order.*

### 16.1 Clip inspector (volume · speed · opacity/transform · label)
- [x] Selecting a clip shows a Clip section in the Inspector (name, track, times). *(2026-08-12 — CDP: readouts matched the document to the centisecond; multi-select shows "N clips selected" with volume+mute only)*
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
- [ ] Opening a project with missing media offers "Locate…"; picking the moved file relinks by content hash (refuses a different file, or warns); proxies/waveforms/transcripts keyed by asset id survive the relink.

### 16.9 Preview playback rate (global watch speed)
- [x] Rate button on the preview transport cycles 1× → 1.5× → 2× → 0.5× (Shift+click cycles down); label shows the active rate. *(2026-08-12 — CDP)*
- [x] The Player really plays at the chosen rate. *(CDP: 2 s wall advanced the clock ~1.4 s at 1× vs ~3.8 s at 2× — same startup latency, double speed)*
- [x] Auditions pin 1×: "Play removed" disables the rate button and shows 1× for the audition's duration, then restores the chosen rate; "Preview result" pins while checked. *(CDP on the editorial-test open proposal)*
- [x] Session-only: not persisted in the document; export is unaffected (rate is a Player prop, never serialized).

---

## Cut-phase hardening follow-ups (not blocking, log as issues)

- [ ] Keyterms support for AssemblyAI (per-video proper-noun list biasing the transcript — the reference pipeline treats accuracy here as load-bearing).
- [ ] Verify pass: second ASR over an exported cut, diffed against kept words (catches ghosts that ride along and clipped words) — the reference repo's `verify_cut` concept.
- [ ] Per-word times in the agent's takes view if estimated boundaries ever produce a bad join.
- [ ] `settings.agent.model` picker UI (field exists, no UI).
